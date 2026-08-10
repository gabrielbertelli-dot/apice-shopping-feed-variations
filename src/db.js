// Schema and query helpers for the GoDeploy built-in SQLite (env.DB).

// DB.query's row shape isn't guaranteed to be positional arrays (some bindings return
// column-keyed objects instead) — normalize to arrays via the returned `columns` list so
// the rest of this file can destructure rows positionally either way.
export async function queryRows(DB, sql, params = []) {
  const { columns, rows } = await DB.query(sql, params);
  return rows.map((row) => (Array.isArray(row) ? row : columns.map((c) => row[c])));
}

// CREATE TABLE IF NOT EXISTS only handles brand-new tables — it does nothing for a table
// that already exists with an older column set (this app was live and tested against an
// earlier schema before some of these columns were added). This adds any column that's
// missing on an already-existing table; SQLite has no "ADD COLUMN IF NOT EXISTS", so we
// just swallow the duplicate-column error when it's already there.
async function ensureColumn(DB, table, columnName, columnDef) {
  try {
    await DB.exec(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${columnDef}`, []);
  } catch (err) {
    if (!String(err.message || err).toLowerCase().includes('duplicate column')) throw err;
  }
}

export async function ensureSchema(DB) {
  await DB.exec(`CREATE TABLE IF NOT EXISTS brands (
    name TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    sheet_tab_name TEXT NOT NULL DEFAULT 'feed',
    active INTEGER NOT NULL DEFAULT 1
  )`, []);

  // merchant_product_id alone isn't unique across brands — each brand's store assigns its
  // own product IDs independently, so two different brands can share the same ID. The old
  // single-column primary key let that collide; migrate any table still on that shape.
  const topSellersDdl = await queryRows(DB, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'top_sellers'`);
  if (topSellersDdl.length && !/PRIMARY KEY\s*\(\s*merchant_product_id\s*,\s*brand\s*\)/i.test(topSellersDdl[0][0] || '')) {
    await DB.exec('DROP TABLE top_sellers', []);
  }
  await DB.exec(`CREATE TABLE IF NOT EXISTS top_sellers (
    merchant_product_id TEXT NOT NULL,
    brand TEXT NOT NULL,
    title TEXT,
    revenue_share REAL,
    rank INTEGER,
    snapshot_date TEXT,
    PRIMARY KEY (merchant_product_id, brand)
  )`, []);

  // Lifecycle: awaiting_perspective -> pending_review -> approved | rejected.
  // The perspective (what angle to test) is decided before any copy is written:
  // the app proposes one, a human accepts it or replaces it with their own text,
  // and only then does title/description generation run for that candidate.
  await DB.exec(`CREATE TABLE IF NOT EXISTS variation_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_product_id TEXT NOT NULL,
    brand TEXT,
    product_title TEXT,
    product_description TEXT,
    product_link TEXT,
    product_image TEXT,
    product_price TEXT,
    product_currency TEXT,
    product_gtin TEXT,
    product_google_category TEXT,
    variant_index INTEGER,
    perspective_label TEXT,
    perspective_rationale TEXT,
    perspective_status TEXT NOT NULL DEFAULT 'pending',
    perspective_feedback TEXT,
    resolved_perspective TEXT,
    title_suggestion TEXT,
    description_suggestion TEXT,
    image_url TEXT,
    image_prompt TEXT,
    image_job_id TEXT,
    image_status TEXT NOT NULL DEFAULT 'none',
    image_error TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_perspective',
    created_at TEXT NOT NULL,
    approved_at TEXT
  )`, []);

  await DB.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`, []);

  await DB.exec(`CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    top_sellers_found INTEGER,
    candidates_created INTEGER,
    details TEXT,
    error TEXT
  )`, []);

  // Local mirror of each brand's Merchant Center catalog, kept in sync a page at a time by
  // the /cron/sync-catalog tick (see catalogSync.js) instead of ever listing the full live
  // catalog inside a single request — some catalogs (e.g. Gocase's phone-case catalog) are
  // large enough to blow past the Worker's memory and execution-time limits if materialized
  // in one go. Manual product-name search (runDiscoveryForProduct) reads from this table.
  await DB.exec(`CREATE TABLE IF NOT EXISTS catalog_cache (
    merchant_id TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    link TEXT,
    image_link TEXT,
    price_value REAL,
    price_currency TEXT,
    gtin TEXT,
    mpn TEXT,
    brand TEXT,
    google_product_category TEXT,
    availability TEXT,
    condition TEXT,
    updated_at TEXT,
    PRIMARY KEY (merchant_id, offer_id)
  )`, []);
  await DB.exec('CREATE INDEX IF NOT EXISTS idx_catalog_cache_title ON catalog_cache (merchant_id, title)', []);

  // Sync progress per brand's Merchant Center account — one row, advanced one page per cron
  // tick. finished_at IS NULL means "never completed a sync" (either never started, or still
  // mid-flight per in_progress); a human can force a redo via resetCatalogSyncState.
  await DB.exec(`CREATE TABLE IF NOT EXISTS catalog_sync_state (
    merchant_id TEXT PRIMARY KEY,
    brand TEXT,
    next_page_token TEXT,
    in_progress INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    finished_at TEXT,
    pages_done INTEGER NOT NULL DEFAULT 0,
    products_done INTEGER NOT NULL DEFAULT 0,
    error TEXT
  )`, []);

  // Retrofit columns for tables that may already exist from before these were introduced.
  await ensureColumn(DB, 'variation_candidates', 'product_description', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'perspective_label', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'perspective_rationale', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'perspective_status', "TEXT NOT NULL DEFAULT 'pending'");
  await ensureColumn(DB, 'variation_candidates', 'perspective_feedback', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'resolved_perspective', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'image_prompt', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'image_job_id', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'image_status', "TEXT NOT NULL DEFAULT 'none'");
  await ensureColumn(DB, 'variation_candidates', 'image_error', 'TEXT');
  await ensureColumn(DB, 'variation_candidates', 'match_method', 'TEXT');
  await ensureColumn(DB, 'runs', 'details', 'TEXT');
  await ensureColumn(DB, 'runs', 'brand', 'TEXT');
}

const DEFAULT_SETTINGS = {
  top_n_per_brand: '3',
  sales_window_days: '90',
  metabase_card_id: '',
  metabase_col_id: '',
  metabase_col_brand: '',
  metabase_col_title: '',
  metabase_col_share: '',
  variants_per_product: '3'
};

export async function getSettings(DB) {
  const rows = await queryRows(DB, 'SELECT key, value FROM settings');
  const settings = { ...DEFAULT_SETTINGS };
  for (const [key, value] of rows) settings[key] = value;
  return settings;
}

export async function setSetting(DB, key, value) {
  await DB.exec(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

// --- Brands (one Merchant Center account + one Google Sheet feed per brand/client) ---

function rowToBrand(row) {
  const [name, merchant_id, sheet_id, sheet_tab_name, active] = row;
  return { name, merchantId: merchant_id, sheetId: sheet_id, sheetTabName: sheet_tab_name, active: !!active };
}

export async function listBrands(DB, { onlyActive } = {}) {
  const rows = await queryRows(
    DB,
    onlyActive
      ? 'SELECT name, merchant_id, sheet_id, sheet_tab_name, active FROM brands WHERE active = 1 ORDER BY name'
      : 'SELECT name, merchant_id, sheet_id, sheet_tab_name, active FROM brands ORDER BY name'
  );
  return rows.map(rowToBrand);
}

export async function getBrand(DB, name) {
  const rows = await queryRows(
    DB,
    'SELECT name, merchant_id, sheet_id, sheet_tab_name, active FROM brands WHERE name = ?',
    [name]
  );
  return rows.length ? rowToBrand(rows[0]) : null;
}

export async function upsertBrand(DB, brand) {
  await DB.exec(
    `INSERT INTO brands (name, merchant_id, sheet_id, sheet_tab_name, active)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       merchant_id = excluded.merchant_id,
       sheet_id = excluded.sheet_id,
       sheet_tab_name = excluded.sheet_tab_name,
       active = excluded.active`,
    [brand.name, brand.merchantId, brand.sheetId, brand.sheetTabName || 'feed', brand.active === false ? 0 : 1]
  );
}

export async function deleteBrand(DB, name) {
  await DB.exec('DELETE FROM brands WHERE name = ?', [name]);
}

// --- Top sellers snapshot ---

export async function replaceTopSellers(DB, snapshotDate, sellers) {
  await DB.exec('DELETE FROM top_sellers', []);
  for (const s of sellers) {
    await DB.exec(
      `INSERT OR REPLACE INTO top_sellers (merchant_product_id, brand, title, revenue_share, rank, snapshot_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [s.merchantProductId, s.brand, s.title || null, s.revenueShare ?? null, s.rank, snapshotDate]
    );
  }
}

export async function listTopSellers(DB) {
  const rows = await queryRows(
    DB,
    'SELECT merchant_product_id, brand, title, revenue_share, rank, snapshot_date FROM top_sellers ORDER BY brand, rank'
  );
  return rows.map(([merchant_product_id, brand, title, revenue_share, rank, snapshot_date]) => ({
    merchantProductId: merchant_product_id,
    brand,
    title,
    revenueShare: revenue_share,
    rank,
    snapshotDate: snapshot_date
  }));
}

// --- Variation candidates ---

export async function insertCandidate(DB, c) {
  await DB.exec(
    `INSERT INTO variation_candidates
      (merchant_product_id, brand, product_title, product_description, product_link, product_image, product_price,
       product_currency, product_gtin, product_google_category, variant_index, perspective_label, perspective_rationale,
       match_method, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.merchantProductId, c.brand, c.productTitle, c.productDescription || null, c.productLink, c.productImage,
      c.productPrice, c.productCurrency, c.productGtin, c.productGoogleCategory, c.variantIndex,
      c.perspectiveLabel, c.perspectiveRationale || null, c.matchMethod || null, c.status || 'awaiting_perspective', c.createdAt
    ]
  );
}

const CANDIDATE_COLUMNS = `id, merchant_product_id, brand, product_title, product_description, product_link, product_image,
  product_price, product_currency, product_gtin, product_google_category, variant_index, perspective_label,
  perspective_rationale, match_method, perspective_status, perspective_feedback, resolved_perspective, title_suggestion,
  description_suggestion, image_url, image_prompt, image_job_id, image_status, image_error, status, created_at, approved_at`;

function rowToCandidate(row) {
  const [
    id, merchant_product_id, brand, product_title, product_description, product_link, product_image, product_price,
    product_currency, product_gtin, product_google_category, variant_index, perspective_label, perspective_rationale,
    match_method, perspective_status, perspective_feedback, resolved_perspective, title_suggestion,
    description_suggestion, image_url, image_prompt, image_job_id, image_status, image_error, status, created_at, approved_at
  ] = row;
  return {
    id, merchantProductId: merchant_product_id, brand, productTitle: product_title,
    productDescription: product_description, productLink: product_link,
    productImage: product_image, productPrice: product_price, productCurrency: product_currency,
    productGtin: product_gtin, productGoogleCategory: product_google_category, variantIndex: variant_index,
    perspectiveLabel: perspective_label, perspectiveRationale: perspective_rationale, matchMethod: match_method,
    perspectiveStatus: perspective_status, perspectiveFeedback: perspective_feedback,
    resolvedPerspective: resolved_perspective, titleSuggestion: title_suggestion,
    descriptionSuggestion: description_suggestion, imageUrl: image_url, imagePrompt: image_prompt,
    imageJobId: image_job_id, imageStatus: image_status, imageError: image_error, status, createdAt: created_at,
    approvedAt: approved_at
  };
}

export async function listCandidates(DB, { status, brand } = {}) {
  const clauses = [];
  const params = [];
  if (status) { clauses.push('status = ?'); params.push(status); }
  if (brand) { clauses.push('brand = ?'); params.push(brand); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await queryRows(
    DB,
    `SELECT ${CANDIDATE_COLUMNS} FROM variation_candidates ${where} ORDER BY brand, merchant_product_id, variant_index`,
    params
  );
  return rows.map(rowToCandidate);
}

// Products with a non-rejected candidate already in flight — discover.js uses this to
// skip re-proposing variations for a product it already asked a human to review.
export async function activeCandidateProductIds(DB, brand) {
  const rows = await queryRows(
    DB,
    "SELECT DISTINCT merchant_product_id FROM variation_candidates WHERE brand = ? AND status != 'rejected'",
    [brand]
  );
  return new Set(rows.map((r) => String(r[0])));
}

export async function getCandidate(DB, id) {
  const rows = await queryRows(DB, `SELECT ${CANDIDATE_COLUMNS} FROM variation_candidates WHERE id = ?`, [id]);
  return rows.length ? rowToCandidate(rows[0]) : null;
}

const CANDIDATE_COLUMN_MAP = {
  titleSuggestion: 'title_suggestion',
  descriptionSuggestion: 'description_suggestion',
  imageUrl: 'image_url',
  imagePrompt: 'image_prompt',
  imageJobId: 'image_job_id',
  imageStatus: 'image_status',
  imageError: 'image_error',
  status: 'status',
  approvedAt: 'approved_at',
  perspectiveStatus: 'perspective_status',
  perspectiveFeedback: 'perspective_feedback',
  resolvedPerspective: 'resolved_perspective'
};

export async function updateCandidate(DB, id, fields) {
  const sets = [];
  const values = [];
  for (const [k, v] of Object.entries(fields)) {
    const col = CANDIDATE_COLUMN_MAP[k];
    if (col) {
      sets.push(`${col} = ?`);
      values.push(v);
    }
  }
  if (!sets.length) return;
  values.push(id);
  await DB.exec(`UPDATE variation_candidates SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function listApprovedCandidates(DB, brand) {
  return listCandidates(DB, { status: 'approved', brand });
}

// --- Runs ---

export async function recordRunStart(DB, startedAt, brand) {
  const result = await DB.exec('INSERT INTO runs (started_at, brand) VALUES (?, ?)', [startedAt, brand || null]);
  return result.rowsWritten ? await lastRunId(DB) : null;
}

async function lastRunId(DB) {
  const rows = await queryRows(DB, 'SELECT id FROM runs ORDER BY id DESC LIMIT 1');
  return rows.length ? rows[0][0] : null;
}

export async function recordRunEnd(DB, runId, fields) {
  await DB.exec(
    'UPDATE runs SET finished_at = ?, top_sellers_found = ?, candidates_created = ?, details = ?, error = ? WHERE id = ?',
    [
      fields.finishedAt, fields.topSellersFound ?? null, fields.candidatesCreated ?? null,
      fields.details ? JSON.stringify(fields.details) : null, fields.error ?? null, runId
    ]
  );
}

// --- Catalog cache (local mirror of Merchant Center, synced incrementally — see catalogSync.js) ---

// Batches the INSERT so one call can upsert a whole page (~250 products) without one
// exec() round trip per row, while keeping each statement's bound-parameter count under
// this platform's limit. Confirmed the hard way (via the diagnostic wrapping below):
// BATCH=50 (750 params) AND BATCH=20 (300 params) both hit "too many SQL variables",
// failing partway through the very first statement — consistent with Cloudflare D1's
// documented ~100-bound-parameters-per-statement cap, much lower than vanilla SQLite's
// default of 999. 6 rows × 15 cols = 90 params, comfortably under that.
export async function upsertCatalogProducts(DB, merchantId, products) {
  if (!products.length) return;
  const now = new Date().toISOString();
  const BATCH = 6;
  for (let i = 0; i < products.length; i += BATCH) {
    const chunk = products.slice(i, i + BATCH);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = [];
    for (const p of chunk) {
      params.push(
        merchantId, p.offerId, p.title, p.description || null, p.link, p.imageLink,
        p.priceValue ?? null, p.priceCurrency ?? null, p.gtin, p.mpn, p.brand,
        p.googleProductCategory, p.availability, p.condition, now
      );
    }
    try {
      await DB.exec(
        `INSERT INTO catalog_cache
          (merchant_id, offer_id, title, description, link, image_link, price_value, price_currency,
           gtin, mpn, brand, google_product_category, availability, condition, updated_at)
         VALUES ${placeholders}
         ON CONFLICT(merchant_id, offer_id) DO UPDATE SET
           title = excluded.title, description = excluded.description, link = excluded.link,
           image_link = excluded.image_link, price_value = excluded.price_value,
           price_currency = excluded.price_currency, gtin = excluded.gtin, mpn = excluded.mpn,
           brand = excluded.brand, google_product_category = excluded.google_product_category,
           availability = excluded.availability, condition = excluded.condition, updated_at = excluded.updated_at`,
        params
      );
    } catch (err) {
      // Temporary diagnostic context (batch offset within this call, row/param counts) —
      // narrows down whether the platform's SQL variable cap is per-statement or
      // accumulated across every DB.exec() call made within one request.
      throw new Error(`upsertCatalogProducts failed at row ${i}-${i + chunk.length} (${params.length} params this call): ${err.message || err}`);
    }
  }
}

// Narrows the catalog_cache down to rows whose title contains at least one of the given
// (already-normalized) search words before any scoring happens — keeps the result set (and
// therefore memory) small regardless of how big the underlying catalog is. Final scoring is
// still merchant.js's matchProductByTitle(), same as the in-memory path used for small brands.
export async function searchCatalogCandidates(DB, merchantId, words) {
  if (!words.length) return [];
  const clauses = words.map(() => 'title LIKE ?').join(' OR ');
  const params = [merchantId, ...words.map((w) => `%${w}%`)];
  const rows = await queryRows(
    DB,
    `SELECT offer_id, title, description, link, image_link, price_value, price_currency, gtin, mpn,
       brand, google_product_category, availability, condition
     FROM catalog_cache WHERE merchant_id = ? AND (${clauses}) LIMIT 500`,
    params
  );
  return rows.map(([
    offer_id, title, description, link, image_link, price_value, price_currency, gtin, mpn,
    brand, google_product_category, availability, condition
  ]) => ({
    offerId: offer_id, title, description, link, imageLink: image_link,
    price: price_value != null ? `${price_value} ${price_currency}` : null,
    priceValue: price_value, priceCurrency: price_currency, gtin, mpn, brand,
    googleProductCategory: google_product_category, availability, condition
  }));
}

function rowToCatalogSyncState(row) {
  const [merchant_id, brand, next_page_token, in_progress, started_at, finished_at, pages_done, products_done, error] = row;
  return {
    merchantId: merchant_id, brand, nextPageToken: next_page_token, inProgress: !!in_progress,
    startedAt: started_at, finishedAt: finished_at, pagesDone: pages_done, productsDone: products_done, error
  };
}

const CATALOG_SYNC_COLUMNS = 'merchant_id, brand, next_page_token, in_progress, started_at, finished_at, pages_done, products_done, error';

export async function getCatalogSyncState(DB, merchantId) {
  const rows = await queryRows(DB, `SELECT ${CATALOG_SYNC_COLUMNS} FROM catalog_sync_state WHERE merchant_id = ?`, [merchantId]);
  return rows.length ? rowToCatalogSyncState(rows[0]) : null;
}

export async function listCatalogSyncStates(DB) {
  const rows = await queryRows(DB, `SELECT ${CATALOG_SYNC_COLUMNS} FROM catalog_sync_state ORDER BY brand`);
  return rows.map(rowToCatalogSyncState);
}

// Full replace (not a partial patch like updateCandidate) — the row is small and only ever
// written by the single-threaded sync tick, so there's no risk of clobbering a concurrent edit.
export async function upsertCatalogSyncState(DB, merchantId, brand, fields) {
  const current = (await getCatalogSyncState(DB, merchantId)) || {};
  const merged = { ...current, ...fields };
  await DB.exec(
    `INSERT INTO catalog_sync_state
      (merchant_id, brand, next_page_token, in_progress, started_at, finished_at, pages_done, products_done, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(merchant_id) DO UPDATE SET
       brand = excluded.brand, next_page_token = excluded.next_page_token, in_progress = excluded.in_progress,
       started_at = excluded.started_at, finished_at = excluded.finished_at, pages_done = excluded.pages_done,
       products_done = excluded.products_done, error = excluded.error`,
    [
      merchantId, brand, merged.nextPageToken ?? null, merged.inProgress ? 1 : 0, merged.startedAt ?? null,
      merged.finishedAt ?? null, merged.pagesDone ?? 0, merged.productsDone ?? 0, merged.error ?? null
    ]
  );
}

// Forces a from-scratch resync on the next cron tick(s) — used when a human explicitly asks
// to refresh a brand's catalog (new products won't otherwise be picked up once finished_at
// is set, since the cron only advances brands that haven't completed a sync yet).
export async function resetCatalogSyncState(DB, merchantId, brand) {
  await upsertCatalogSyncState(DB, merchantId, brand, {
    nextPageToken: null, inProgress: false, startedAt: new Date().toISOString(), finishedAt: null,
    pagesDone: 0, productsDone: 0, error: null
  });
}

export async function listRuns(DB, limit = 20) {
  const rows = await queryRows(
    DB,
    'SELECT id, started_at, finished_at, top_sellers_found, candidates_created, details, error, brand FROM runs ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows.map(([id, started_at, finished_at, top_sellers_found, candidates_created, details, error, brand]) => ({
    id, startedAt: started_at, finishedAt: finished_at, topSellersFound: top_sellers_found,
    candidatesCreated: candidates_created, details: details ? JSON.parse(details) : null, error, brand
  }));
}
