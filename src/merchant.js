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

// Shared by matchProductByTitle (in-memory catalog) and findProductByTitle (paginated) below.
function scoreAgainst(productTitle, sellerWords, sellerItemCount) {
  const productItemCount = extractItemCount(productTitle);
  if (sellerItemCount != null && productItemCount != null && sellerItemCount !== productItemCount) return 0;
  const productWords = new Set(normalizeWords(productTitle));
  const shared = sellerWords.filter((w) => productWords.has(w)).length;
  return shared / sellerWords.length;
}

export function matchProductByTitle(products, sellerTitle) {
  const sellerWords = normalizeWords(sellerTitle);
  if (!sellerWords.length) return null;
  const sellerItemCount = extractItemCount(sellerTitle);

  let best = null;
  for (const p of products) {
    const score = scoreAgainst(p.title, sellerWords, sellerItemCount);
    if (score >= FUZZY_MATCH_THRESHOLD && (!best || score > best.score)) best = { product: p, score };
  }
  return best;
}

// Same matching logic as matchProductByTitle, but paginates the Merchant Center catalog
// directly instead of requiring the whole thing pre-loaded via listAllProducts() — needed
// for catalogs large enough to exceed the Worker's memory limit when fully materialized
// (confirmed case: Gocase's phone-case catalog, hundreds of phone models × designs, blew
// past it). Only the current page and the best match found so far are kept in memory.
export async function findProductByTitle(env, merchantId, productName) {
  if (!merchantId) throw new Error('merchantId não informado.');
  const sellerWords = normalizeWords(productName);
  if (!sellerWords.length) return null;
  const sellerItemCount = extractItemCount(productName);
  const token = await getGoogleAccessToken(env, SCOPES.CONTENT);

  let best = null;
  let pageToken;
  let pagesScanned = 0;
  const MAX_PAGES = 4000; // safety cap (~1M products) in case pagination ever misbehaves
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
    for (const resource of data.resources || []) {
      const score = scoreAgainst(resource.title, sellerWords, sellerItemCount);
      if (score >= FUZZY_MATCH_THRESHOLD && (!best || score > best.score)) best = { product: simplify(resource), score };
    }
    pageToken = data.nextPageToken;
    pagesScanned++;
    if (best && best.score >= 0.999) break; // near-perfect match — no need to keep scanning
  } while (pageToken && pagesScanned < MAX_PAGES);

  return best;
}
