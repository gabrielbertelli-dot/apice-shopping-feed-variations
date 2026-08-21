# Guia de título e descrição para o feed do Google Shopping (Merchant Center)

Este documento é a fonte de verdade das regras que o app aplica ao gerar `title` e
`description` no feed auxiliar (`src/ai.js`). É diferente do guia de copy de anúncios
(Search/PMax/Demand Gen): aqui estamos escrevendo **dados de catálogo** que o Google usa
para casar a busca do usuário com o produto, não uma peça de anúncio — por isso as regras
são mais restritivas (sem CTA, sem linguagem promocional, sem emojis).

## 1. Título (`title`)

Fonte: [Especificação do atributo title — Merchant Center Help](https://support.google.com/merchants/answer/6324415).

- **Limite:** até 150 caracteres (o Google aceita até 150, mas normalmente só ~70
  caracteres aparecem na maioria dos posicionamentos) — os primeiros 60-70 caracteres
  precisam carregar a informação mais importante sozinhos.
- **Estrutura recomendada:** `Tipo de produto + Atributos-chave que diferenciam a
  variação` (ex: função, ingrediente/ativo principal, tipo de cabelo/público, volume/ml).
  Marca não entra no título (o feed já a carrega em outro atributo).
- **Nome do produto no título — opção por variação:** o padrão é incluir o tipo/nome do
  produto original antes do atributo da perspectiva (regra acima). O card de perspectiva no
  dashboard tem um checkbox "Usar nome do produto no título" — desmarcando, o título sai
  só a partir do atributo/benefício da perspectiva, sem repetir o que o produto é. Útil pra
  testar um enquadramento que não se apoia no nome do produto. Continua proibido inventar
  atributo que não esteja implícito nos dados reais, com ou sem essa opção.
- **Proibido (redação oficial do Google):**
  - **Sem CTA / sem linguagem promocional** — a política veda "gimmicky ways of drawing
    attention" (formas chamativas de chamar atenção) e "promotional text" em geral. Isso
    cobre qualquer chamada para ação ("compre já", "aproveite"), não só preço/frete.
  - "Don't add information such as price, sale price, sale dates, shipping, delivery
    date, other time-related information, or your company's name" — nada de preço,
    desconto, prazo de oferta, frete ou nome da loja/empresa no título.
  - CAIXA ALTA para dar ênfase — o Google trata como sinal de spam/anúncio pouco confiável.
  - Símbolos decorativos, tags HTML, espaços extras, palavras em outro idioma sem
    necessidade.
  - Inventar atributo que não existe no produto real (título tem que ser fiel ao dado de
    origem do Merchant Center).
- **Consistência:** o título de cada variação deve continuar reconhecível como o mesmo
  produto — a perspectiva muda o enquadramento, não o fato.

## 2. Descrição (`description`)

Fonte: [Especificação do atributo description — Merchant Center Help](https://support.google.com/merchants/answer/6324468).

- **Limite:** até 5000 caracteres no Merchant Center, mas só os primeiros ~500-1000
  aparecem com destaque — por isso o app gera até 1000 caracteres e concentra a
  informação mais relevante no início.
- **Conteúdo:** factual e informativo — o que o produto é, para quem serve, atributos
  relevantes (ingredientes, modo de uso, benefícios reais implícitos nos dados do
  produto). Não é uma peça de anúncio.
- **Proibido (redação oficial do Google):**
  - **Sem CTA / sem linguagem promocional** — "compre agora", "aproveite", "peça já" e
    qualquer variação disso é regra de *anúncio* (Search/PMax/Demand Gen), não de dado de
    catálogo. No feed do Shopping isso é tratado como conteúdo promocional e pode reprovar
    o item — não é uma zona cinzenta, é proibição explícita.
  - "Don't include promotional text such as price, sale price, sale dates, shipping,
    delivery date, other time-related information, or your company's name."
  - "Don't include links to your store or other websites" — só o `link` do produto, fora
    do texto da descrição.
  - "Don't include comparisons or details about other products" (ex: "melhor que a marca X").
  - Descrever só o produto em si — nada de histórico da empresa, política da loja,
    produtos compatíveis/acessórios.
  - HTML, emojis, CAIXA ALTA para ênfase.
  - Repetir literalmente o título inteiro (pode citar os mesmos termos, mas deve
    acrescentar informação, não só repetir).

## 3. Regra entre variações do mesmo produto

- Cada variação (`variant_index`) precisa ter uma perspectiva diferente e clara — nunca
  duas variações devem ser reformulações triviais uma da outra (isso é o equivalente,
  em feed, à "redundância" que derruba a qualidade em anúncios de Search/PMax).
- `item_group_id` (ver `src/sheets.js`) já sinaliza ao Google que são variações do mesmo
  item — isso reduz o risco de leitura como conteúdo duplicado, mas não substitui ter
  ângulos realmente distintos.

## 4. Imagem (`image_link` / `additional_image_link`)

Fonte: [Especificações de imagem — Merchant Center Help](https://support.google.com/merchants/answer/6324350),
[Conteúdo gerado por IA — Merchant Center Help](https://support.google.com/merchants/answer/14743464).

- **Resolução:** mínimo 500x500 px (obrigatório); recomendado 1500x1500 px ou mais para
  melhor desempenho em todos os formatos de anúncio.
- **Limites técnicos:** até 64 megapixels e até 16 MB por arquivo.
- **Formatos aceitos:** JPEG, WebP, PNG, GIF (não animado), BMP, TIFF.
- **Enquadramento do produto:** o produto deve ocupar entre 75% e 90% da área da imagem
  — nem muito distante (espaço vazio demais) nem cortado/sangrando a moldura.
- **Fundo:** branco sólido ou transparente (transparente não é recomendado para produtos
  claros, some no fundo).
- **Proibido (redação oficial do Google):**
  - **Sem CTA na imagem** — a especificação de imagem é uma das poucas que usa o termo
    literalmente: *"Cannot include calls to action, price information, or promotional
    adjectives"* sobrepostos na imagem (texto tipo "compre já", "oferta", preço, "% off"
    etc. estampado na foto). Diferente de título/descrição (que falam em "linguagem
    promocional" sem citar "call to action" pelo nome), aqui o Google usa exatamente essa
    expressão — reforça que é proibição explícita, não interpretação nossa.
  - Imagem placeholder ou que não seja do produto real.
  - Marca d'água, logo ou nome de marca/fabricante/varejista sobreposto (diferente de logo
    que já existe fisicamente na embalagem do produto).
  - Bordas ao redor da imagem.
- **Imagem gerada por IA — regra específica (desde fev/2024, ainda vigente):** toda
  imagem criada por IA generativa enviada ao feed (`image_link`, `additional_image_link`,
  `lifestyle_image_link`) precisa conter o metadado IPTC `DigitalSourceType` (tipicamente
  `trainedAlgorithmicMedia`) embutido no arquivo. **Nunca remover/reprocessar o arquivo de
  um jeito que apague esse metadado** (ex: reabrir e re-salvar em outro editor sem
  preservar metadados, print de tela, recompressão que descarta chunks XMP/C2PA).
  - **Verificado nesta integração (2026-07-31):** as imagens geradas pelo PiApp já saem
    com esse metadado correto, tanto no caminho sem imagem de referência (modelo
    `gemini-2.5-flash-image`, grava `Iptc4xmpExt:DigitalSourceType=trainedAlgorithmicMedia`
    + C2PA/SynthID do Google) quanto no caminho com imagem de referência — o que este app
    sempre usa (modelo `wavespeed-gpt-image-2-edit`/GPT Image 2, grava o mesmo
    `digitalSourceType=trainedAlgorithmicMedia` via cadeia C2PA da Adobe Firefly).
  - Como o app nunca reabre/recodifica o arquivo (só reescreve a URL de assinada para
    pública, mantendo os bytes originais — ver `src/piapp.js`), o metadado chega intacto
    até a planilha.
  - **Se o PiApp um dia trocar de provedor de modelo**, essa verificação precisa ser
    refeita — não assumir que vale para sempre.

## 5. Por que isso é diferente do guia de copy de anúncios (Search/PMax/Demand Gen)

O guia de boas práticas de Ads (`google-ads:references:bookguide`) recomenda CTAs
explícitas, caixa de títulos/descrições múltiplas testadas em combinação, etc. — isso
vale para os **assets do anúncio em si** (RSA, PMax, Demand Gen). O `title`/`description`
que este app escreve são **atributos do produto no Merchant Center**, consumidos pelo
Shopping/PMax a partir do feed, não o texto do anúncio. Aplicar a regra de CTA do guia de
Ads aqui geraria reprovação por linguagem promocional. As duas fontes de verdade não
devem ser misturadas.
