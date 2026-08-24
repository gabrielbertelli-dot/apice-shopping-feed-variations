// Writes the auxiliary Shopping feed into a Google Sheet, formatted for Merchant Center's
// "Google Sheets" feed source. This sheet is registered manually in Merchant Center as a
// separate primary feed — it never touches the Shopify-synced feed.

import { getGoogleAccessToken, SCOPES } from './google';
import { fetchWithRetry } from './http';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const HEADER = [
  'id', 'title', 'short_title', 'description', 'link', 'image_link', 'additional_image_link',
  'availability', 'price', 'sale_price', 'brand', 'gtin', 'mpn', 'condition',
  'google_product_category', 'product_type', 'item_group_id', 'custom_label_0'
];

function candidateToRow(c) {
  return [
    `${c.merchantProductId}-var${c.variantIndex}`,
    c.titleSuggestion,
    // short_title/product_type/additional_image_link are never AI-generated — copied as-is
    // from the original Merchant Center product (see discover.js's passthroughFields).
    c.productShortTitle || '',
    c.descriptionSuggestion,
    c.productLink || '',
    c.imageUrl || c.productImage || '',
    c.productAdditionalImageLinks || '',
    'in stock',
    c.productPrice || '',
    c.productSalePrice || '',
    c.brand || '',
    c.productGtin || '',
    '',
    'new',
    c.productGoogleCategory || '',
    c.productType || '',
    c.merchantProductId,
    'variation-test'
  ];
}

export async function syncApprovedFeed(env, sheetId, tabName, approvedCandidates) {
  if (!sheetId) throw new Error('sheetId não informado para esta marca.');
  const tab = tabName || 'feed';
  const token = await getGoogleAccessToken(env, SCOPES.BOTH);

  const rows = [HEADER, ...approvedCandidates.map(candidateToRow)];

  // Clear the tab first so removed/rejected variations don't linger as stale rows.
  const clearUrl = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(tab)}:clear`;
  const clearResp = await fetchWithRetry(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!clearResp.ok) {
    const text = await clearResp.text();
    throw new Error(`Falha ao limpar a planilha (${clearResp.status}): ${text}`);
  }

  const updateUrl = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`;
  const updateResp = await fetchWithRetry(updateUrl, {
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

// Serializes sheet syncs per brand — two concurrent approvals for the same brand used to
// each independently read "all approved so far", clear the tab, and write back; if their
// read/write windows interleaved, whichever write landed last could silently drop the
// other's newly-approved candidate. Module-level Map surviving across requests on a warm
// instance is the same idea as google.js's cachedToken / db.js's schemaEnsured.
//
// Callers pass a thunk (getApprovedCandidates), not a pre-fetched array — each queued sync
// re-reads the latest approved set right before it actually runs, rather than trusting a
// snapshot taken back when it was queued. That re-read is what actually closes the race;
// serialization alone would just serialize stale writes in order.
const brandSyncQueues = new Map(); // brand name -> Promise (tail of that brand's queue)

export function queueSheetSync(env, brand, sheetId, tabName, getApprovedCandidates) {
  const prev = brandSyncQueues.get(brand) || Promise.resolve();
  const next = prev
    .catch(() => {}) // a previous failed sync shouldn't poison the queue for the next one
    .then(async () => {
      const approved = await getApprovedCandidates();
      return syncApprovedFeed(env, sheetId, tabName, approved);
    });
  brandSyncQueues.set(brand, next);
  return next;
}
