// Two-step AI flow, split so a human can steer the angle before any copy is written:
//   1. suggestPerspectives  — proposes N distinct angles worth testing for a product.
//   2. generateCopyForPerspective — writes title/description for ONE accepted angle
//      (either the AI's own suggestion or a human-written replacement).
//
// IMPORTANT: this writes Merchant Center *feed* attributes (product.title /
// product.description), not ad-copy assets (RSA/PMax/Demand Gen headlines). Those follow
// a different rulebook (CTAs encouraged, multiple assets tested in combination) that does
// NOT apply here — a CTA or promotional phrase in feed title/description gets the item
// disapproved. See docs/google-shopping-feed-guidelines.md for the full rationale; this
// file is the executable source of truth for the rules described there.

const MODEL = 'gpt-5.5';
const TITLE_MAX = 150;
const DESCRIPTION_MAX = 1000;
const AI_PROXY_URL = 'https://ai-proxy.gogroupbr.com/v1/chat/completions';

// includeProductName controls whether the title has to keep referencing what the base
// product actually is (its name/type) alongside the perspective's attribute, or is free to
// be written purely from the perspective/benefit — a human-chosen option per variation (see
// the "Usar nome do produto no título" checkbox in the dashboard's perspective card), not an
// AI decision. Off is for testing a framing that doesn't lean on the product name at all.
function feedRules(includeProductName) {
  const productNameRule = includeProductName
    ? 'Inclua o tipo/nome do produto original (o que ele é) no título, além do atributo da perspectiva — essa é a opção padrão.'
    : 'NÃO inclua o nome/tipo do produto original no título — escreva o título só a partir do atributo/benefício da perspectiva, de forma factual (sem deixar de ser fiel aos dados reais do produto, só sem repetir "o que ele é").';

  return `Você está escrevendo dados de CATÁLOGO para o feed do Google Merchant Center
(atributos title/description de um produto), NÃO um anúncio. Isso muda as regras: aqui é
proibido usar chamada para ação, tom de anúncio ou linguagem promocional — o Google trata
isso como violação de política de conteúdo do feed e pode reprovar o item.

Regras obrigatórias para o TÍTULO:
- Até ${TITLE_MAX} caracteres, mas as informações mais importantes precisam caber nos
  primeiros 60-70 caracteres, porque é só isso que aparece na maioria dos posicionamentos.
- NÃO inclua o nome da marca/loja/empresa no título — o feed já carrega a marca em outro
  atributo.
- ${productNameRule}
- Proibido: chamada para ação ("compre já", "aproveite", "peça agora"), CAIXA ALTA,
  pontuação decorativa (!!!, ***), emojis, URLs, texto promocional ou de preço
  ("frete grátis", "% off", "menor preço", "promoção"), nome da marca/loja/empresa.
- Não inventar atributo que não esteja implícito nos dados do produto informados abaixo.

Regras obrigatórias para a DESCRIÇÃO:
- Até ${DESCRIPTION_MAX} caracteres, com a informação mais relevante concentrada no início.
- Factual e informativa (o que é, para quem serve, atributos reais) — não é uma peça de
  anúncio: SEM chamada para ação ("compre agora", "aproveite", "peça já"), sem preço, frete
  ou prazo de oferta, sem HTML, sem links, sem emojis, sem CAIXA ALTA.
- Não comparar com outros produtos ou marcas (ex: "melhor que a concorrência").
- Não citar histórico da empresa, política da loja, produtos compatíveis ou acessórios —
  descrever só o produto em si.
- Não repetir o título inteiro literalmente — pode citar os mesmos termos, mas precisa
  acrescentar informação.
- Não inventar atributo que não esteja implícito nos dados do produto informados abaixo.`;
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const startArr = text.indexOf('[');
    const endArr = text.lastIndexOf(']');
    const startObj = text.indexOf('{');
    const endObj = text.lastIndexOf('}');
    if (startArr >= 0 && endArr > startArr) return JSON.parse(text.slice(startArr, endArr + 1));
    if (startObj >= 0 && endObj > startObj) return JSON.parse(text.slice(startObj, endObj + 1));
    throw new Error(`Resposta da IA não é um JSON válido: ${text.slice(0, 200)}`);
  }
}

// Defense-in-depth: the prompt asks the model not to use emoji/decorative punctuation/ALL
// CAPS, but models don't always comply — strip/normalize it mechanically too, since a
// disapproved feed item is a worse failure mode than an over-cautious filter.
function sanitizeFeedText(text) {
  return String(text || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/<[^>]*>/g, '')
    .replace(/([!?*.\-])\1{1,}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isShouting(text) {
  const letters = text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  return letters.length > 6 && letters === letters.toUpperCase();
}

function toSentenceCase(text) {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Defense-in-depth for the "no brand in the title" rule above — strip a leading brand
// name the model included anyway (with an optional separator like "-"/":"/"|" after it).
function stripLeadingBrand(text, brand) {
  if (!brand) return text;
  const escaped = String(brand).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return text;
  return text.replace(new RegExp(`^\\s*${escaped}\\s*[-:|–—]?\\s*`, 'i'), '');
}

function finalizeTitle(raw, brand) {
  let title = sanitizeFeedText(raw);
  title = stripLeadingBrand(title, brand);
  if (isShouting(title)) title = toSentenceCase(title);
  return title.slice(0, TITLE_MAX);
}

function finalizeDescription(raw) {
  let description = sanitizeFeedText(raw);
  if (isShouting(description)) description = toSentenceCase(description);
  return description.slice(0, DESCRIPTION_MAX);
}

// Calls GoBeaute's own AI proxy (OpenAI-compatible chat completions format) instead of
// a model provider directly — swap this function if the proxy contract ever changes.
async function callAI(env, prompt) {
  if (!env.AI_PROXY_TOKEN) throw new Error('AI_PROXY_TOKEN não configurado.');

  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.AI_PROXY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao chamar o proxy de IA (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function productSummary(product) {
  return `- Marca: ${product.brand || 'não informada'}
- Título atual: ${product.title || 'não informado'}
- Descrição atual: ${product.description || 'não informada'}
- Categoria Google: ${product.googleProductCategory || 'não informada'}
- Preço: ${product.price || 'não informado'}`;
}

// Step 1: propose angles worth testing, without writing any copy yet.
export async function suggestPerspectives(env, product, count = 3) {
  const prompt = `Você ajuda a decidir QUAL ÂNGULO testar no título/descrição de um produto
no feed do Google Shopping — ainda não vai escrever o texto final, só propor a perspectiva
para um humano aprovar ou substituir.

Produto atual (dados vindos do Google Merchant Center):
${productSummary(product)}

Proponha ${count} perspectivas distintas e específicas, baseadas nos dados reais do produto
(ex: um atributo/ingrediente específico, um público específico, um benefício específico já
implícito na descrição atual) — evite rótulos genéricos como "benefício" sozinho. Lembre-se
que o texto final não poderá ter tom de anúncio/CTA (ver regras de feed), então a
perspectiva deve ser algo expressável de forma factual.

Responda APENAS com um array JSON, sem texto antes ou depois, no formato:
[{"label": "frase curta descrevendo a perspectiva", "rationale": "por que essa perspectiva pode performar bem para este produto"}, ...]`;

  const text = await callAI(env, prompt);
  const parsed = extractJson(text);
  return parsed.slice(0, count).map((p) => ({
    label: String(p.label || '').slice(0, 200),
    rationale: String(p.rationale || '').slice(0, 500)
  }));
}

// Step 2: write title/description for one already-decided perspective (AI-suggested or
// human-replaced). includeProductName (default true) is the human's per-variation choice —
// see feedRules().
export async function generateCopyForPerspective(env, product, perspectiveText, { includeProductName = true } = {}) {
  const prompt = `${feedRules(includeProductName)}

Produto atual (dados vindos do Google Merchant Center):
${productSummary(product)}

Perspectiva definida para esta variação (já aprovada por um humano, não deve ser trocada): "${perspectiveText}"

Escreva o título e a descrição desta variação seguindo essa perspectiva e as regras acima.

Responda APENAS com um objeto JSON, sem texto antes ou depois, no formato:
{"title": "...", "description": "..."}`;

  const text = await callAI(env, prompt);
  const parsed = extractJson(text);
  return {
    title: finalizeTitle(parsed.title, product.brand),
    description: finalizeDescription(parsed.description)
  };
}

// For the "antes e depois" image mode (piapp.js) — describes, in English (it feeds an
// image-generation prompt), the visual "before" problem this product solves and the
// "after" state once it's solved, grounded in the product's real description/perspective
// rather than invented. Kept separate from generateCopyForPerspective since it's only
// needed when the human explicitly picks the before/after image mode.
export async function suggestPainAndResult(env, product, perspectiveText) {
  const prompt = `Você ajuda a planejar uma imagem "antes e depois" para um produto de beleza,
mostrando a dor/problema que o produto resolve (lado "antes") e o resultado alcançado depois de
usá-lo (lado "depois"). Isso vai alimentar um prompt de geração de imagem, não um texto de feed.

Produto atual (dados vindos do Google Merchant Center):
${productSummary(product)}

Perspectiva/ângulo desta variação (já aprovada por um humano): "${perspectiveText}"

Descreva, em inglês e de forma visual/específica (para gerar imagem), baseado no benefício real
do produto — não invente nada que não esteja implícito nos dados acima:
- "before": a aparência do problema que esse produto resolve (ex: como fica o cabelo/pele/couro
  cabeludo antes de usar o produto).
- "after": a aparência depois de resolvido — aspiracional, mas plausível/realista.

Responda APENAS com um objeto JSON, sem texto antes ou depois, no formato:
{"before": "...", "after": "..."}`;

  const text = await callAI(env, prompt);
  const parsed = extractJson(text);
  return {
    before: String(parsed.before || '').slice(0, 300),
    after: String(parsed.after || '').slice(0, 300)
  };
}
