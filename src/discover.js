// Core workflow: pull top sellers (across all brands) from Metabase, group them by brand,
// and for each brand that's been onboarded (see brands table), match products against that
// brand's own Merchant Center account and propose perspectives for a human to review.
// No copy is generated yet at this stage — see ai.js / index.js for the accept/reject step.

import {
  ensureSchema, getSettings, listBrands, getBrand, replaceTopSellers, insertCandidate, insertCandidates,
  activeCandidateProductIds, recordRunStart, recordRunEnd, listApprovedCandidates, updateCandidate
} from './db';
import { fetchTopSellersByBrand } from './metabase';
import {
  listAllProducts, matchProductByTitle, findProductByOfferId, findProductsByOfferIds, findProductByTitleSearch
} from './merchant';
import { suggestPerspectives } from './ai';
import { queueSheetSync } from './sheets';

// Metabase's brand string and the registered brand name are two independently-typed values
// (one from the sales data warehouse, one from whoever filled the "Marcas" form) — matching
// them case-sensitively silently drops an entire brand's top sellers the moment they differ
// by case (confirmed case: Kokeshi was registered as "Kokeshi", Metabase's query returns
// "kokeshi" — every run skipped it with candidatesCreated: 0 and no visible error, since
// skippedBrands only surfaces in the all-brands run-now message, easy to miss). Also strips
// accents (NFD + drop combining marks) for the same reason: brands are now registered in
// lowercase-no-accent form (e.g. "apice", "rituaria") but Metabase's `bu` column may still
// return the accented spelling ("Ápice", "Rituária") — without this, that split would
// reproduce the exact same silent-skip bug under a different guise.
function normalizeBrandKey(name) {
  return String(name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Original-product fields the auxiliary feed (src/sheets.js) needs verbatim — never
// AI-generated, just copied through from whatever the Merchant Center product has.
// productPrice/productCurrency were missing here for a while: they got set once at
// insertCandidate time (discovery) and never again, so a candidate that sat in review
// for days/weeks could sync a stale `price` to the live feed even after a price change —
// unlike productSalePrice, which this function did already refresh. See
// refreshCandidatePriceFields below, which is what actually calls this with a freshly
// re-fetched product right before a candidate's price gets locked into the feed.
function passthroughFields(product) {
  return {
    productPrice: product.price,
    productCurrency: product.priceCurrency,
    productSalePrice: product.salePrice,
    productShortTitle: product.shortTitle,
    productType: product.productTypes && product.productTypes.length ? product.productTypes.join(' | ') : null,
    productAdditionalImageLinks: product.additionalImageLinks && product.additionalImageLinks.length
      ? product.additionalImageLinks.join(',')
      : null
  };
}

// Re-resolves a candidate's product in the brand's Merchant Center account right now — same
// id-then-title-fallback resolution runDiscovery/backfillProductFields already used, pulled
// out so both of those and refreshCandidatePriceFields share one implementation instead of
// three copies drifting apart. `catalogCache` (merchantId -> {catalog, byOfferId}) is optional
// and only helps non-largeCatalog brands avoid re-listing the whole catalog per candidate.
async function resolveCurrentProduct(env, brand, candidate, catalogCache) {
  if (brand.largeCatalog) {
    let product = await findProductByOfferId(env, brand.merchantId, candidate.merchantProductId);
    if (!product) {
      const fuzzy = await findProductByTitleSearch(env, brand.merchantId, candidate.productTitle || '');
      if (fuzzy) product = fuzzy.product;
    }
    return product;
  }

  let entry = catalogCache && catalogCache.get(brand.merchantId);
  if (!entry) {
    const catalog = await listAllProducts(env, brand.merchantId);
    entry = { catalog, byOfferId: new Map(catalog.map((p) => [String(p.offerId), p])) };
    if (catalogCache) catalogCache.set(brand.merchantId, entry);
  }
  let product = entry.byOfferId.get(String(candidate.merchantProductId));
  if (!product) {
    const fuzzy = matchProductByTitle(entry.catalog, candidate.productTitle || '');
    if (fuzzy) product = fuzzy.product;
  }
  return product;
}

// Called from index.js's /approve route, right before a candidate's status flips to
// 'approved' — that's the moment its price/sale_price get locked into the live feed sheet
// (sync-sheet just copies whatever is on the candidate row, see src/sheets.js). Without this,
// a candidate discovered days/weeks earlier would carry whatever price Merchant Center had
// back then, even if it changed since. Best-effort: callers should not block approval on this
// failing (a Merchant Center hiccup shouldn't stop a human from approving), just surface the
// error so it's visible.
export async function refreshCandidatePriceFields(env, candidate) {
  const DB = env.DB;
  const brand = await getBrand(DB, candidate.brand);
  if (!brand) throw new Error(`Marca "${candidate.brand}" não está mais cadastrada.`);
  const product = await resolveCurrentProduct(env, brand, candidate);
  if (!product) {
    throw new Error(`Produto "${candidate.productTitle}" não foi encontrado no Merchant Center — preço não pôde ser conferido.`);
  }
  await updateCandidate(DB, candidate.id, passthroughFields(product));
}

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
      brands = brands.filter((b) => normalizeBrandKey(b.name) === normalizeBrandKey(brandName));
      if (!brands.length) throw new Error(`Marca "${brandName}" não encontrada ou inativa.`);
    }
    const brandByKey = new Map(brands.map((b) => [normalizeBrandKey(b.name), b]));

    const topSellers = await fetchTopSellersByBrand(env, settings);
    await replaceTopSellers(DB, startedAt, topSellers);

    // Grouped under the registered brand's canonical name (brand.name), not Metabase's raw
    // seller.brand string — those two only need to match case/whitespace-insensitively
    // (see normalizeBrandKey), not literally, and everything downstream (candidates,
    // active-product lookups, the dashboard's brand filter) keys off the registered name.
    // When scoped to one brand, sellers from other brands in the Metabase result are simply
    // out of scope for this run — not worth reporting as "skipped" (that label is for the
    // all-brands run, where it flags brands that showed up in sales but aren't onboarded yet).
    const sellersByBrand = new Map();
    const skippedBrands = new Set();
    for (const seller of topSellers) {
      const brand = brandByKey.get(normalizeBrandKey(seller.brand));
      if (!brand) {
        if (!brandName) skippedBrands.add(seller.brand);
        continue;
      }
      if (!sellersByBrand.has(brand.name)) sellersByBrand.set(brand.name, []);
      sellersByBrand.get(brand.name).push(seller);
    }

    const variantsPerProduct = parseInt(settings.variants_per_product, 10) || 3;

    // Brands are independent of each other (different Merchant Center accounts, different
    // catalogs) — processed concurrently instead of one after another. Sequentially, each
    // non-largeCatalog brand pays for a full listAllProducts() catalog fetch (several
    // paginated Content API calls), and with ~10 brands registered that summed to 130-180s
    // wall-clock for the weekly cron, once even failing outright ("Durable Object instance
    // is no longer active" — the request just ran too long). Running them concurrently turns
    // that sum into roughly the slowest single brand's fetch time instead.
    const brandResults = await Promise.all(
      [...sellersByBrand.entries()].map(async ([currentBrand, sellers]) => {
        // One brand's exception (a Merchant Center 500, a bad merchant id, one AI call
        // timing out) used to reject the whole Promise.all, aborting the run's own
        // bookkeeping and reporting the entire run as failed — even though other brands'
        // insertCandidate writes already landed. Isolate per brand, same {brand, error}
        // aggregation shape backfillProductFields already uses below.
        try {
          return await runBrandDiscovery(env, DB, currentBrand, sellers, brandByKey, variantsPerProduct);
        } catch (err) {
          return { brand: currentBrand, error: String(err.message || err), candidatesCreated: 0, alreadyTracked: 0, fuzzyMatched: 0, skippedProducts: [] };
        }
      })
    );

    const brandErrors = brandResults.filter((r) => r.error).map((r) => ({ brand: r.brand, error: r.error }));

    let candidatesCreated = 0;
    let alreadyTracked = 0;
    let fuzzyMatched = 0;
    const skippedProducts = [];
    for (const r of brandResults) {
      candidatesCreated += r.candidatesCreated;
      alreadyTracked += r.alreadyTracked;
      fuzzyMatched += r.fuzzyMatched;
      skippedProducts.push(...r.skippedProducts);
    }

    const details = { skippedBrands: [...skippedBrands], skippedProducts, alreadyTracked, fuzzyMatched, brandErrors };
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

// One brand's worth of runDiscovery — pulled out so the Promise.all wrapper above can
// try/catch it per brand without a deeply-nested try block.
async function runBrandDiscovery(env, DB, currentBrand, sellers, brandByKey, variantsPerProduct) {
  const brand = brandByKey.get(normalizeBrandKey(currentBrand));
  const activeProductIds = await activeCandidateProductIds(DB, currentBrand);

  const pendingSellers = sellers.filter((s) => !activeProductIds.has(String(s.merchantProductId)));
  const alreadyTracked = sellers.length - pendingSellers.length;

  // Small/medium catalogs (the default — no setup required): list once per brand, match
  // in memory. Large catalogs (brand.largeCatalog, e.g. Gocase's ~5M SKUs) can't be
  // listed at all without risking the Worker's memory/execution-time limits, so all
  // pending sellers' offer ids are resolved in one batched Reports API lookup instead —
  // still no per-seller sequential query — but that path needs a one-time per-account
  // developer registration (see merchant.js), so it stays opt-in per brand rather than a
  // hard dependency for everyone.
  let catalog = null;
  let byOfferId = null;
  let largeCatalogMatches = null;
  if (!brand.largeCatalog) {
    catalog = await listAllProducts(env, brand.merchantId);
    byOfferId = new Map(catalog.map((p) => [String(p.offerId), p]));
  } else {
    largeCatalogMatches = await findProductsByOfferIds(
      env, brand.merchantId, pendingSellers.map((s) => String(s.merchantProductId))
    );
  }

  // Sellers are independent of each other (matching + suggestPerspectives, an AI call, for
  // one doesn't depend on another) — same reasoning that justified running brands
  // concurrently one level up. activeProductIds/byOfferId/catalog/largeCatalogMatches are
  // read-only here, so sharing them across the parallel sellers is safe; the actual DB
  // writes are batched once after this resolves, via insertCandidates.
  const sellerResults = await Promise.all(pendingSellers.map(async (seller) => {
    let product;
    let matchMethod;
    if (brand.largeCatalog) {
      product = largeCatalogMatches.get(String(seller.merchantProductId));
      matchMethod = product ? 'id' : null;
      if (!product) {
        const fuzzy = await findProductByTitleSearch(env, brand.merchantId, seller.title || '');
        if (fuzzy) { product = fuzzy.product; matchMethod = 'title'; }
      }
    } else {
      product = byOfferId.get(String(seller.merchantProductId));
      matchMethod = product ? 'id' : null;
      if (!product) {
        // Sales-data ID doesn't exist in the Merchant Center catalog at all (e.g. Yampi
        // vs Shopify-fed catalogs have unrelated ID spaces) — fall back to matching by
        // product name before giving up on this seller entirely.
        const fuzzy = matchProductByTitle(catalog, seller.title || '');
        if (fuzzy) { product = fuzzy.product; matchMethod = 'title'; }
      }
    }
    if (!product) {
      return { skipped: `${currentBrand}:${seller.merchantProductId}` };
    }
    const perspectives = await suggestPerspectives(env, product, variantsPerProduct);
    const candidates = perspectives.map((p, i) => ({
      merchantProductId: seller.merchantProductId,
      brand: currentBrand,
      productTitle: product.title,
      productDescription: product.description,
      productLink: product.link,
      productImage: product.imageLink,
      productPrice: product.price,
      productCurrency: product.priceCurrency,
      ...passthroughFields(product),
      productGtin: product.gtin,
      productGoogleCategory: product.googleProductCategory,
      variantIndex: i + 1,
      perspectiveLabel: p.label,
      perspectiveRationale: p.rationale,
      matchMethod,
      status: 'awaiting_perspective',
      createdAt: new Date().toISOString()
    }));
    return { candidates, fuzzyMatch: matchMethod === 'title' };
  }));

  let candidatesCreated = 0;
  let fuzzyMatched = 0;
  const skippedProducts = [];
  const allCandidates = [];
  for (const r of sellerResults) {
    if (r.skipped) { skippedProducts.push(r.skipped); continue; }
    allCandidates.push(...r.candidates);
    candidatesCreated += r.candidates.length;
    if (r.fuzzyMatch) fuzzyMatched++;
  }
  await insertCandidates(DB, allCandidates);

  return { brand: currentBrand, candidatesCreated, alreadyTracked, fuzzyMatched, skippedProducts };
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

    // Same per-brand switch as runDiscovery: large catalogs search server-side via the
    // Reports API (see merchant.js); everything else just lists + matches in memory.
    const match = brand.largeCatalog
      ? await findProductByTitleSearch(env, brand.merchantId, productName)
      : matchProductByTitle(await listAllProducts(env, brand.merchantId), productName);
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
        ...passthroughFields(product),
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

// One-off historical fixup: approved candidates created before productPrice/productSalePrice/
// productShortTitle/productType/productAdditionalImageLinks were kept fresh have those
// columns stale or empty. Re-fetches each one's current Merchant Center product and fills
// them in (via the same resolveCurrentProduct used by refreshCandidatePriceFields), then
// resyncs every affected brand's sheet so the feed actually reflects it.
export async function backfillProductFields(env, { brandName } = {}) {
  const DB = env.DB;
  await ensureSchema(DB);
  const approved = await listApprovedCandidates(DB, brandName);
  if (!approved.length) return { updated: 0, errors: [], syncResults: {} };

  const brandCache = new Map();
  const catalogCache = new Map(); // merchantId -> { catalog, byOfferId }, for non-large brands
  let updated = 0;
  const errors = [];
  const brandsToSync = new Set();

  for (const candidate of approved) {
    try {
      let brand = brandCache.get(candidate.brand);
      if (brand === undefined) {
        brand = await getBrand(DB, candidate.brand);
        brandCache.set(candidate.brand, brand);
      }
      if (!brand) { errors.push(`${candidate.brand}:${candidate.merchantProductId} — marca não encontrada`); continue; }

      // Same two-step resolution as runDiscovery: merchant_product_id is the sales-data ID
      // (Metabase), which for some brands (e.g. Yampi-sourced ones — see matchProductByTitle's
      // note) never matches the Merchant Center offerId at all, even for candidates that
      // were successfully matched at discovery time via the title fallback. Retry by title
      // (using the original product_title stored on the candidate) before giving up.
      const product = await resolveCurrentProduct(env, brand, candidate, catalogCache);
      if (!product) {
        errors.push(`${candidate.brand}:${candidate.merchantProductId} (${candidate.productTitle}) — produto não encontrado no Merchant Center`);
        continue;
      }

      await updateCandidate(DB, candidate.id, passthroughFields(product));
      updated++;
      brandsToSync.add(candidate.brand);
    } catch (err) {
      errors.push(`${candidate.brand}:${candidate.merchantProductId} — ${String(err.message || err)}`);
    }
  }

  const syncResults = {};
  // Different brands' syncs are independent (queueSheetSync only serializes within a brand),
  // same reasoning as runDiscovery's per-brand Promise.all — no need to wait for brand A's
  // sheet write before starting brand B's.
  await Promise.all([...brandsToSync].map(async (currentBrand) => {
    try {
      const brand = brandCache.get(currentBrand);
      // Queued like approve()/reject() so a backfill run doesn't race a human approving
      // something for the same brand at the same time (see sheets.js).
      syncResults[currentBrand] = await queueSheetSync(env, currentBrand, brand.sheetId, brand.sheetTabName,
        () => listApprovedCandidates(DB, currentBrand));
    } catch (err) {
      errors.push(`${currentBrand}: falha ao resincronizar planilha — ${String(err.message || err)}`);
    }
  }));

  return { updated, errors, syncResults };
}
