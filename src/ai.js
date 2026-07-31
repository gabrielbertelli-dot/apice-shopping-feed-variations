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

const FEED_RULES = `Você está escrevendo dados de CATÁLOGO para o feed do Google Merchant Center
(atributos title/description de um produto), NÃO um anúncio. Isso muda as regras: aqui é
proibido usar chamada para ação, tom de anúncio ou linguagem promocional — o Google trata
isso como violação de política de conteúdo do feed e pode reprovar o item.

Regras obrigatórias para o TÍTULO:
- Até ${TITLE_MAX} caracteres, mas as informações mais importantes (marca + tipo de produto +
  atributo que diferencia esta variação) precisam caber nos primeiros 60-70 caracteres,
  porque é só isso que aparece na maioria dos posicionamentos.
- Ordem: Marca, depois o que o produto é, depois o atributo-chave da perspectiva.
- Proibido: chamada para ação ("compre já", "aproveite", "peça agora"), CAIXA ALTA,
  pontuação decorativa (!!!, ***), emojis, URLs, texto promocional ou de preço
  ("frete grátis", "% off", "menor preço", "promoção"), nome da loja/empresa.
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

function finalizeTitle(raw) {
  let title = sanitizeFeedText(raw);
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

// Step 2: write title/description for one already-decided perspective (AI-suggested or human-replaced).
export async function generateCopyForPerspective(env, product, perspectiveText) {
  const prompt = `${FEED_RULES}

Produto atual (dados vindos do Google Merchant Center):
${productSummary(product)}

Perspectiva definida para esta variação (já aprovada por um humano, não deve ser trocada): "${perspectiveText}"

Escreva o título e a descrição desta variação seguindo essa perspectiva e as regras acima.

Responda APENAS com um objeto JSON, sem texto antes ou depois, no formato:
{"title": "...", "description": "..."}`;

  const text = await callAI(env, prompt);
  const parsed = extractJson(text);
  return {
    title: finalizeTitle(parsed.title),
    description: finalizeDescription(parsed.description)
  };
}
