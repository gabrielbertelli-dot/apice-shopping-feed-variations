// Core workflow: pull top sellers (across all brands) from Metabase, group them by brand,
// and for each brand that's been onboarded (see brands table), match products against that
// brand's own Merchant Center account and propose perspectives for a human to review.
// No copy is generated yet at this stage — see ai.js / index.js for the accept/reject step.

import { ensureSchema, getSettings, listBrands, replaceTopSellers, insertCandidate, recordRunStart, recordRunEnd } from './db';
import { fetchTopSellersByBrand } from './metabase';
import { findProductsByOfferIds } from './merchant';
import { suggestPerspectives } from './ai';

export async function runDiscovery(env) {
  const DB = env.DB;
  await ensureSchema(DB);
  const startedAt = new Date().toISOString();
  const runId = await recordRunStart(DB, startedAt);

  try {
    const settings = await getSettings(DB);
    const brands = await listBrands(DB, { onlyActive: true });
    if (!brands.length) {
      throw new Error('Nenhuma marca cadastrada/ativa. Cadastre ao menos uma marca (aba Marcas) antes de rodar a descoberta.');
    }
    const brandByName = new Map(brands.map((b) => [b.name, b]));

    const topSellers = await fetchTopSellersByBrand(env, settings);
    await replaceTopSellers(DB, startedAt, topSellers);

    const sellersByBrand = new Map();
    const skippedBrands = new Set();
    for (const seller of topSellers) {
      if (!brandByName.has(seller.brand)) {
        skippedBrands.add(seller.brand);
        continue;
      }
      if (!sellersByBrand.has(seller.brand)) sellersByBrand.set(seller.brand, []);
      sellersByBrand.get(seller.brand).push(seller);
    }

    const variantsPerProduct = parseInt(settings.variants_per_product, 10) || 3;
    let candidatesCreated = 0;
    const skippedProducts = [];

    for (const [brandName, sellers] of sellersByBrand.entries()) {
      const brand = brandByName.get(brandName);
      const offerIds = sellers.map((s) => s.merchantProductId);
      const productMap = await findProductsByOfferIds(env, brand.merchantId, offerIds);

      for (const seller of sellers) {
        const product = productMap.get(String(seller.merchantProductId));
        if (!product) {
          skippedProducts.push(`${brandName}:${seller.merchantProductId}`);
          continue;
        }
        const perspectives = await suggestPerspectives(env, product, variantsPerProduct);
        for (let i = 0; i < perspectives.length; i++) {
          const p = perspectives[i];
          await insertCandidate(DB, {
            merchantProductId: seller.merchantProductId,
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
            status: 'awaiting_perspective',
            createdAt: new Date().toISOString()
          });
          candidatesCreated++;
        }
      }
    }

    const details = { skippedBrands: [...skippedBrands], skippedProducts };
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
