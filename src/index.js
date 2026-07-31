import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import {
  ensureSchema, getSettings, setSetting, listCandidates, getCandidate,
  updateCandidate, listApprovedCandidates, listRuns,
  listBrands, upsertBrand, deleteBrand, getBrand
} from './db';
import { runDiscovery } from './discover';
import { syncApprovedFeed } from './sheets';
import { generateCopyForPerspective } from './ai';
import { submitImageJob, checkJobs, buildImagePrompt } from './piapp';
import { DASHBOARD_HTML } from './dashboard';

const app = new Hono();

app.use('/', async (c, next) => {
  const mw = basicAuth({ username: c.env.ADMIN_USER || 'admin', password: c.env.ADMIN_PASSWORD || 'change-me' });
  return mw(c, next);
});
app.use('/api/*', async (c, next) => {
  const mw = basicAuth({ username: c.env.ADMIN_USER || 'admin', password: c.env.ADMIN_PASSWORD || 'change-me' });
  return mw(c, next);
});

app.get('/', (c) => c.html(DASHBOARD_HTML));

app.get('/api/status', async (c) => {
  const DB = c.env.DB;
  await ensureSchema(DB);
  const settings = await getSettings(DB);
  const brands = await listBrands(DB);
  const awaitingPerspective = await listCandidates(DB, { status: 'awaiting_perspective' });
  const pending = await listCandidates(DB, { status: 'pending_review' });
  const approved = await listCandidates(DB, { status: 'approved' });
  const runs = await listRuns(DB, 1);
  const { rows: topSellerRows } = await DB.query('SELECT COUNT(*) FROM top_sellers', []);

  return c.json({
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
app.get('/api/candidates/:id/image-prompt', async (c) => {
  await ensureSchema(c.env.DB);
  const id = c.req.param('id');
  const candidate = await getCandidate(c.env.DB, id);
  if (!candidate) return c.json({ error: 'candidato não encontrado' }, 404);
  const prompt = candidate.imagePrompt || buildImagePrompt(candidate, candidate.resolvedPerspective || candidate.perspectiveLabel);
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
    if (!job || job.status === 'queued' || job.status === 'processing') {
      return c.json({ imageStatus: 'processing' });
    }
    if (job.status === 'completed') {
      await updateCandidate(c.env.DB, id, { imageUrl: job.outputUrl, imageStatus: 'preview', imageError: null });
      return c.json({ imageStatus: 'preview', imageUrl: job.outputUrl });
    }
    await updateCandidate(c.env.DB, id, { imageStatus: 'failed', imageError: job.error || 'falhou' });
    return c.json({ imageStatus: 'failed', imageError: job.error });
  } catch (err) {
    return c.json({ error: String(err.message || err) }, 500);
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
    const result = await runDiscovery(c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err.message || err) }, 500);
  }
});

// Called by the GoDeploy platform cron, not by the dashboard — no Basic Auth here,
// authenticated instead via the shared secret the platform stamps on every cron call.
app.post('/cron/discover', async (c) => {
  const header = c.req.header('X-Godeploy-Cron');
  if (!header || header !== c.env.GODEPLOY_CRON_KEY) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  try {
    const result = await runDiscovery(c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err.message || err) }, 500);
  }
});

export default app;
