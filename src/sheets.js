// Writes the auxiliary Shopping feed into a Google Sheet, formatted for Merchant Center's
// "Google Sheets" feed source. This sheet is registered manually in Merchant Center as a
// separate primary feed — it never touches the Shopify-synced feed.

import { getGoogleAccessToken, SCOPES } from './google';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const HEADER = [
  'id', 'title', 'description', 'link', 'image_link', 'availability', 'price',
  'brand', 'gtin', 'mpn', 'condition', 'google_product_category', 'item_group_id', 'custom_label_0'
];

function candidateToRow(c) {
  return [
    `${c.merchantProductId}-var${c.variantIndex}`,
    c.titleSuggestion,
    c.descriptionSuggestion,
    c.productLink || '',
    c.imageUrl || c.productImage || '',
    'in stock',
    c.productPrice || '',
    c.brand || '',
    c.productGtin || '',
    '',
    'new',
    c.productGoogleCategory || '',
    c.merchantProductId,
    'variation-test'
  ];
}

export async function syncApprovedFeed(env, sheetId, tabName, approvedCandidates) {
  if (!sheetId) throw new Error('sheetId não informado para esta marca.');
  const tab = tabName || 'feed';
  const token = await getGoogleAccessToken(env, SCOPES.SHEETS);

  const rows = [HEADER, ...approvedCandidates.map(candidateToRow)];

  // Clear the tab first so removed/rejected variations don't linger as stale rows.
  const clearUrl = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(tab)}:clear`;
  const clearResp = await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!clearResp.ok) {
    const text = await clearResp.text();
    throw new Error(`Falha ao limpar a planilha (${clearResp.status}): ${text}`);
  }

  const updateUrl = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`;
  const updateResp = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rows })
  });
  if (!updateResp.ok) {
    const text = await updateResp.text();
    throw new Error(`Falha ao escrever na planilha (${updateResp.status}): ${text}`);
  }

  return { rowsWritten: rows.length - 1 };
}
