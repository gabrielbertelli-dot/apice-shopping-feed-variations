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

export async function findProductsByOfferIds(env, merchantId, offerIds) {
  const wanted = new Set(offerIds.map(String));
  const all = await listAllProducts(env, merchantId);
  const byOfferId = new Map();
  for (const p of all) {
    if (wanted.has(String(p.offerId))) byOfferId.set(String(p.offerId), p);
  }
  return byOfferId;
}
