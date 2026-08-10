// Core workflow: pull top sellers (across all brands) from Metabase, group them by brand,
// and for each brand that's been onboarded (see brands table), match products against that
// brand's own Merchant Center account and propose perspectives for a human to review.
// No copy is generated yet at this stage — see ai.js / index.js for the accept/reject step.

import {
  ensureSchema, getSettings, listBrands, getBrand, replaceTopSellers, insertCandidate,
  activeCandidateProductIds, recordRunStart, recordRunEnd
} from './db';
import { fetchTopSellersByBrand } from './metabase';
import { findProductByOfferId, findProductByTitleSearch } from './merchant';
import { suggestPerspectives } from './ai';

export async function runDiscovery(env, { brandName } = {}) {
  const DB = env.DB;
  await ensureSchema(DB);
  const startedAt = new Date().toISOString();
  const runId = await recordRunStart(DB, startedAt, brandName);

  try {
    const settings = await getSettings(DB);
    let brands = await listBrands(DB, { onlyActive: true });
    if (!brands.length) {
      throw new Error('Nenhuma marca cadastrada/ativa. Cadastre ao menos uma marca (aba Marcas) antes de rodar a descoberta.');
    }
    if (brandName) {
      brands = brands.filter((b) => b.name === brandName);
      if (!brands.length) throw new Error(`Marca "${brandName}" não encontrada ou inativa.`);
    }
    const brandByName = new Map(brands.map((b) => [b.name, b]));

    const topSellers = await fetchTopSellersByBrand(env, settings);
    await replaceTopSellers(DB, startedAt, topSellers);

    // When scoped to one brand, sellers from other brands in the Metabase result are simply
    // out of scope for this run — not worth reporting as "skipped" (that label is for the
    // all-brands run, where it flags brands that showed up in sales but aren't onboarded yet).
    const sellersByBrand = new Map();
    const skippedBrands = new Set();
    for (const seller of topSellers) {
      if (!brandByName.has(seller.brand)) {
        if (!brandName) skippedBrands.add(seller.brand);
        continue;
      }
      if (!sellersByBrand.has(seller.brand)) sellersByBrand.set(seller.brand, []);
      sellersByBrand.get(seller.brand).push(seller);
    }

    const variantsPerProduct = parseInt(settings.variants_per_product, 10) || 3;
    let candidatesCreated = 0;
    let alreadyTracked = 0;
    let fuzzyMatched = 0;
    const skippedProducts = [];

    for (const [currentBrand, sellers] of sellersByBrand.entries()) {
      const brand = brandByName.get(currentBrand);
      // Resolved per-seller via the Reports search API (see merchant.js) instead of a
      // listAllProducts() + in-memory lookup — a catalog the size of Gocase's (~5M SKUs)
      // can't be materialized in memory, and this costs the same either way (a handful of
      // sellers per brand per run).
      const activeProductIds = await activeCandidateProductIds(DB, currentBrand);

      for (const seller of sellers) {
        if (activeProductIds.has(String(seller.merchantProductId))) {
          alreadyTracked++;
          continue;
        }
        let product = await findProductByOfferId(env, brand.merchantId, seller.merchantProductId);
        let matchMethod = product ? 'id' : null;
        if (!product) {
          // Sales-data ID doesn't exist in the Merchant Center catalog at all (e.g. Yampi
          // vs Shopify-fed catalogs have unrelated ID spaces) — fall back to matching by
          // product name before giving up on this seller entirely.
          const fuzzy = await findProductByTitleSearch(env, brand.merchantId, seller.title || '');
          if (fuzzy) { product = fuzzy.product; matchMethod = 'title'; fuzzyMatched++; }
        }
        if (!product) {
          skippedProducts.push(`${currentBrand}:${seller.merchantProductId}`);
          continue;
        }
        const perspectives = await suggestPerspectives(env, product, variantsPerProduct);
        for (let i = 0; i < perspectives.length; i++) {
          const p = perspectives[i];
          await insertCandidate(DB, {
            merchantProductId: seller.merchantProductId,
            brand: currentBrand,
            productTitle: product.title,
            productDescription: product.description,
            productLink: product.link,
            productImage: product.imageLink,
            productPrice: product.price,
            productCurrency: product.priceCurrency,
            productGtin: product.gtin,
            productGoogleCategory: product.googleProductCategory,
            variantIndex: i + 1,
            perspectiveLabel: p.label,
            perspectiveRationale: p.rationale,
            matchMethod,
            status: 'awaiting_perspective',
            createdAt: new Date().toISOString()
          });
          candidatesCreated++;
        }
      }
    }

    const details = { skippedBrands: [...skippedBrands], skippedProducts, alreadyTracked, fuzzyMatched };
    await recordRunEnd(DB, runId, {
      finishedAt: new Date().toISOString(),
      topSellersFound: topSellers.length,
      candidatesCreated,
      details
    });

    return { topSellersFound: topSellers.length, candidatesCreated, ...details };
  } catch (err) {
    await recordRunEnd(DB, runId, { finishedAt: new Date().toISOString(), error: String(err.message || err) });
    throw err;
  }
}

// Ad-hoc counterpart to runDiscovery: skips the Metabase top-sellers step entirely and
// targets one product by name instead of by sales rank — for cases where a specific product
// needs title/description variations regardless of whether it currently sells enough to
// show up in the top-sellers query (e.g. a new or low-volume launch).
export async function runDiscoveryForProduct(env, { brandName, productName } = {}) {
  if (!brandName) throw new Error('brandName é obrigatório.');
  if (!productName || !productName.trim()) throw new Error('productName é obrigatório.');

  const DB = env.DB;
  await ensureSchema(DB);
  const startedAt = new Date().toISOString();
  const runId = await recordRunStart(DB, startedAt, brandName);

  try {
    const settings = await getSettings(DB);
    const brand = await getBrand(DB, brandName);
    if (!brand || !brand.active) {
      throw new Error(`Marca "${brandName}" não encontrada ou inativa.`);
    }

    // Server-side search via the Reports API (see merchant.js) — no pre-sync needed, and
    // costs the same regardless of catalog size.
    const match = await findProductByTitleSearch(env, brand.merchantId, productName);
    if (!match) {
      throw new Error(`Nenhum produto do catálogo da marca "${brandName}" bateu com "${productName}".`);
    }
    const product = match.product;

    // Same guard as runDiscovery: don't pile on duplicate candidates for a product that
    // already has one awaiting a human decision (or already approved/pending).
    const activeProductIds = await activeCandidateProductIds(DB, brandName);
    if (activeProductIds.has(String(product.offerId))) {
      await recordRunEnd(DB, runId, {
        finishedAt: new Date().toISOString(),
        topSellersFound: 0,
        candidatesCreated: 0,
        details: { matchedProduct: product.title, matchScore: match.score, alreadyTracked: true }
      });
      return { candidatesCreated: 0, alreadyTracked: true, matchedProduct: product.title, matchScore: match.score };
    }

    const variantsPerProduct = parseInt(settings.variants_per_product, 10) || 3;
    const perspectives = await suggestPerspectives(env, product, variantsPerProduct);
    let candidatesCreated = 0;
    for (let i = 0; i < perspectives.length; i++) {
      const p = perspectives[i];
      await insertCandidate(DB, {
        merchantProductId: product.offerId,
        brand: brandName,
        productTitle: product.title,
        productDescription: product.description,
        productLink: product.link,
        productImage: product.imageLink,
        productPrice: product.price,
        productCurrency: product.priceCurrency,
        productGtin: product.gtin,
        productGoogleCategory: product.googleProductCategory,
        variantIndex: i + 1,
        perspectiveLabel: p.label,
        perspectiveRationale: p.rationale,
        matchMethod: 'manual_name',
        status: 'awaiting_perspective',
        createdAt: new Date().toISOString()
      });
      candidatesCreated++;
    }

    const details = { matchedProduct: product.title, matchScore: match.score };
    await recordRunEnd(DB, runId, {
      finishedAt: new Date().toISOString(),
      topSellersFound: 0,
      candidatesCreated,
      details
    });

    return { candidatesCreated, matchedProduct: product.title, matchScore: match.score };
  } catch (err) {
    await recordRunEnd(DB, runId, { finishedAt: new Date().toISOString(), error: String(err.message || err) });
    throw err;
  }
}
