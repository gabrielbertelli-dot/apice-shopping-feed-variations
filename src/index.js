import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  ensureSchema, getSettings, setSetting, listCandidates, getCandidate,
  updateCandidate, listApprovedCandidates, listRuns,
  listBrands, upsertBrand, deleteBrand, getBrand, queryRows,
  listCatalogSyncStates, resetCatalogSyncState
} from './db';
import { runDiscovery, runDiscoveryForProduct } from './discover';
import { runCatalogSyncTick } from './catalogSync';
import { syncApprovedFeed } from './sheets';
import { generateCopyForPerspective, suggestPainAndResult } from './ai';
import { submitImageJob, checkJobs, buildImagePrompt, buildBeforeAfterImagePrompt } from './piapp';
import { DASHBOARD_HTML } from './dashboard';
import {
  SESSION_COOKIE, STATE_COOKIE, isAllowedEmail, createSessionToken, verifySessionToken,
  googleAuthUrl, exchangeCodeForToken, fetchGoogleUserinfo
} from './auth';

const app = new Hono();

function redirectUriFor(c) {
  return new URL('/auth/google/callback', c.req.url).toString();
}

app.get('/auth/google', (c) => {
  const state = crypto.randomUUID();
  setCookie(c, STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600, path: '/' });
  return c.redirect(googleAuthUrl(c.env, state, redirectUriFor(c)));
});

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const expectedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: '/' });

  if (!code || !state || !expectedState || state !== expectedState) {
    return c.text('Falha na autenticação (state inválido). Tente entrar novamente pelo link.', 400);
  }
  try {
    const tokens = await exchangeCodeForToken(c.env, code, redirectUriFor(c));
    const userinfo = await fetchGoogleUserinfo(tokens.access_token);
    if (!userinfo.email_verified || !isAllowedEmail(userinfo.email)) {
      return c.text(`Acesso restrito a e-mails @gocase.com.br e @gobeaute.com.br. Você entrou como ${userinfo.email}.`, 403);
    }
    const token = await createSessionToken(c.env.SESSION_SECRET, userinfo.email);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7, path: '/'
    });
    return c.redirect('/');
  } catch (err) {
    return c.text(`Erro no login: ${String(err.message || err)}`, 500);
  }
});

app.get('/auth/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/');
});

async function requireSession(c) {
  const token = getCookie(c, SESSION_COOKIE);
  const session = token && await verifySessionToken(c.env.SESSION_SECRET, token);
  if (session) c.set('userEmail', session.email);
  return session;
}

app.use('/', async (c, next) => {
  if (!(await requireSession(c))) return c.redirect('/auth/google');
  return next();
});
app.use('/api/*', async (c, next) => {
  if (!(await requireSession(c))) return c.json({ error: 'not_authenticated' }, 401);
  return next();
});

app.get('/', (c) => c.html(DASHBOARD_HTML));

app.get('/api/status', async (c) => {
  const DB = c.env.DB;
  const brandFilter = c.req.query('brand') || undefined;
  await ensureSchema(DB);
  const settings = await getSettings(DB);
  const brands = await listBrands(DB);
  const awaitingPerspective = await listCandidates(DB, { status: 'awaiting_perspective', brand: brandFilter });
  const pending = await listCandidates(DB, { status: 'pending_review', brand: brandFilter });
  const approved = await listCandidates(DB, { status: 'approved', brand: brandFilter });
  const runs = await listRuns(DB, 1);
  const topSellerRows = brandFilter
    ? await queryRows(DB, 'SELECT COUNT(*) FROM top_sellers WHERE brand = ?', [brandFilter])
    : await queryRows(DB, 'SELECT COUNT(*) FROM top_sellers');

  return c.json({
    userEmail: c.get('userEmail'),
    configured: {
      METABASE: !!(c.env.METABASE_URL && c.env.METABASE_API_KEY),
      GOOGLE_SERVICE_ACCOUNT: !!c.env.GOOGLE_SERVICE_ACCOUNT_JSON,
      AI_PROXY_TOKEN: !!c.env.AI_PROXY_TOKEN,
      PIAPP_API_KEY: !!c.env.PIAPP_API_KEY,
      metabase_card_id: !!settings.metabase_card_id,
      brands_cadastradas: brands.length > 0
    },
    settings,
    brandsCount: brands.length,
    awaitingPerspectiveCount: awaitingPerspective.length,
    pendingCount: pending.length,
    approvedCount: approved.length,
    topSellersCount: topSellerRows[0][0],
    lastRun: runs[0] || null
  });
});

app.get('/api/settings', async (c) => {
  await ensureSchema(c.env.DB);
  return c.json(await getSettings(c.env.DB));
});

app.post('/api/settings', async (c) => {
  await ensureSchema(c.env.DB);
  const { key, value } = await c.req.json();
  if (!key) return c.json({ error: 'key é obrigatório' }, 400);
  await setSetting(c.env.DB, key, value ?? '');
  return c.json({ ok: true });
});

// --- Brands: one Merchant Center account + one Google Sheet feed per brand/client ---

app.get('/api/brands', async (c) => {
  await ensureSchema(c.env.DB);
  return c.json(await listBrands(c.env.DB));
});

app.post('/api/brands', async (c) => {
  await ensureSchema(c.env.DB);
  const body = await c.req.json();
  if (!body.name || !body.merchantId || !body.sheetId) {
    return c.json({ error: 'name, merchantId e sheetId são obrigatórios' }, 400);
  }
  await upsertBrand(c.env.DB, body);
  return c.json({ ok: true });
});

app.delete('/api/brands/:name', async (c) => {
  await ensureSchema(c.env.DB);
  await deleteBrand(c.env.DB, c.req.param('name'));
  return c.json({ ok: true });
});

// --- Catalog cache sync (see catalogSync.js) ---

app.get('/api/catalog-sync-status', async (c) => {
  await ensureSchema(c.env.DB);
  return c.json(await listCatalogSyncStates(c.env.DB));
});

// Forces a from-scratch resync on the next cron tick(s) — doesn't sync synchronously here,
// since a full catalog can take many ticks; the dashboard polls /api/catalog-sync-status
// for progress instead.
app.post('/api/brands/:name/resync-catalog', async (c) => {
  await ensureSchema(c.env.DB);
  const brand = await getBrand(c.env.DB, c.req.param('name'));
  if (!brand) return c.json({ error: 'marca não encontrada' }, 404);
  await resetCatalogSyncState(c.env.DB, brand.merchantId, brand.name);
  return c.json({ ok: true });
});

// --- Candidates: perspective stage, then copy review stage ---

app.get('/api/candidates', async (c) => {
  await ensureSchema(c.env.DB);
  const status = c.req.query('status');
  const brand = c.req.query('brand');
  return c.json(await listCandidates(c.env.DB, { status, brand }));
});

app.patch('/api/candidates/:id', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const fields = await c.req.json();
  await updateCandidate(c.env.DB, id, fields);
  return c.json({ ok: true });
});

// Human accepts the AI-suggested perspective as-is -> generate copy for it right away.
app.post('/api/candidates/:id/perspective/accept', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);

  const copy = await generateCopyForPerspective(c.env, {
    brand: candidate.brand,
    title: candidate.productTitle,
    description: candidate.productDescription,
    googleProductCategory: candidate.productGoogleCategory,
    price: candidate.productPrice
  }, candidate.perspectiveLabel);

  await updateCandidate(c.env.DB, id, {
    perspectiveStatus: 'accepted',
    resolvedPerspective: candidate.perspectiveLabel,
    titleSuggestion: copy.title,
    descriptionSuggestion: copy.description,
    status: 'pending_review'
  });
  return c.json({ ok: true });
});

// Human rejects the AI-suggested perspective and describes what they want tested instead.
app.post('/api/candidates/:id/perspective/reject', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const { feedback } = await c.req.json();
  if (!feedback || !feedback.trim()) {
    return c.json({ error: 'Descreva a perspectiva que prefere testar.' }, 400);
  }
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);

  const copy = await generateCopyForPerspective(c.env, {
    brand: candidate.brand,
    title: candidate.productTitle,
    description: candidate.productDescription,
    googleProductCategory: candidate.productGoogleCategory,
    price: candidate.productPrice
  }, feedback);

  await updateCandidate(c.env.DB, id, {
    perspectiveStatus: 'rejected',
    perspectiveFeedback: feedback,
    resolvedPerspective: feedback,
    titleSuggestion: copy.title,
    descriptionSuggestion: copy.description,
    status: 'pending_review'
  });
  return c.json({ ok: true });
});

// Suggested starting prompt for the editable prompt box in the dashboard — the human can
// tweak it (add/remove attributes, change the scene) before spending a generation on it.
// mode=before_after asks the AI for the specific pain/result this product addresses first
// (costs a cheap text call); the default mode is purely mechanical, no AI call needed.
app.get('/api/candidates/:id/image-prompt', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);
  const perspective = candidate.resolvedPerspective || candidate.perspectiveLabel;

  if (c.req.query('mode') === 'before_after') {
    try {
      const { before, after } = await suggestPainAndResult(c.env, candidate, perspective);
      return c.json({ prompt: buildBeforeAfterImagePrompt(candidate, perspective, before, after) });
    } catch (err) {
      return c.json({ error: String(err.message || err) }, 500);
    }
  }

  const prompt = candidate.imagePrompt || buildImagePrompt(candidate, perspective);
  return c.json({ prompt });
});

// Kicks off a PiApp image generation job for this candidate (costs team credits — the
// human triggers this deliberately per candidate, it's never called automatically by the
// cron/discovery flow). Accepts an optional custom prompt from the dashboard's prompt box;
// falls back to the auto-built one. Result lands in imageStatus='preview' for review —
// NOT considered final until the human explicitly approves it (see .../image/approve).
app.post('/api/candidates/:id/generate-image', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const prompt = (body.prompt && body.prompt.trim())
    || buildImagePrompt(candidate, candidate.resolvedPerspective || candidate.perspectiveLabel);

  try {
    const job = await submitImageJob(c.env, {
      prompt,
      aspectRatio: '1:1',
      quality: 'standard',
      referenceImageUrls: candidate.productImage ? [candidate.productImage] : undefined
    });
    await updateCandidate(c.env.DB, id, {
      imagePrompt: prompt, imageJobId: job.jobId, imageStatus: 'processing', imageError: null
    });
    return c.json({ ok: true, jobId: job.jobId, estimatedTime: job.estimatedTime });
  } catch (err) {
    await updateCandidate(c.env.DB, id, { imagePrompt: prompt, imageStatus: 'failed', imageError: String(err.message || err) });
    return c.json({ error: String(err.message || err) }, 500);
  }
});

// Dashboard polls this while imageStatus === 'processing' — no cron needed, PiApp jobs
// finish in well under the length of one review session (~30-120s per its own estimate).
// Landing status is 'preview', not 'completed' — the image still needs human approval
// before it's eligible to go into the feed (see approve() below, which refuses otherwise).
app.post('/api/candidates/:id/check-image', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);

  if (candidate.imageStatus !== 'processing' || !candidate.imageJobId) {
    return c.json({ imageStatus: candidate.imageStatus, imageUrl: candidate.imageUrl });
  }

  try {
    const [job] = await checkJobs(c.env, [candidate.imageJobId]);
    if (job && job.status === 'completed') {
      await updateCandidate(c.env.DB, id, { imageUrl: job.outputUrl, imageStatus: 'preview', imageError: null });
      return c.json({ imageStatus: 'preview', imageUrl: job.outputUrl });
    }
    // Only treat an explicit failure/error status as failed — PiApp's set of in-progress
    // status strings isn't fully documented on our side, so anything else (including a
    // missing job record, which can happen right after submission) is assumed still running
    // rather than reported as a false failure. The dashboard caps how long it polls.
    if (job && /fail|error/i.test(job.status || '')) {
      await updateCandidate(c.env.DB, id, { imageStatus: 'failed', imageError: job.error || `status: ${job.status}` });
      return c.json({ imageStatus: 'failed', imageError: job.error });
    }
    return c.json({ imageStatus: 'processing' });
  } catch (err) {
    await updateCandidate(c.env.DB, id, { imageStatus: 'failed', imageError: String(err.message || err) });
    return c.json({ imageStatus: 'failed', imageError: String(err.message || err) }, 500);
  }
});

// Human looked at the preview and accepted it — only now is the image considered final.
app.post('/api/candidates/:id/image/approve', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);
  if (candidate.imageStatus !== 'preview') {
    return c.json({ error: 'Não há preview pendente de aprovação para esta imagem.' }, 400);
  }
  await updateCandidate(c.env.DB, id, { imageStatus: 'approved' });
  return c.json({ ok: true });
});

app.post('/api/candidates/:id/approve', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);
  if (candidate.imageStatus === 'preview') {
    return c.json({ error: 'Aprove ou descarte a imagem gerada antes de aprovar o candidato.' }, 400);
  }
  if (candidate.imageStatus === 'processing') {
    return c.json({ error: 'Ainda gerando a imagem — aguarde terminar antes de aprovar.' }, 400);
  }

  await updateCandidate(c.env.DB, id, { status: 'approved', approvedAt: new Date().toISOString() });

  try {
    const brand = await getBrand(c.env.DB, candidate.brand);
    if (!brand) throw new Error(`Marca "${candidate.brand}" não está mais cadastrada.`);
    const approved = await listApprovedCandidates(c.env.DB, candidate.brand);
    const result = await syncApprovedFeed(c.env, brand.sheetId, brand.sheetTabName, approved);
    return c.json({ ok: true, sheet: result });
  } catch (err) {
    return c.json({ ok: true, sheetError: String(err.message || err) });
  }
});

app.post('/api/candidates/:id/reject', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  await updateCandidate(c.env.DB, id, { status: 'rejected' });
  return c.json({ ok: true });
});

app.get('/api/runs', async (c) => {
  await ensureSchema(c.env.DB);
  return c.json(await listRuns(c.env.DB));
});

app.post('/api/discover-now', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await runDiscovery(c.env, { brandName: body.brand || undefined });
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err.message || err) }, 500);
  }
});

// Bypasses the Metabase top-sellers query entirely — targets one product by name for a
// given brand, regardless of its sales volume. Used to onboard a specific launch/product
// into the same perspective/copy review pipeline without waiting for it to show up as a
// top seller (or at all, if it never will — e.g. a new SKU).
app.post('/api/discover-product', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.brand || !body.productName) {
      return c.json({ error: 'brand e productName são obrigatórios' }, 400);
    }
    const result = await runDiscoveryForProduct(c.env, { brandName: body.brand, productName: body.productName });
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err.message || err) }, 500);
  }
});

// Called by the GoDeploy platform cron, not by the dashboard. NOT authenticated via the
// X-Godeploy-Cron header the platform is documented to stamp — that header never actually
// matched GODEPLOY_CRON_KEY for this app (confirmed: cron calls 401'd even after the secret
// was set to the value the app checks against, meaning the platform isn't signing with it
// for this app). Using a secret path segment instead, known only to whoever configured the
// cron job — same trust model, doesn't depend on the platform-side mechanism working.
function requireCronToken(c) {
  return c.req.param('token') && c.req.param('token') === c.env.CRON_TOKEN;
}

app.post('/cron/discover/:token', async (c) => {
  if (!requireCronToken(c)) return c.json({ error: 'unauthorized' }, 401);
  try {
    const result = await runDiscovery(c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err.message || err) }, 500);
  }
});

// Advances the catalog_cache sync by a few pages (see catalogSync.js) — scheduled every
// minute so a large catalog finishes in a handful of minutes without any single request
// paginating it end-to-end.
app.post('/cron/sync-catalog/:token', async (c) => {
  if (!requireCronToken(c)) return c.json({ error: 'unauthorized' }, 401);
  try {
    const result = await runCatalogSyncTick(c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err.message || err) }, 500);
  }
});

export default app;
