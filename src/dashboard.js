export const DASHBOARD_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Feed auxiliar Shopping — GoBeaute</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; max-width: 1100px; margin-inline: auto; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  .sub { color: #888; margin-bottom: 24px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
  .card { border: 1px solid #8884; border-radius: 10px; padding: 14px 18px; min-width: 140px; }
  .card b { display: block; font-size: 1.6rem; }
  section { margin-bottom: 32px; }
  h2 { font-size: 1.1rem; border-bottom: 1px solid #8884; padding-bottom: 6px; }
  .candidate, .brand-row { border: 1px solid #8884; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .candidate .meta { font-size: 0.8rem; color: #888; margin-bottom: 6px; }
  .candidate textarea, .candidate input[type=text], .brand-row input[type=text] { width: 100%; box-sizing: border-box; margin-top: 4px; margin-bottom: 8px; font-family: inherit; }
  .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  button { cursor: pointer; border-radius: 6px; border: 1px solid #8884; padding: 6px 12px; background: transparent; color: inherit; }
  button.primary { background: #2563eb; color: white; border-color: #2563eb; }
  button.danger { background: #dc2626; color: white; border-color: #dc2626; }
  .status { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid #8884; }
  .settings label { display: block; margin-bottom: 10px; font-size: 0.85rem; }
  .settings input { width: 100%; box-sizing: border-box; margin-top: 4px; }
  .warn { color: #d97706; font-size: 0.85rem; }
  img.thumb { max-width: 80px; max-height: 80px; border-radius: 6px; vertical-align: middle; margin-right: 8px; }
  .perspective { background: #2563eb18; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
  .perspective .rationale { font-size: 0.85rem; color: #888; margin-top: 4px; }
  .brand-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
  .brand-grid label { font-size: 0.8rem; }
  table.brands { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.brands th, table.brands td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #8884; font-size: 0.85rem; }
</style>
</head>
<body>
  <h1>Feed auxiliar de Shopping — multi-marca</h1>
  <div class="sub">Variações de título/descrição/imagem dos top sellers de cada marca, publicadas na planilha auxiliar de cada uma após aprovação. Catálogo e feed principal de cada marca não são alterados.</div>

  <div class="cards" id="cards"></div>

  <section>
    <h2>Configuração geral</h2>
    <div id="status-warnings"></div>
    <div class="settings" id="settings-form"></div>
    <button class="primary" id="save-settings">Salvar configurações</button>
    <div class="row">
      <button id="run-now">Rodar descoberta agora (todas as marcas)</button>
      <span id="run-now-result"></span>
    </div>
  </section>

  <section>
    <h2>Marcas cadastradas</h2>
    <table class="brands" id="brands-table"></table>
    <div class="brand-row">
      <div class="brand-grid">
        <label>Nome da marca<input type="text" id="brand-name" placeholder="Ex: Ápice"></label>
        <label>Merchant Center ID<input type="text" id="brand-merchant-id" placeholder="1234567"></label>
        <label>Google Sheet ID<input type="text" id="brand-sheet-id" placeholder="1AbC..."></label>
        <label>Aba da planilha<input type="text" id="brand-tab" placeholder="feed" value="feed"></label>
      </div>
      <button class="primary" id="add-brand">Adicionar / atualizar marca</button>
    </div>
  </section>

  <section>
    <h2>Perspectivas sugeridas (aguardando decisão)</h2>
    <div id="perspectives"></div>
  </section>

  <section>
    <h2>Pendentes de revisão (copy pronta)</h2>
    <div id="pending"></div>
  </section>

  <section>
    <h2>Aprovados (na planilha)</h2>
    <div id="approved"></div>
  </section>

  <section>
    <h2>Histórico de execuções</h2>
    <div id="runs"></div>
  </section>

<script>
async function api(path, opts) {
  const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function loadStatus() {
  const status = await api('/api/status');
  const warnEl = document.getElementById('status-warnings');
  const missing = Object.entries(status.configured).filter(([,v]) => !v).map(([k]) => k);
  warnEl.innerHTML = missing.length
    ? '<div class="warn">Faltando configurar: ' + missing.join(', ') + '</div>'
    : '<div>Tudo configurado.</div>';

  document.getElementById('cards').innerHTML = [
    ['Marcas', status.brandsCount],
    ['Top sellers', status.topSellersCount],
    ['Perspectivas p/ decidir', status.awaitingPerspectiveCount],
    ['Pendentes (copy)', status.pendingCount],
    ['Aprovados', status.approvedCount],
    ['Última execução', status.lastRun ? status.lastRun.startedAt.slice(0,16).replace('T',' ') : '—']
  ].map(([label, value]) => '<div class="card"><b>' + esc(String(value)) + '</b>' + esc(label) + '</div>').join('');

  const settings = status.settings;
  document.getElementById('settings-form').innerHTML = Object.entries(settings).map(([k, v]) =>
    '<label>' + esc(k) + '<input type="text" data-key="' + esc(k) + '" value="' + esc(v) + '"></label>'
  ).join('');
}

document.getElementById('save-settings').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('#settings-form input');
  for (const input of inputs) {
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ key: input.dataset.key, value: input.value }) });
  }
  await loadStatus();
});

document.getElementById('run-now').addEventListener('click', async () => {
  const resultEl = document.getElementById('run-now-result');
  resultEl.textContent = 'Rodando...';
  try {
    const result = await api('/api/discover-now', { method: 'POST' });
    let msg = result.topSellersFound + ' top sellers, ' + result.candidatesCreated + ' candidatos criados.';
    if (result.skippedBrands && result.skippedBrands.length) msg += ' Marcas ignoradas (não cadastradas): ' + result.skippedBrands.join(', ') + '.';
    resultEl.textContent = msg;
  } catch (e) {
    resultEl.textContent = 'Erro: ' + e.message;
  }
  await loadAll();
});

async function loadBrands() {
  const brands = await api('/api/brands');
  const table = document.getElementById('brands-table');
  table.innerHTML = '<tr><th>Marca</th><th>Merchant ID</th><th>Sheet ID</th><th>Aba</th><th></th></tr>' +
    brands.map(b => '<tr>' +
      '<td>' + esc(b.name) + '</td><td>' + esc(b.merchantId) + '</td><td>' + esc(b.sheetId) + '</td><td>' + esc(b.sheetTabName) + '</td>' +
      '<td><button class="danger btn-del-brand" data-name="' + esc(b.name) + '">Remover</button></td>' +
    '</tr>').join('');
  table.querySelectorAll('.btn-del-brand').forEach(btn => btn.addEventListener('click', async () => {
    await api('/api/brands/' + encodeURIComponent(btn.dataset.name), { method: 'DELETE' });
    await loadBrands();
  }));
}

document.getElementById('add-brand').addEventListener('click', async () => {
  const name = document.getElementById('brand-name').value.trim();
  const merchantId = document.getElementById('brand-merchant-id').value.trim();
  const sheetId = document.getElementById('brand-sheet-id').value.trim();
  const sheetTabName = document.getElementById('brand-tab').value.trim() || 'feed';
  if (!name || !merchantId || !sheetId) { alert('Preencha nome, Merchant ID e Sheet ID.'); return; }
  await api('/api/brands', { method: 'POST', body: JSON.stringify({ name, merchantId, sheetId, sheetTabName, active: true }) });
  document.getElementById('brand-name').value = '';
  document.getElementById('brand-merchant-id').value = '';
  document.getElementById('brand-sheet-id').value = '';
  await loadBrands();
});

function perspectiveCard(c) {
  return '<div class="candidate" data-id="' + c.id + '">' +
    '<div class="meta">' + esc(c.brand) + ' · ' + esc(c.productTitle || c.merchantProductId) + ' · variação ' + c.variantIndex + '</div>' +
    '<div class="perspective"><b>' + esc(c.perspectiveLabel) + '</b><div class="rationale">' + esc(c.perspectiveRationale) + '</div></div>' +
    '<div class="row"><button class="primary btn-accept">Aceitar esta perspectiva</button></div>' +
    '<label>Ou descreva a perspectiva que prefere testar:<textarea class="f-feedback" rows="2" placeholder="Ex: focar em custo-benefício para famílias"></textarea></label>' +
    '<div class="row"><button class="btn-reject-feedback">Usar minha perspectiva</button></div>' +
  '</div>';
}

function wirePerspectiveCard(el) {
  const id = el.dataset.id;
  const accept = el.querySelector('.btn-accept');
  accept.addEventListener('click', async () => {
    accept.disabled = true; accept.textContent = 'Gerando copy...';
    try { await api('/api/candidates/' + id + '/perspective/accept', { method: 'POST' }); } catch (e) { alert(e.message); }
    await loadAll();
  });
  const rejectBtn = el.querySelector('.btn-reject-feedback');
  rejectBtn.addEventListener('click', async () => {
    const feedback = el.querySelector('.f-feedback').value.trim();
    if (!feedback) { alert('Descreva a perspectiva que prefere.'); return; }
    rejectBtn.disabled = true; rejectBtn.textContent = 'Gerando copy...';
    try { await api('/api/candidates/' + id + '/perspective/reject', { method: 'POST', body: JSON.stringify({ feedback }) }); } catch (e) { alert(e.message); }
    await loadAll();
  });
}

function candidateCard(c) {
  const imgStatus = c.imageStatus || 'none';
  const previewImg = c.imageUrl || c.productImage;
  const generating = imgStatus === 'processing';
  const needsImageReview = imgStatus === 'preview';

  let imageSection = '<label>Prompt da imagem (edite antes de gerar/regerar)' +
    '<textarea class="f-image-prompt" rows="3" placeholder="Carregando sugestão…">' + esc(c.imagePrompt || '') + '</textarea></label>' +
    (previewImg ? '<img class="thumb" src="' + esc(previewImg) + '">' : '') +
    (imgStatus === 'preview' ? '<div class="warn">Preview gerado — revise antes de aprovar o candidato.</div>' : '') +
    (imgStatus === 'approved' ? '<div class="status" style="display:inline-block;margin-bottom:8px;">✓ imagem aprovada</div>' : '') +
    (imgStatus === 'failed' ? '<div class="warn">Falha ao gerar: ' + esc(c.imageError || '') + '</div>' : '') +
    '<div class="row">' +
      '<button class="btn-gen-image"' + (generating ? ' disabled' : '') + '>' +
        (generating ? 'Gerando imagem…' : (previewImg && imgStatus !== 'none' ? 'Gerar outra imagem' : 'Gerar imagem via IA')) +
      '</button>' +
      (needsImageReview ? '<button class="primary btn-approve-image">Aprovar imagem</button>' : '') +
      '<label style="font-size:0.8rem;">ou cole uma URL manualmente:<input type="text" class="f-image" value="' + esc(c.imageUrl || '') + '"></label>' +
    '</div>';

  return '<div class="candidate" data-id="' + c.id + '" data-image-status="' + esc(imgStatus) + '">' +
    '<div class="meta">' + esc(c.brand) + ' · ' + esc(c.merchantProductId) + ' · variação ' + c.variantIndex + ' — perspectiva: ' + esc(c.resolvedPerspective) + ' · <span class="status">' + esc(c.status) + '</span></div>' +
    '<label>Título<input type="text" class="f-title" value="' + esc(c.titleSuggestion) + '"></label>' +
    '<label>Descrição<textarea class="f-desc" rows="3">' + esc(c.descriptionSuggestion) + '</textarea></label>' +
    imageSection +
    '<div class="row">' +
      (needsImageReview || generating
        ? '<span class="warn">Resolva a imagem acima antes de aprovar o candidato.</span>'
        : (c.status !== 'approved' ? '<button class="primary btn-approve">Aprovar</button>' : '')) +
      (c.status !== 'rejected' ? '<button class="danger btn-reject">Rejeitar</button>' : '') +
      '<button class="btn-save">Salvar edição</button>' +
    '</div>' +
  '</div>';
}

function pollImageStatus(el, id) {
  const poll = async () => {
    if (!document.body.contains(el)) return;
    try {
      const result = await api('/api/candidates/' + id + '/check-image', { method: 'POST' });
      if (result.imageStatus === 'processing') { setTimeout(poll, 6000); return; }
    } catch (e) { /* stop polling on error, user can retry manually */ return; }
    await loadAll();
  };
  setTimeout(poll, 6000);
}

async function ensurePromptPrefilled(el, id) {
  const textarea = el.querySelector('.f-image-prompt');
  if (!textarea || textarea.value) return;
  try {
    const { prompt } = await api('/api/candidates/' + id + '/image-prompt');
    if (!textarea.value) { textarea.value = prompt; textarea.placeholder = ''; }
  } catch (e) { textarea.placeholder = 'Não foi possível carregar sugestão — escreva o prompt manualmente.'; }
}

function wireCandidateCard(el) {
  const id = el.dataset.id;
  const getFields = () => ({
    titleSuggestion: el.querySelector('.f-title').value,
    descriptionSuggestion: el.querySelector('.f-desc').value,
    imageUrl: el.querySelector('.f-image').value || null
  });
  const save = el.querySelector('.btn-save');
  if (save) save.addEventListener('click', async () => { await api('/api/candidates/' + id, { method: 'PATCH', body: JSON.stringify(getFields()) }); await loadAll(); });
  const approve = el.querySelector('.btn-approve');
  if (approve) approve.addEventListener('click', async () => {
    await api('/api/candidates/' + id, { method: 'PATCH', body: JSON.stringify(getFields()) });
    try { await api('/api/candidates/' + id + '/approve', { method: 'POST' }); } catch (e) { alert(e.message); }
    await loadAll();
  });
  const reject = el.querySelector('.btn-reject');
  if (reject) reject.addEventListener('click', async () => { await api('/api/candidates/' + id + '/reject', { method: 'POST' }); await loadAll(); });

  const approveImage = el.querySelector('.btn-approve-image');
  if (approveImage) approveImage.addEventListener('click', async () => {
    try { await api('/api/candidates/' + id + '/image/approve', { method: 'POST' }); } catch (e) { alert(e.message); }
    await loadAll();
  });

  const genImage = el.querySelector('.btn-gen-image');
  if (genImage) genImage.addEventListener('click', async () => {
    const prompt = el.querySelector('.f-image-prompt').value.trim();
    genImage.disabled = true; genImage.textContent = 'Gerando imagem…';
    try {
      await api('/api/candidates/' + id + '/generate-image', { method: 'POST', body: JSON.stringify({ prompt }) });
      pollImageStatus(el, id);
    } catch (e) { alert(e.message); genImage.disabled = false; genImage.textContent = 'Gerar imagem via IA'; }
  });

  ensurePromptPrefilled(el, id);
  if (el.dataset.imageStatus === 'processing') pollImageStatus(el, id);
}

async function loadCandidates() {
  const perspectives = await api('/api/candidates?status=awaiting_perspective');
  const pending = await api('/api/candidates?status=pending_review');
  const approved = await api('/api/candidates?status=approved');

  document.getElementById('perspectives').innerHTML = perspectives.length ? perspectives.map(c => perspectiveCard(c)).join('') : '<i>Nenhuma perspectiva pendente.</i>';
  document.getElementById('pending').innerHTML = pending.length ? pending.map(c => candidateCard(c)).join('') : '<i>Nenhum candidato pendente.</i>';
  document.getElementById('approved').innerHTML = approved.length ? approved.map(c => candidateCard(c)).join('') : '<i>Nenhum candidato aprovado ainda.</i>';

  document.querySelectorAll('#perspectives .candidate').forEach(wirePerspectiveCard);
  document.querySelectorAll('#pending .candidate, #approved .candidate').forEach(wireCandidateCard);
}

async function loadRuns() {
  const runs = await api('/api/runs');
  document.getElementById('runs').innerHTML = runs.length ? runs.map(r => {
    let line = esc(r.startedAt) + ' — ';
    line += r.error ? ('erro: ' + esc(r.error)) : ((r.topSellersFound || 0) + ' top sellers, ' + (r.candidatesCreated || 0) + ' candidatos');
    if (r.details && r.details.skippedBrands && r.details.skippedBrands.length) line += ' · marcas ignoradas: ' + esc(r.details.skippedBrands.join(', '));
    return '<div>' + line + '</div>';
  }).join('') : '<i>Nenhuma execução ainda.</i>';
}

async function loadAll() {
  await loadStatus();
  await loadBrands();
  await loadCandidates();
  await loadRuns();
}

loadAll();
</script>
</body>
</html>`;
