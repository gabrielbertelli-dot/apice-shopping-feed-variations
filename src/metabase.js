// Client for a saved Metabase question ("card") that returns product/brand sales data.
// We deliberately avoid building native SQL against the warehouse schema — the card
// query is the contract, so this keeps working even if the underlying tables change.

const ID_PATTERN = /(merchant|product|item|offer).*id|^id$/i;
const BRAND_PATTERN = /brand|marca/i;
const TITLE_PATTERN = /title|nome|product.*name|descricao/i;
const SHARE_PATTERN = /share|percent|pct|particip/i;
const REVENUE_PATTERN = /revenue|receita|faturamento|sales|vendas|valor/i;

function detectColumn(colNames, override, pattern) {
  if (override) {
    const idx = colNames.findIndex((c) => c.toLowerCase() === override.toLowerCase());
    if (idx >= 0) return idx;
  }
  const idx = colNames.findIndex((c) => pattern.test(c));
  return idx;
}

export async function fetchTopSellersByBrand(env, settings) {
  if (!settings.metabase_card_id) {
    throw new Error('metabase_card_id não configurado. Defina o ID da pergunta salva no Metabase em Configurações.');
  }
  if (!env.METABASE_URL || !env.METABASE_API_KEY) {
    throw new Error('METABASE_URL / METABASE_API_KEY não configurados.');
  }

  const response = await fetch(`${env.METABASE_URL.replace(/\/$/, '')}/api/card/${settings.metabase_card_id}/query`, {
    method: 'POST',
    headers: {
      'x-api-key': env.METABASE_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao consultar Metabase (${response.status}): ${text}`);
  }

  const payload = await response.json();
  const data = payload.data || payload;
  const cols = (data.cols || []).map((c) => c.display_name || c.name);
  const rawRows = data.rows || [];

  const idIdx = detectColumn(cols, settings.metabase_col_id, ID_PATTERN);
  const brandIdx = detectColumn(cols, settings.metabase_col_brand, BRAND_PATTERN);
  const titleIdx = detectColumn(cols, settings.metabase_col_title, TITLE_PATTERN);
  let shareIdx = detectColumn(cols, settings.metabase_col_share, SHARE_PATTERN);
  const revenueIdx = detectColumn(cols, '', REVENUE_PATTERN);

  if (idIdx < 0 || brandIdx < 0) {
    throw new Error(
      `Não consegui identificar as colunas de id/marca no resultado do Metabase. Colunas retornadas: ${cols.join(', ')}. ` +
      'Configure metabase_col_id e metabase_col_brand manualmente em Configurações.'
    );
  }

  let records = rawRows.map((row) => ({
    merchantProductId: String(row[idIdx]),
    brand: String(row[brandIdx]),
    title: titleIdx >= 0 ? String(row[titleIdx]) : null,
    share: shareIdx >= 0 ? Number(row[shareIdx]) : null,
    revenue: revenueIdx >= 0 ? Number(row[revenueIdx]) : null
  }));

  // If there's no explicit share column, derive share-of-brand-revenue ourselves.
  if (shareIdx < 0 && revenueIdx >= 0) {
    const brandTotals = {};
    for (const r of records) brandTotals[r.brand] = (brandTotals[r.brand] || 0) + (r.revenue || 0);
    records = records.map((r) => ({ ...r, share: brandTotals[r.brand] ? r.revenue / brandTotals[r.brand] : 0 }));
  }

  const topN = parseInt(settings.top_n_per_brand, 10) || 3;
  const byBrand = {};
  for (const r of records) {
    if (!byBrand[r.brand]) byBrand[r.brand] = [];
    byBrand[r.brand].push(r);
  }

  const result = [];
  for (const brand of Object.keys(byBrand)) {
    const sorted = byBrand[brand]
      .sort((a, b) => (b.share ?? b.revenue ?? 0) - (a.share ?? a.revenue ?? 0))
      .slice(0, topN);
    sorted.forEach((r, i) => {
      result.push({
        merchantProductId: r.merchantProductId,
        brand: r.brand,
        title: r.title,
        revenueShare: r.share,
        rank: i + 1
      });
    });
  }
  return result;
}
