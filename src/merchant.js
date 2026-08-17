// Clients for two read-only Google Shopping APIs, both authenticated with the same service
// account (see google.js): the Content API v2.1 (listAllProducts + in-memory matching —
// simple, no setup, fine for catalogs up to a few thousand SKUs) and the newer Merchant API
// Reports service (findProductByOfferId/findProductByTitleSearch — server-side search, no
// catalog-size limit, but requires a one-time per-account developer registration that only a
// human Admin-level account can do, not this app's service account — see the note below).
// discover.js picks between the two per brand via brands.largeCatalog, so a brand that
// doesn't need the Reports path never depends on that registration being done.

import { getGoogleAccessToken, SCOPES } from './google';

const CONTENT_BASE = 'https://shoppingcontent.googleapis.com/content/v2.1';
const REPORTS_BASE = 'https://merchantapi.googleapis.com/reports/v1';

// One-time-per-account prerequisite before findProductByTitleSearch/findProductByOfferId
// below will work: the calling GCP project must be registered as a developer on the target
// Merchant Center account (accounts.developerRegistration.registerGcp). Confirmed this MUST
// be called with a human OAuth token belonging to an Admin-level user on that account — a
// service account (what this app authenticates as) is explicitly rejected by Google
// ("GCP registration is not allowed for service accounts"), so this app can't do it itself.
// See the project's setup notes for the one-time manual step (OAuth Playground + curl).

function simplify(p) {
  return {
    id: p.id,
    offerId: p.offerId,
    title: p.title,
    shortTitle: p.shortTitle || null,
    description: p.description,
    link: p.link,
    imageLink: p.imageLink,
    additionalImageLinks: Array.isArray(p.additionalImageLinks) ? p.additionalImageLinks : [],
    price: p.price ? `${p.price.value} ${p.price.currency}` : null,
    priceValue: p.price ? p.price.value : null,
    priceCurrency: p.price ? p.price.currency : null,
    // "Real" price the customer actually pays when the item is on sale — the plain `price`
    // above stays the regular/list price either way (that's what the Content API returns).
    salePrice: p.salePrice ? `${p.salePrice.value} ${p.salePrice.currency}` : null,
    salePriceValue: p.salePrice ? p.salePrice.value : null,
    salePriceCurrency: p.salePrice ? p.salePrice.currency : null,
    gtin: p.gtin || null,
    mpn: p.mpn || null,
    brand: p.brand || null,
    productTypes: Array.isArray(p.productTypes) ? p.productTypes : [],
    googleProductCategory: p.googleProductCategory || null,
    availability: p.availability || null,
    condition: p.condition || null
  };
}

// Fetches one page (max 250) of a Merchant Center account's product list.
async function fetchProductsPage(env, merchantId, pageToken) {
  if (!merchantId) throw new Error('merchantId não informado.');
  const token = await getGoogleAccessToken(env, SCOPES.CONTENT);
  const url = new URL(`${CONTENT_BASE}/${merchantId}/products`);
  url.searchParams.set('maxResults', '250');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao listar produtos no Merchant Center (${response.status}): ${text}`);
  }
  const data = await response.json();
  return { products: (data.resources || []).map(simplify), nextPageToken: data.nextPageToken || null };
}

// Fetches the whole active product list in one request. Fine for catalogs up to a few
// thousand SKUs (this is the default path — see brands.largeCatalog in discover.js); for
// anything much larger, use findProductByOfferId/findProductByTitleSearch below instead —
// a catalog large enough (confirmed case: Gocase, ~5M SKUs) can exceed the Worker's memory
// or execution-time limit if fully paginated within a single request.
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

// Fetches one product's full attributes by its product_view/Content API composite id (e.g.
// "online~pt~BR~offerId123" — NOT the bare offer id).
export async function getProductById(env, merchantId, id) {
  if (!merchantId) throw new Error('merchantId não informado.');
  const token = await getGoogleAccessToken(env, SCOPES.CONTENT);
  const response = await fetch(`${CONTENT_BASE}/${merchantId}/products/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao buscar produto no Merchant Center (${response.status}): ${text}`);
  }
  return simplify(await response.json());
}

// Runs one Merchant Center Query Language search against the product_view report table.
// Costs the same regardless of catalog size — the filtering happens on Google's side, not
// by us paginating and scanning every product. Returns the raw productView rows (id,
// offerId, title — whatever's in SELECT), not full product attributes; use getProductById
// for that once a specific match is picked.
async function searchProductView(env, merchantId, whereClause) {
  if (!merchantId) throw new Error('merchantId não informado.');
  const token = await getGoogleAccessToken(env, SCOPES.CONTENT);
  const response = await fetch(`${REPORTS_BASE}/accounts/${merchantId}/reports:search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `SELECT id, offer_id, title FROM product_view WHERE ${whereClause}` })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao buscar produto via Merchant API Reports (${response.status}): ${text}`);
  }
  const data = await response.json();
  return (data.results || []).map((r) => r.productView).filter(Boolean);
}

// Escapes a value for interpolation inside a single-quoted MCQL string literal.
function escapeMcql(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Resolves a product by its exact offer id — the primary match path for runDiscovery's
// Metabase-sourced top sellers. One Reports query + one Content API fetch, regardless of
// catalog size (no listAllProducts()).
export async function findProductByOfferId(env, merchantId, offerId) {
  const rows = await searchProductView(env, merchantId, `offer_id = '${escapeMcql(offerId)}'`);
  if (!rows.length) return null;
  return getProductById(env, merchantId, rows[0].id);
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

// Scores an already-narrowed candidate list (the result of a Reports title search, or any
// small in-memory list) against a title/name to match.
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

// Finds the best title match for a product name without listing the whole catalog — one
// Reports query (each search word ANDed via a case-insensitive REGEXP_MATCH) narrows the
// candidates server-side, then matchProductByTitle's same word-overlap scoring picks the
// best one, same as the in-memory path used to. This is what both runDiscovery's fuzzy
// fallback and runDiscoveryForProduct's manual search use.
export async function findProductByTitleSearch(env, merchantId, productName) {
  const words = normalizeWords(productName);
  if (!words.length) return null;
  const clause = words.map((w) => `title REGEXP_MATCH '(?i).*${escapeMcql(w)}.*'`).join(' AND ');
  const rows = await searchProductView(env, merchantId, clause);
  if (!rows.length) return null;

  const match = matchProductByTitle(rows, productName);
  if (!match) return null;
  const full = await getProductById(env, merchantId, match.product.id);
  return { product: full, score: match.score };
}
