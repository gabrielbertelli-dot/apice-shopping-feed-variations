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

// Fetches exactly one page (max 250) of a Merchant Center account's product list. Building
// block for both listAllProducts() below and the incremental cron sync in catalogSync.js —
// the sync uses this directly so it only ever holds one page in memory per tick, instead of
// materializing (or even scanning end-to-end in one request) the whole catalog.
export async function fetchProductsPage(env, merchantId, pageToken) {
  if (!merchantId) throw new Error('merchantId não informado.');
  const token = await getGoogleAccessToken(env, SCOPES.CONTENT);

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
  return {
    products: (data.resources || []).map(simplify),
    nextPageToken: data.nextPageToken || null
  };
}

// Fetches the whole active product list in one request. Fine for catalogs up to a few
// thousand SKUs; for anything larger use the catalog_cache table (see catalogSync.js +
// db.js's searchCatalogCandidates) instead of calling this — a catalog large enough
// (confirmed case: Gocase's phone-case catalog) can exceed the Worker's memory or
// execution-time limit if fully paginated within a single request.
export async function listAllProducts(env, merchantId) {
  const products = [];
  let pageToken;
  do {
    const page = await fetchProductsPage(env, merchantId, pageToken);
    products.push(...page.products);
    pageToken = page.nextPageToken;
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

function scoreAgainst(productTitle, sellerWords, sellerItemCount) {
  const productItemCount = extractItemCount(productTitle);
  if (sellerItemCount != null && productItemCount != null && sellerItemCount !== productItemCount) return 0;
  const productWords = new Set(normalizeWords(productTitle));
  const shared = sellerWords.filter((w) => productWords.has(w)).length;
  return shared / sellerWords.length;
}

// Scores an already-narrowed candidate list (either a small in-memory catalog, or the
// reduced result of db.js's searchCatalogCandidates for larger ones) against a title/name
// to match. Exported so normalizeWords is reachable too, for building the search words
// searchCatalogCandidates needs before it can narrow the catalog_cache table down.
export function normalizeWordsForSearch(text) {
  return normalizeWords(text);
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
