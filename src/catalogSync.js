// Keeps catalog_cache (see db.js) as a local mirror of each active brand's Merchant Center
// catalog, synced a few pages at a time via a GoDeploy cron tick instead of ever paginating
// the live Content API inside a single product-search request. A single request that scans
// a large catalog end-to-end (confirmed case: Gocase's phone-case catalog) risks both the
// Worker's memory limit (materializing everything) and its execution-time limit (hundreds of
// sequential HTTP calls to Google) — spreading the work across many small ticks avoids both.
// Triggered by POST /cron/sync-catalog (index.js), on a 1-minute cron schedule.

import { listBrands, getCatalogSyncState, upsertCatalogSyncState, upsertCatalogProducts } from './db';
import { fetchProductsPage } from './merchant';

// How many pages to pull per tick for the chosen brand. Each page is one sequential HTTP
// round trip to the Content API, so this bounds a single tick to a handful of seconds —
// comfortably inside the platform's execution-time limit — while still finishing a sync
// faster than one page per minute would.
const PAGES_PER_TICK = 5;

export async function runCatalogSyncTick(env) {
  const DB = env.DB;
  const brands = await listBrands(DB, { onlyActive: true });
  if (!brands.length) return { skipped: 'sem marcas ativas' };

  // Make sure every active brand has a state row (first tick ever, or a brand added since).
  const states = [];
  for (const brand of brands) {
    let state = await getCatalogSyncState(DB, brand.merchantId);
    if (!state) {
      await upsertCatalogSyncState(DB, brand.merchantId, brand.name, {
        nextPageToken: null, inProgress: false, finishedAt: null, pagesDone: 0, productsDone: 0
      });
      state = await getCatalogSyncState(DB, brand.merchantId);
    }
    states.push(state);
  }

  // Prefer resuming a sync already mid-flight (so one brand finishes before another starts);
  // otherwise the first pending brand. Brands with a stored error are deprioritized behind
  // any brand that hasn't hit one yet — otherwise a brand that fails once (e.g. a transient
  // API error) would keep getting picked first forever (alphabetically or by insertion
  // order) and starve every other brand's sync. They're still retried eventually, just last.
  // Brands that already finished are left untouched until a human explicitly asks for a
  // resync (see resetCatalogSyncState) — the cron shouldn't silently re-download a finished
  // catalog.
  const target = states.find((s) => s.inProgress && !s.finishedAt && !s.error)
    || states.find((s) => !s.finishedAt && !s.error)
    || states.find((s) => !s.finishedAt);
  if (!target) return { skipped: 'todos os catálogos já sincronizados' };

  try {
    let pageToken = target.nextPageToken || undefined;
    let pagesDone = target.pagesDone || 0;
    let productsDone = target.productsDone || 0;
    let finished = false;

    for (let i = 0; i < PAGES_PER_TICK; i++) {
      const page = await fetchProductsPage(env, target.merchantId, pageToken);
      await upsertCatalogProducts(DB, target.merchantId, page.products);
      pagesDone++;
      productsDone += page.products.length;
      pageToken = page.nextPageToken || undefined;
      if (!pageToken) { finished = true; break; }
    }

    await upsertCatalogSyncState(DB, target.merchantId, target.brand, {
      nextPageToken: pageToken || null,
      inProgress: !finished,
      startedAt: target.startedAt || new Date().toISOString(),
      finishedAt: finished ? new Date().toISOString() : null,
      pagesDone,
      productsDone,
      error: null
    });

    return { brand: target.brand, pagesDone, productsDone, finished };
  } catch (err) {
    await upsertCatalogSyncState(DB, target.merchantId, target.brand, { error: String(err.message || err) });
    throw err;
  }
}
