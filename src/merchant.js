// Client for the Google Merchant Center Content API (v2.1), read-only.
// We only ever read here — nothing in this app writes back to Merchant Center directly,
// variations go out through the auxiliary Google Sheets feed instead.

import { getGoogleAccessToken, SCOPES } from './google';

const BASE = 'https://shoppingcontent.googleapis.com/content/v2.1';

function simplify(p) {
  return {
    id: p.id,
    offerId: p.offerId,
    title: p.title,
    description: p.description,
    link: p.link,
    imageLink: p.imageLink,
    price: p.price ? `${p.price.value} ${p.price.currency}` : null,
    priceValue: p.price ? p.price.value : null,
    priceCurrency: p.price ? p.price.currency : null,
    gtin: p.gtin || null,
    mpn: p.mpn || null,
    brand: p.brand || null,
    googleProductCategory: p.googleProductCategory || null,
    availability: p.availability || null,
    condition: p.condition || null
  };
}

// Fetches the whole active product list once for a given Merchant Center account (one per
// brand/client). Fine for catalogs up to a few thousand SKUs within a single Worker
// invocation; if a catalog grows much larger this should switch to fetching specific
// offer IDs via a search/batch call instead of listing everything.
export async function listAllProducts(env, merchantId) {
  if (!merchantId) throw new Error('merchantId não informado.');
  const token = await getGoogleAccessToken(env, SCOPES.CONTENT);

  const products = [];
  let pageToken;
  do {
    const url = new URL(`${BASE}/${merchantId}/products`);
    url.searchParams.set('maxResults', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Falha ao listar produtos no Merchant Center (${response.status}): ${text}`);
    }
    const data = await response.json();
    for (const resource of data.resources || []) products.push(simplify(resource));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return products;
}

// Fallback for when the sales-data source and the Merchant Center feed come from
// different systems with unrelated IDs (e.g. a Yampi-sourced sales table vs a
// Shopify-fed Merchant Center catalog — confirmed case: Ápice's top sellers have no
// shared id/slug/gtin with their Shopify products, only a differently-formatted name:
// "Kit X - a, b e c (5 ITENS)" vs "Kit X 5 itens - a+b+c - Ápice Cosméticos"). Requires
// the "N itens" count to agree when both titles mention one, and a high word-overlap
// ratio — conservative on purpose, since a wrong match puts the wrong price/image into a
// live Shopping variation. Callers must treat a match from this path as lower-confidence
// than an exact ID match and flag it for extra human review.
const FUZZY_MATCH_THRESHOLD = 0.6;

function normalizeWords(text) {
  return String(text || '').toLowerCase()
    .replace(/[^a-z0-9à-öø-ÿ\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function extractItemCount(text) {
  const m = String(text || '').match(/(\d+)\s*itens?/i);
  return m ? parseInt(m[1], 10) : null;
}

export function matchProductByTitle(products, sellerTitle) {
  const sellerWords = normalizeWords(sellerTitle);
  if (!sellerWords.length) return null;
  const sellerItemCount = extractItemCount(sellerTitle);

  let best = null;
  for (const p of products) {
    const productItemCount = extractItemCount(p.title);
    if (sellerItemCount != null && productItemCount != null && sellerItemCount !== productItemCount) continue;
    const productWords = new Set(normalizeWords(p.title));
    const shared = sellerWords.filter((w) => productWords.has(w)).length;
    const score = shared / sellerWords.length;
    if (score >= FUZZY_MATCH_THRESHOLD && (!best || score > best.score)) best = { product: p, score };
  }
  return best;
}
