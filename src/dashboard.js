export const DASHBOARD_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Feed auxiliar Shopping — GoBeaute</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; max-width: 1100px; margin-inline: auto; line-height: 1.45; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #888; margin: 18px 0 8px; }
  h3:first-child { margin-top: 0; }
  .sub { color: #888; margin-bottom: 20px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
  .card { border: 1px solid #8884; border-radius: 10px; padding: 14px 18px; min-width: 140px; transition: box-shadow .15s ease; }
  .card:hover { box-shadow: 0 2px 10px rgba(0,0,0,.08); }
  .card b { display: block; font-size: 1.6rem; }
  .card.card-alert { border-color: #d97706aa; background: #d9770610; }
  .card.card-alert b { color: #d97706; }
  section { margin-bottom: 32px; }
  h2 { font-size: 1.1rem; border-bottom: 1px solid #8884; padding-bottom: 6px; display: flex; align-items: baseline; gap: 8px; }
  .section-summary { font-size: 1.1rem; border-bottom: 1px solid #8884; padding-bottom: 6px; cursor: pointer; }
  .count { font-size: 0.75rem; color: #888; font-weight: normal; border: none; }
  .brand-row { border: 1px solid #8884; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .candidate-wrap { margin-bottom: 8px; }
  .detail label { display: block; margin-bottom: 12px; font-size: 0.85rem; }
  .detail textarea, .detail input[type=text], .brand-row input[type=text] { width: 100%; margin-top: 4px; font-family: inherit; display: block; }
  .row-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #8884; border-radius: 10px; cursor: pointer; border-left: 4px solid #8884; }
  .row-item:hover { background: #88888818; }
  .row-item:focus-visible { outline: 2px solid #2563eb55; outline-offset: -2px; }
  .row-item.urgent { border-left-color: #d97706; }
  .row-item.review { border-left-color: #2563eb; }
  .row-item.done { border-left-color: #16a34a; }
  .row-item .row-thumb { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
  .row-item .row-main { flex: 1; min-width: 0; }
  .row-item .row-title { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-item .row-sub { font-size: 0.75rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-item .chevron { flex-shrink: 0; color: #888; transition: transform .15s ease; }
  .candidate-wrap.expanded .row-item .chevron { transform: rotate(180deg); }
  .candidate-wrap .detail { display: none; padding: 14px; border: 1px solid #8884; border-top: none; border-radius: 0 0 10px 10px; }
  .candidate-wrap.expanded .row-item { border-radius: 10px 10px 0 0; }
  .candidate-wrap.expanded .detail { display: block; }
  .status-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .status-dot.gray { background: #8888; }
  .status-dot.amber { background: #d97706; }
  .status-dot.blue { background: #2563eb; }
  .status-dot.green { background: #16a34a; }
  .status-dot.red { background: #dc2626; }
  .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  button { cursor: pointer; border-radius: 6px; border: 1px solid #8884; padding: 6px 12px; background: transparent; color: inherit; font-size: 0.9rem; transition: opacity .15s ease, background-color .15s ease; }
  button:hover { opacity: 0.8; }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.primary { background: #2563eb; color: white; border-color: #2563eb; }
  button.danger { background: transparent; color: #dc2626; border-color: #dc262666; }
  button.danger:hover { background: #dc26260f; opacity: 1; }
  select { border-radius: 6px; border: 1px solid #8884; padding: 6px 10px; background: transparent; color: inherit; font-size: 0.9rem; }
  input[type=text], textarea, select { font-size: 0.9rem; }
  input[type=text], textarea { border-radius: 6px; border: 1px solid #8884; background: transparent; color: inherit; padding: 6px 8px; }
  input[type=text]:focus, textarea:focus, select:focus { outline: 2px solid #2563eb55; border-color: #2563eb; }
  .status { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid #8884; white-space: nowrap; }
  .status.active { color: #16a34a; border-color: #16a34a66; }
  .status.inactive { color: #888; }
  .settings label { display: block; margin-bottom: 4px; font-size: 0.85rem; }
  .settings input { width: 100%; margin-top: 4px; }
  .settings .field { margin-bottom: 12px; }
  .help { font-size: 0.75rem; color: #888; margin-top: 2px; font-weight: normal; }
  .warn { color: #d97706; font-size: 0.85rem; }
  .ok { color: #16a34a; font-size: 0.85rem; }
  img.thumb { max-width: 80px; max-height: 80px; border-radius: 6px; vertical-align: middle; margin-right: 8px; }
  .perspective { background: #2563eb18; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
  .perspective .rationale { font-size: 0.85rem; color: #888; margin-top: 4px; }
  .brand-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; align-items: end; }
  .brand-grid label { font-size: 0.8rem; display: block; }
  .brand-grid .checkbox-field { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; }
  .brand-grid .checkbox-field input { width: auto; }
  .table-scroll { overflow-x: auto; margin-bottom: 16px; }
  table.brands { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  table.brands th, table.brands td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #8884; font-size: 0.85rem; }
  table.brands tbody tr:hover td { background: #88888818; }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid #8884; margin-bottom: 24px; overflow-x: auto; }
  .tab-btn { border: none; border-radius: 0; background: transparent; padding: 10px 14px; font-size: 0.9rem; border-bottom: 2px solid transparent; color: inherit; opacity: 0.6; white-space: nowrap; }
  .tab-btn:hover { opacity: 0.85; }
  .tab-btn.active { opacity: 1; border-bottom-color: #2563eb; font-weight: 600; }
  .tab-panel[hidden] { display: none; }
  .empty { color: #888; font-style: italic; font-size: 0.9rem; }
  @media (max-width: 640px) {
    body { padding: 14px; }
    .cards { gap: 8px; }
    .card { min-width: 46%; padding: 10px 14px; }
  }
</style>
</head>
<body>
  <div class="row" style="justify-content: space-between; margin-top: 0;">
    <h1 style="margin: 0;">Feed auxiliar de Shopping — multi-marca</h1>
    <span id="user-email" style="font-size: 0.8rem; color: #888;"></span>
  </div>
  <div class="sub">Variações de título/descrição/imagem dos top sellers de cada marca, publicadas na planilha auxiliar de cada uma após aprovação. Catálogo e feed principal de cada marca não são alterados.</div>

  <nav class="tabs">
    <button class="tab-btn active" data-tab="overview">Visão geral</button>
    <button class="tab-btn" data-tab="brands">Marcas</button>
    <button class="tab-btn" data-tab="settings">Configurações</button>
    <button class="tab-btn" data-tab="history">Histórico</button>
  </nav>

  <div class="tab-panel" id="tab-overview">
    <div id="new-items-banner-slot"></div>
    <div class="cards" id="cards"></div>

    <div class="row" style="justify-content: space-between;">
      <div class="row" style="margin-top: 0;">
        <label style="font-size: 0.85rem;">Rodar para:
          <select id="discover-brand"><option value="">Todas as marcas ativas</option></select>
        </label>
        <button id="run-now">Rodar descoberta agora</button>
        <span id="run-now-result"></span>
      </div>
      <label style="font-size: 0.85rem;">Filtrar por marca:
        <select id="brand-filter"><option value="">Todas as marcas</option></select>
      </label>
    </div>

    <div class="row" style="margin-top: 4px;">
      <label style="font-size: 0.85rem;">Buscar produto específico (sem esperar o Metabase):
        <select id="discover-product-brand" style="margin-top: 2px;"><option value="">Selecione a marca</option></select>
      </label>
      <input type="text" id="discover-product-name" placeholder="Nome do produto (ex: Bolsa Essentials)" style="min-width: 240px;">
      <button id="run-product-now">Buscar e gerar perspectivas</button>
      <span id="run-product-result"></span>
    </div>

    <section>
      <details open>
        <summary class="section-summary">Perspectivas sugeridas (aguardando decisão) <span class="count" id="count-perspectives"></span></summary>
        <div id="perspectives" style="margin-top: 12px;"></div>
      </details>
    </section>

    <section>
      <details open>
        <summary class="section-summary">Pendentes de revisão (copy pronta) <span class="count" id="count-pending"></span></summary>
        <div id="pending" style="margin-top: 12px;"></div>
      </details>
    </section>

    <section>
      <details>
        <summary class="section-summary">Aprovados (na planilha) <span class="count" id="count-approved"></span></summary>
        <div id="approved" style="margin-top: 12px;"></div>
      </details>
    </section>
  </div>

  <div class="tab-panel" id="tab-brands" hidden>
    <section>
      <h2>Marcas cadastradas</h2>
      <div class="table-scroll"><table class="brands" id="brands-table"></table></div>
      <div class="brand-row">
        <div class="brand-grid">
          <label>Nome da marca<div class="help">Precisa bater com o nome usado no Metabase (a comparação já ignora maiúsculas/minúsculas).</div><input type="text" id="brand-name" placeholder="Ex: Ápice"></label>
          <label>Merchant Center ID<div class="help">O ID numérico da conta no Google Merchant Center — não é o nome da conta.</div><input type="text" id="brand-merchant-id" placeholder="1234567"></label>
          <label>Google Sheet ID<div class="help">O trecho entre /d/ e /edit na URL da planilha do Google Sheets.</div><input type="text" id="brand-sheet-id" placeholder="1AbC..."></label>
          <label>Aba da planilha<div class="help">Nome exato da aba (case-sensitive) onde o feed aprovado é escrito.</div><input type="text" id="brand-tab" placeholder="feed" value="feed"></label>
          <label class="checkbox-field"><input type="checkbox" id="brand-active" checked> Marca ativa (considerada nas descobertas)</label>
          <label class="checkbox-field"><input type="checkbox" id="brand-large-catalog"> Catálogo muito grande (usa busca via Merchant API Reports em vez de listar tudo)<div class="help">Só marque se a marca tiver um catálogo na casa de milhões de SKUs (ex: Gocase) — exige registro prévio de developer na conta Merchant Center feito por um humano com acesso admin; fale com quem administra a conta antes de ativar.</div></label>
        </div>
        <div class="row">
          <button class="primary" id="add-brand">Adicionar / atualizar marca</button>
          <button id="cancel-edit-brand" hidden>Cancelar edição</button>
        </div>
      </div>
    </section>
  </div>

  <div class="tab-panel" id="tab-settings" hidden>
    <section>
      <h2>Status das integrações</h2>
      <div id="status-warnings"></div>
    </section>
    <section>
      <h2>Parâmetros</h2>
      <div class="settings" id="settings-form"></div>
      <button class="primary" id="save-settings">Salvar configurações</button>
    </section>
  </div>

  <div class="tab-panel" id="tab-history" hidden>
    <section>
      <h2>Histórico de execuções</h2>
      <div id="runs"></div>
    </section>
  </div>

<script>
document.querySelectorAll('.tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.hidden = true; });
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).hidden = false;
  });
});

let brandFilter = '';

async function api(path, opts) {
  const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  if (res.status === 401) { window.location.href = '/auth/google'; throw new Error('sessão expirada'); }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Standardized replacement for the blocking window.alert() this file used to call on every
// error/validation failure (~15 sites) — inserts a dismissible .warn line right after the
// element the error relates to (usually the button that was clicked), instead of stopping
// all interaction on the page until the user clicks OK. Idempotent per anchor: calling it
// again on the same anchor replaces the previous message rather than stacking more of them.
function showInlineWarn(anchorEl, message) {
  if (!anchorEl) return;
  const next = anchorEl.nextElementSibling;
  if (next && next.classList && next.classList.contains('inline-warn')) next.remove();
  const warn = document.createElement('div');
  warn.className = 'warn inline-warn';
  warn.textContent = message;
  anchorEl.insertAdjacentElement('afterend', warn);
}

// Same idea, but for errors that surface after a candidate card has already been re-rendered
// (e.g. the sheet-sync follow-up call that runs after approve()/reject() already refreshed
// the card) — anchors on the card's own id instead of a button reference that no longer
// exists in the DOM.
function showCandidateWarn(id, message) {
  const el = document.querySelector('.candidate-wrap[data-id="' + id + '"]');
  const detail = el && el.querySelector('.detail');
  if (!detail) return;
  const existing = detail.querySelector('.inline-warn');
  if (existing) existing.remove();
  const warn = document.createElement('div');
  warn.className = 'warn inline-warn';
  warn.textContent = message;
  detail.insertBefore(warn, detail.firstChild);
}

const CONFIG_LABELS = {
  METABASE: 'Metabase (URL + API key)',
  GOOGLE_SERVICE_ACCOUNT: 'Credencial da service account do Google',
  AI_PROXY_TOKEN: 'Token do proxy de IA',
  PIAPP_API_KEY: 'API key do PiApp (geração de imagem)',
  metabase_card_id: 'ID da pergunta do Metabase (aba Configurações)',
  brands_cadastradas: 'Nenhuma marca cadastrada (aba Marcas)'
};

const SETTINGS_META = {
  top_n_per_brand: { label: 'Top produtos por marca', help: 'Quantos produtos mais vendidos considerar por marca a cada descoberta.', group: 'Descoberta' },
  sales_window_days: { label: 'Janela de vendas (dias, informativo)', help: 'A janela real usada é a da query salva no Metabase — isto é só um registro.', group: 'Descoberta' },
  variants_per_product: { label: 'Variações por produto', help: 'Quantas perspectivas/variações de título e descrição gerar por produto novo.', group: 'Descoberta' },
  metabase_card_id: { label: 'ID da pergunta no Metabase', help: 'ID numérico da question salva no Metabase (aparece na URL da pergunta).', group: 'Metabase' },
  metabase_col_id: { label: 'Coluna de ID do produto (manual)', help: 'Deixe em branco para detectar automaticamente pelo nome da coluna.', group: 'Metabase' },
  metabase_col_brand: { label: 'Coluna de marca (manual)', help: 'Deixe em branco para detectar automaticamente.', group: 'Metabase' },
  metabase_col_title: { label: 'Coluna de título (manual)', help: 'Deixe em branco para detectar automaticamente.', group: 'Metabase' },
  metabase_col_share: { label: 'Coluna de participação/receita (manual)', help: 'Deixe em branco para detectar automaticamente.', group: 'Metabase' }
};

async function loadStatus() {
  const qs = brandFilter ? '?brand=' + encodeURIComponent(brandFilter) : '';
  const status = await api('/api/status' + qs);
  document.getElementById('user-email').innerHTML = status.userEmail
    ? esc(status.userEmail) + ' · <a href="/auth/logout">sair</a>' : '';

  const warnEl = document.getElementById('status-warnings');
  const missing = Object.entries(status.configured).filter(([,v]) => !v).map(([k]) => CONFIG_LABELS[k] || k);
  warnEl.innerHTML = missing.length
    ? '<div class="warn">Faltando configurar:<ul style="margin:4px 0 0 18px;">' + missing.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul></div>'
    : '<div class="ok">Tudo configurado.</div>';

  document.getElementById('cards').innerHTML = [
    ['Marcas cadastradas', status.brandsCount, false],
    ['Top sellers' + (brandFilter ? ' (' + brandFilter + ')' : ''), status.topSellersCount, false],
    ['Perspectivas p/ decidir', status.awaitingPerspectiveCount, status.awaitingPerspectiveCount > 0],
    ['Pendentes (copy)', status.pendingCount, status.pendingCount > 0],
    ['Aprovados', status.approvedCount, false],
    ['Última execução', status.lastRun ? status.lastRun.startedAt.slice(0,16).replace('T',' ') + (status.lastRun.brand ? ' (' + status.lastRun.brand + ')' : ' (todas)') : '—', false]
  ].map(([label, value, alert]) => '<div class="card' + (alert ? ' card-alert' : '') + '"><b>' + esc(String(value)) + '</b>' + esc(label) + '</div>').join('');

  const settings = status.settings;
  const groups = {};
  Object.entries(settings).forEach(([k, v]) => {
    const meta = SETTINGS_META[k] || { label: k, help: '', group: 'Outros' };
    (groups[meta.group] = groups[meta.group] || []).push([k, v, meta]);
  });
  document.getElementById('settings-form').innerHTML = Object.entries(groups).map(([group, items]) =>
    '<h3>' + esc(group) + '</h3>' + items.map(([k, v, meta]) =>
      '<div class="field"><label>' + esc(meta.label) +
      (meta.help ? '<div class="help">' + esc(meta.help) + '</div>' : '') +
      '<input type="text" data-key="' + esc(k) + '" value="' + esc(v) + '"></label></div>'
    ).join('')
  ).join('');
}

document.getElementById('save-settings').addEventListener('click', async () => {
  const btn = document.getElementById('save-settings');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const inputs = document.querySelectorAll('#settings-form input');
    // Each field is an independent key/value POST with no dependency on the others, so
    // there's no reason to wait for field 1 to round-trip before sending field 2 — this used
    // to take (fields × request latency) sequentially for what's otherwise a single click.
    await Promise.all(Array.from(inputs).map((input) =>
      api('/api/settings', { method: 'POST', body: JSON.stringify({ key: input.dataset.key, value: input.value }) })
    ));
    await loadStatus();
  } catch (e) {
    showInlineWarn(btn, 'Erro ao salvar: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
});

document.getElementById('run-now').addEventListener('click', async () => {
  const resultEl = document.getElementById('run-now-result');
  const runBtn = document.getElementById('run-now');
  const brand = document.getElementById('discover-brand').value;
  runBtn.disabled = true;
  resultEl.textContent = 'Rodando...';
  try {
    const result = await api('/api/discover-now', { method: 'POST', body: JSON.stringify(brand ? { brand } : {}) });
    let msg = result.topSellersFound + ' top sellers, ' + result.candidatesCreated + ' candidatos criados.';
    if (result.fuzzyMatched) msg += ' ' + result.fuzzyMatched + ' casado(s) por nome (sem ID exato) — revise com atenção.';
    if (result.alreadyTracked) msg += ' ' + result.alreadyTracked + ' produto(s) já tinham candidatos em análise (não duplicados).';
    if (result.skippedBrands && result.skippedBrands.length) msg += ' Marcas ignoradas (não cadastradas): ' + result.skippedBrands.join(', ') + '.';
    resultEl.textContent = msg;
  } catch (e) {
    resultEl.textContent = 'Erro: ' + e.message;
  }
  runBtn.disabled = false;
  await loadAll();
});

document.getElementById('run-product-now').addEventListener('click', async () => {
  const resultEl = document.getElementById('run-product-result');
  const runBtn = document.getElementById('run-product-now');
  const brand = document.getElementById('discover-product-brand').value;
  const productName = document.getElementById('discover-product-name').value.trim();
  if (!brand) { resultEl.textContent = 'Selecione a marca.'; return; }
  if (!productName) { resultEl.textContent = 'Digite o nome do produto a buscar no Merchant Center.'; return; }
  runBtn.disabled = true;
  resultEl.textContent = 'Buscando...';
  try {
    const result = await api('/api/discover-product', { method: 'POST', body: JSON.stringify({ brand, productName }) });
    let msg = result.alreadyTracked
      ? 'Produto "' + result.matchedProduct + '" já tinha candidatos em análise (não duplicado).'
      : 'Encontrado "' + result.matchedProduct + '" (similaridade ' + Math.round((result.matchScore || 0) * 100) + '%), ' + result.candidatesCreated + ' candidato(s) criado(s).';
    resultEl.textContent = msg;
  } catch (e) {
    resultEl.textContent = 'Erro: ' + e.message;
  }
  runBtn.disabled = false;
  await loadAll();
});

document.getElementById('brand-filter').addEventListener('change', async (e) => {
  brandFilter = e.target.value;
  await loadStatus();
  await loadCandidates();
});

let editingBrand = null;

function resetBrandForm() {
  editingBrand = null;
  document.getElementById('brand-name').value = '';
  document.getElementById('brand-name').disabled = false;
  document.getElementById('brand-merchant-id').value = '';
  document.getElementById('brand-sheet-id').value = '';
  document.getElementById('brand-tab').value = 'feed';
  document.getElementById('brand-active').checked = true;
  document.getElementById('brand-large-catalog').checked = false;
  document.getElementById('add-brand').textContent = 'Adicionar / atualizar marca';
  document.getElementById('cancel-edit-brand').hidden = true;
}

document.getElementById('cancel-edit-brand').addEventListener('click', resetBrandForm);

async function loadBrands() {
  const brands = await api('/api/brands');
  const table = document.getElementById('brands-table');
  table.innerHTML = '<tr><th>Marca</th><th>Merchant ID</th><th>Sheet ID</th><th>Aba</th><th>Status</th><th>Catálogo</th><th></th></tr>' +
    brands.map(b => '<tr>' +
      '<td>' + esc(b.name) + '</td><td>' + esc(b.merchantId) + '</td><td>' + esc(b.sheetId) + '</td><td>' + esc(b.sheetTabName) + '</td>' +
      '<td><span class="status ' + (b.active ? 'active' : 'inactive') + '">' + (b.active ? 'Ativa' : 'Inativa') + '</span></td>' +
      '<td>' + (b.largeCatalog ? '<span class="warn" title="Usa busca via Merchant API Reports — exige registro de developer na conta">grande</span>' : '<span class="empty">padrão</span>') + '</td>' +
      '<td><div class="row" style="margin-top:0;">' +
        '<button class="btn-edit-brand" data-name="' + esc(b.name) + '">Editar</button>' +
        '<button class="btn-toggle-brand" data-name="' + esc(b.name) + '">' + (b.active ? 'Desativar' : 'Ativar') + '</button>' +
        '<button class="danger btn-del-brand" data-name="' + esc(b.name) + '">Remover</button>' +
      '</div></td>' +
    '</tr>').join('');

  table.querySelectorAll('.btn-edit-brand').forEach(btn => btn.addEventListener('click', () => {
    const b = brands.find(x => x.name === btn.dataset.name);
    if (!b) return;
    editingBrand = b.name;
    document.getElementById('brand-name').value = b.name;
    document.getElementById('brand-name').disabled = true;
    document.getElementById('brand-merchant-id').value = b.merchantId;
    document.getElementById('brand-sheet-id').value = b.sheetId;
    document.getElementById('brand-tab').value = b.sheetTabName;
    document.getElementById('brand-active').checked = b.active;
    document.getElementById('brand-large-catalog').checked = b.largeCatalog;
    document.getElementById('add-brand').textContent = 'Salvar alterações em "' + b.name + '"';
    document.getElementById('cancel-edit-brand').hidden = false;
    document.getElementById('brand-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  table.querySelectorAll('.btn-toggle-brand').forEach(btn => btn.addEventListener('click', async () => {
    const b = brands.find(x => x.name === btn.dataset.name);
    if (!b) return;
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = '...';
    try {
      await api('/api/brands', { method: 'POST', body: JSON.stringify({ name: b.name, merchantId: b.merchantId, sheetId: b.sheetId, sheetTabName: b.sheetTabName, active: !b.active, largeCatalog: b.largeCatalog }) });
      await loadBrands();
    } catch (e) {
      showInlineWarn(btn, 'Erro: ' + e.message);
      btn.disabled = false; btn.textContent = original;
    }
  }));

  table.querySelectorAll('.btn-del-brand').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Remover a marca "' + btn.dataset.name + '"? Candidatos já criados continuam existindo, mas ela para de ser considerada em novas descobertas.')) return;
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Removendo...';
    try {
      await api('/api/brands/' + encodeURIComponent(btn.dataset.name), { method: 'DELETE' });
      if (editingBrand === btn.dataset.name) resetBrandForm();
      await loadBrands();
    } catch (e) {
      showInlineWarn(btn, 'Erro: ' + e.message);
      btn.disabled = false; btn.textContent = original;
    }
  }));

  const allOptionsHtml = '<option value="">Todas as marcas</option>' +
    brands.map(b => '<option value="' + esc(b.name) + '">' + esc(b.name) + (b.active ? '' : ' (inativa)') + '</option>').join('');
  const activeOptionsHtml = '<option value="">Todas as marcas ativas</option>' +
    brands.filter(b => b.active).map(b => '<option value="' + esc(b.name) + '">' + esc(b.name) + '</option>').join('');

  const filterSel = document.getElementById('brand-filter');
  const filterCurrent = filterSel.value;
  filterSel.innerHTML = allOptionsHtml;
  filterSel.value = brands.some(b => b.name === filterCurrent) ? filterCurrent : '';
  brandFilter = filterSel.value;

  const discoverSel = document.getElementById('discover-brand');
  const discoverCurrent = discoverSel.value;
  discoverSel.innerHTML = activeOptionsHtml;
  discoverSel.value = brands.some(b => b.name === discoverCurrent && b.active) ? discoverCurrent : '';

  // Product-specific search always needs one concrete brand chosen (no "todas" option makes
  // sense here — the search matches by name against a single brand's Merchant Center catalog).
  const productBrandSel = document.getElementById('discover-product-brand');
  const productBrandCurrent = productBrandSel.value;
  productBrandSel.innerHTML = '<option value="">Selecione a marca</option>' +
    brands.filter(b => b.active).map(b => '<option value="' + esc(b.name) + '">' + esc(b.name) + '</option>').join('');
  productBrandSel.value = brands.some(b => b.name === productBrandCurrent && b.active) ? productBrandCurrent : '';
}

document.getElementById('add-brand').addEventListener('click', async () => {
  const btn = document.getElementById('add-brand');
  const name = (editingBrand || document.getElementById('brand-name').value.trim());
  const merchantId = document.getElementById('brand-merchant-id').value.trim();
  const sheetId = document.getElementById('brand-sheet-id').value.trim();
  const sheetTabName = document.getElementById('brand-tab').value.trim() || 'feed';
  const active = document.getElementById('brand-active').checked;
  const largeCatalog = document.getElementById('brand-large-catalog').checked;
  if (!name || !merchantId || !sheetId) { showInlineWarn(btn, 'Preencha nome, Merchant ID e Sheet ID.'); return; }
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    await api('/api/brands', { method: 'POST', body: JSON.stringify({ name, merchantId, sheetId, sheetTabName, active, largeCatalog }) });
    resetBrandForm();
    await loadBrands();
  } catch (e) {
    showInlineWarn(btn, 'Erro: ' + e.message);
    btn.textContent = original;
  } finally {
    btn.disabled = false;
  }
});

function fuzzyBadge(c) {
  return c.matchMethod === 'title'
    ? ' <span class="warn" title="O produto foi encontrado no Merchant Center por similaridade de nome, não por ID exato — confira se é o produto certo antes de aprovar.">⚠ casado por nome</span>'
    : '';
}

// onExpand (optional) fires once, the first time this card is expanded — not on every
// collapse/re-expand, and never for a card that's never opened at all. Used to defer
// ensurePromptPrefilled's network call until it's actually needed instead of firing it
// eagerly for every rendered card (see wireCandidateCard).
function toggleRow(el, onExpand) {
  const row = el.querySelector('.row-item');
  let expandedOnce = false;
  const doToggle = () => {
    el.classList.toggle('expanded');
    row.setAttribute('aria-expanded', String(el.classList.contains('expanded')));
    if (onExpand && !expandedOnce && el.classList.contains('expanded')) {
      expandedOnce = true;
      onExpand();
    }
  };
  // Keyboard-navigable: the row is otherwise just a <div> with a click handler, unreachable
  // without a mouse. tabindex/role make it a focus stop a screen reader announces as a
  // button; Enter/Space mirror the native <button> activation keys.
  row.setAttribute('tabindex', '0');
  row.setAttribute('role', 'button');
  // Reflects whatever expanded state the card was rendered with — refreshOneCandidate can
  // hand this an el that already has the 'expanded' class (restoring prior state) before
  // wiring it up, so this must read that instead of always starting from "false".
  row.setAttribute('aria-expanded', String(el.classList.contains('expanded')));
  row.addEventListener('click', (e) => {
    if (e.target.closest('button, input, textarea, a, select, label')) return;
    doToggle();
  });
  row.addEventListener('keydown', (e) => {
    if (e.target.closest('button, input, textarea, a, select, label')) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    doToggle();
  });
}

function perspectiveCard(c) {
  const thumb = c.productImage
    ? '<img class="row-thumb" src="' + esc(c.productImage) + '" alt="">'
    : '<span class="status-dot amber" title="Aguardando decisão sobre a perspectiva" aria-label="Aguardando decisão sobre a perspectiva"></span>';
  return '<div class="candidate-wrap" data-id="' + c.id + '">' +
    '<div class="row-item urgent">' + thumb +
      '<div class="row-main">' +
        '<div class="row-title">' + esc(c.brand) + ' · ' + esc(c.productTitle || c.merchantProductId) + ' · variação ' + c.variantIndex + fuzzyBadge(c) + '</div>' +
        '<div class="row-sub">' + esc(c.perspectiveLabel) + '</div>' +
      '</div>' +
      '<span class="chevron">▾</span>' +
    '</div>' +
    '<div class="detail">' +
      '<div class="perspective"><b>' + esc(c.perspectiveLabel) + '</b><div class="rationale">' + esc(c.perspectiveRationale) + '</div></div>' +
      '<label class="checkbox-field"><input type="checkbox" class="f-include-product-name" checked> Usar nome do produto no título</label>' +
      '<div class="row"><button class="primary btn-accept">Aceitar esta perspectiva</button></div>' +
      '<label>Ou descreva a perspectiva que prefere testar:<textarea class="f-feedback" rows="2" placeholder="Ex: focar em custo-benefício para famílias"></textarea></label>' +
      '<div class="row"><button class="btn-reject-feedback">Usar minha perspectiva</button></div>' +
    '</div>' +
  '</div>';
}

function wirePerspectiveCard(el) {
  toggleRow(el);
  const id = el.dataset.id;
  const includeProductName = () => el.querySelector('.f-include-product-name').checked;

  // Called after accept/reject have already moved the card to the review section
  // (copyStatus 'generating') — does the actual AI call and refreshes the card again once
  // it lands, whether it succeeds or fails. Kept separate so accepting/rejecting a
  // perspective feels instant instead of blocking on the AI proxy (~7s) first.
  const kickOffCopyGeneration = async (includeName) => {
    try {
      await api('/api/candidates/' + id + '/generate-copy', {
        method: 'POST', body: JSON.stringify({ includeProductName: includeName })
      });
    } catch (e) { /* copyStatus/copyError already persisted server-side by generate-copy */ }
    await refreshOneCandidate(id);
  };

  const accept = el.querySelector('.btn-accept');
  accept.addEventListener('click', async () => {
    const includeName = includeProductName();
    accept.disabled = true; accept.textContent = 'Movendo...';
    try {
      await api('/api/candidates/' + id + '/perspective/accept', { method: 'POST' });
    } catch (e) {
      showInlineWarn(accept, e.message);
      accept.disabled = false; accept.textContent = 'Aceitar esta perspectiva';
      return;
    }
    await refreshOneCandidate(id);
    await loadStatus();
    await kickOffCopyGeneration(includeName);
  });

  const rejectBtn = el.querySelector('.btn-reject-feedback');
  rejectBtn.addEventListener('click', async () => {
    const feedback = el.querySelector('.f-feedback').value.trim();
    if (!feedback) { showInlineWarn(rejectBtn, 'Descreva a perspectiva que prefere.'); return; }
    const includeName = includeProductName();
    rejectBtn.disabled = true; rejectBtn.textContent = 'Movendo...';
    try {
      await api('/api/candidates/' + id + '/perspective/reject', { method: 'POST', body: JSON.stringify({ feedback }) });
    } catch (e) {
      showInlineWarn(rejectBtn, e.message);
      rejectBtn.disabled = false; rejectBtn.textContent = 'Usar minha perspectiva';
      return;
    }
    await refreshOneCandidate(id);
    await loadStatus();
    await kickOffCopyGeneration(includeName);
  });
}

const IMAGE_STATUS_DOT = { none: 'gray', processing: 'amber', preview: 'blue', approved: 'green', failed: 'red' };
const IMAGE_STATUS_LABEL = { none: 'sem imagem', processing: 'gerando imagem', preview: 'imagem p/ revisar', approved: 'imagem aprovada', failed: 'imagem falhou' };

function candidateCard(c) {
  const imgStatus = c.imageStatus || 'none';
  const copyStatus = c.copyStatus || 'ready';
  const copyGenerating = copyStatus === 'generating';
  const copyFailed = copyStatus === 'failed';
  const previewImg = c.imageUrl || c.productImage;
  const generating = imgStatus === 'processing';
  const needsImageReview = imgStatus === 'preview';
  const rowClass = c.status === 'approved' ? 'done' : (needsImageReview || imgStatus === 'failed' || copyFailed ? 'urgent' : 'review');
  const dotClass = copyGenerating ? 'amber' : (copyFailed ? 'red' : (IMAGE_STATUS_DOT[imgStatus] || 'gray'));
  const dotLabel = copyGenerating ? 'Gerando copy' : (copyFailed ? 'Falha ao gerar copy' : (IMAGE_STATUS_LABEL[imgStatus] || imgStatus));
  const thumb = previewImg
    ? '<img class="row-thumb" src="' + esc(previewImg) + '" alt="">'
    : '<span class="status-dot ' + dotClass + '" title="' + esc(dotLabel) + '" aria-label="' + esc(dotLabel) + '"></span>';

  let imageSection =
    '<div class="row" style="margin-top:0;">' +
      '<label style="font-size:0.8rem;">Modo de imagem:' +
        '<select class="f-image-mode">' +
          '<option value="">Otimização tradicional</option>' +
          '<option value="before_after">Antes e depois (mostra a dor que o produto resolve)</option>' +
        '</select>' +
      '</label>' +
      '<button class="btn-suggest-prompt">Sugerir prompt</button>' +
    '</div>' +
    '<label>Prompt da imagem (edite antes de gerar/regerar)' +
    '<textarea class="f-image-prompt" rows="3" placeholder="Carregando sugestão…">' + esc(c.imagePrompt || '') + '</textarea></label>' +
    (previewImg ? '<img class="thumb" src="' + esc(previewImg) + '" alt="Imagem gerada para ' + esc(c.merchantProductId) + ' (' + esc(IMAGE_STATUS_LABEL[imgStatus] || imgStatus) + ')">' : '') +
    (imgStatus === 'preview' ? '<div class="warn">Preview gerado — revise antes de aprovar o candidato.</div>' : '') +
    (imgStatus === 'approved' ? '<div class="status active" style="display:inline-block;margin-bottom:8px;">✓ imagem aprovada</div>' : '') +
    (imgStatus === 'failed' ? '<div class="warn">Falha ao gerar: ' + esc(c.imageError || '') + '</div>' : '') +
    '<div class="row">' +
      '<button class="btn-gen-image"' + (generating ? ' disabled' : '') + '>' +
        (generating ? 'Gerando imagem…' : (previewImg && imgStatus !== 'none' ? 'Gerar outra imagem' : 'Gerar imagem via IA')) +
      '</button>' +
      (needsImageReview ? '<button class="primary btn-approve-image">Aprovar imagem</button>' : '') +
      '<label style="font-size:0.8rem;">ou cole uma URL manualmente:<input type="text" class="f-image" value="' + esc(c.imageUrl || '') + '"></label>' +
    '</div>';

  return '<div class="candidate-wrap" data-id="' + c.id + '" data-image-status="' + esc(imgStatus) + '" data-status="' + esc(c.status) + '">' +
    '<div class="row-item ' + rowClass + '">' + thumb +
      '<div class="row-main">' +
        '<div class="row-title">' + esc(c.brand) + ' · ' + esc(c.merchantProductId) + ' · variação ' + c.variantIndex + fuzzyBadge(c) + '</div>' +
        '<div class="row-sub">' +
          (copyGenerating ? 'Gerando copy…' : (copyFailed ? 'Falha ao gerar copy' :
            esc(c.titleSuggestion || c.resolvedPerspective) + ' · ' + (IMAGE_STATUS_LABEL[imgStatus] || imgStatus))) +
        '</div>' +
      '</div>' +
      '<span class="status">' + esc(c.status) + '</span>' +
      '<span class="chevron">▾</span>' +
    '</div>' +
    '<div class="detail">' +
      (copyGenerating
        ? '<div class="row" style="margin-top:0;"><span class="status-dot amber"></span> Gerando título e descrição via IA…</div>' +
          '<div class="row"><button class="danger btn-reject">Rejeitar</button></div>'
        : copyFailed
        ? '<div class="warn">Falha ao gerar copy: ' + esc(c.copyError || '') + '</div>' +
          '<div class="row"><button class="primary btn-retry-copy">Tentar gerar copy de novo</button>' +
          '<button class="danger btn-reject">Rejeitar</button></div>'
        : '<label>Título<input type="text" class="f-title" value="' + esc(c.titleSuggestion) + '"></label>' +
          '<label>Descrição<textarea class="f-desc" rows="3">' + esc(c.descriptionSuggestion) + '</textarea></label>' +
          imageSection +
          (c.status === 'approved'
            ? '<div class="warn">Editar aqui não atualiza a planilha automaticamente — clique em Aprovar de novo (ou salve e reaprove) pra propagar.</div>'
            : '') +
          '<div class="row">' +
            (needsImageReview || generating
              ? '<span class="warn">Resolva a imagem acima antes de aprovar o candidato.</span>'
              : (c.status !== 'approved' ? '<button class="primary btn-approve">Aprovar</button>' : '')) +
            (c.status !== 'rejected' ? '<button class="danger btn-reject">' + (c.status === 'approved' ? 'Remover da planilha' : 'Rejeitar') + '</button>' : '') +
            '<button class="btn-save">Salvar edição</button>' +
          '</div>') +
    '</div>' +
  '</div>';
}

// Looks up the card by candidate id fresh on every tick instead of holding on to the el
// passed in when polling started — that element only represents "this card as it existed
// at that moment." Any DOM rebuild in between (this card's own refreshOneCandidate(), or
// anyone else's) replaces the node; checking document.body.contains(el) against the OLD
// node made polling stop silently the instant literally anything else on the page
// re-rendered, which is what was killing in-progress image generation (~100s) for other
// SKUs the moment you touched any other candidate.
function pollImageStatus(id) {
  let attempts = 0;
  const poll = async () => {
    if (!document.querySelector('.candidate-wrap[data-id="' + id + '"]')) return;
    attempts++;
    try {
      const result = await api('/api/candidates/' + id + '/check-image', { method: 'POST' });
      if (result.imageStatus === 'processing') {
        if (attempts < 20) { setTimeout(poll, 6000); return; }
        // Gave up after ~2 minutes — the job may just be running long (PiApp jobs are
        // "well under 30-120s" per its own estimate, but not guaranteed). Used to go quiet
        // here with the button stuck on "Gerando imagem…" and no way to resume short of a
        // full page reload.
        showStuckPollWarning(id);
        return;
      }
    } catch (e) { /* fall through — refreshOneCandidate shows whatever status actually persisted */ }
    await refreshOneCandidate(id);
  };
  setTimeout(poll, 6000);
}

function showStuckPollWarning(id) {
  const el = document.querySelector('.candidate-wrap[data-id="' + id + '"]');
  const btn = el && el.querySelector('.btn-gen-image');
  if (!btn || el.querySelector('.stuck-poll-warn')) return;
  const warn = document.createElement('div');
  warn.className = 'warn stuck-poll-warn';
  warn.innerHTML = 'Ainda gerando depois de ~2 minutos — pode levar mais tempo. ' +
    '<button class="btn-recheck-image">Verificar novamente</button>';
  btn.insertAdjacentElement('afterend', warn);
  warn.querySelector('.btn-recheck-image').addEventListener('click', () => {
    warn.remove();
    pollImageStatus(id);
  });
}

async function ensurePromptPrefilled(el, id) {
  const textarea = el.querySelector('.f-image-prompt');
  if (!textarea || textarea.value) return;
  try {
    const { prompt } = await api('/api/candidates/' + id + '/image-prompt');
    if (!textarea.value) { textarea.value = prompt; textarea.placeholder = ''; }
  } catch (e) {
    textarea.placeholder = 'Não foi possível carregar sugestão — escreva o prompt manualmente.';
    showPromptRetryButton(el, id);
  }
}

// Mirrors the retry affordance already used for copy-generation failures (.btn-retry-copy)
// instead of leaving the operator stuck typing a prompt from scratch after a transient
// network blip — same idea, just for the auto-suggested image prompt fetch.
function showPromptRetryButton(el, id) {
  const textarea = el.querySelector('.f-image-prompt');
  if (!textarea || (textarea.nextElementSibling && textarea.nextElementSibling.classList.contains('btn-retry-prompt'))) return;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn-retry-prompt';
  retry.textContent = 'Tentar carregar sugestão de novo';
  retry.addEventListener('click', async () => {
    retry.disabled = true; retry.textContent = 'Carregando...';
    try {
      const { prompt } = await api('/api/candidates/' + id + '/image-prompt');
      textarea.value = prompt;
      textarea.placeholder = '';
      retry.remove();
    } catch (e) {
      retry.disabled = false; retry.textContent = 'Tentar carregar sugestão de novo';
    }
  });
  textarea.insertAdjacentElement('afterend', retry);
}

// approve()/reject() return right away without waiting on the sheet sync (see index.js) —
// this fires the actual sync as a separate follow-up call when the response says one is
// needed, surfacing sheetError the same way the old inline check used to.
async function syncSheetIfNeeded(id, result, actionLabel) {
  if (!result || !result.needsSync) return;
  try {
    const syncResult = await api('/api/candidates/' + id + '/sync-sheet', { method: 'POST' });
    if (syncResult.sheetError) showCandidateWarn(id, actionLabel + ', mas falhou ao sincronizar a planilha: ' + syncResult.sheetError);
  } catch (e) {
    showCandidateWarn(id, 'Falha ao sincronizar a planilha: ' + e.message);
  }
}

function wireCandidateCard(el) {
  const id = el.dataset.id;
  toggleRow(el, () => ensurePromptPrefilled(el, id));
  const getFields = () => ({
    titleSuggestion: el.querySelector('.f-title').value,
    descriptionSuggestion: el.querySelector('.f-desc').value,
    imageUrl: el.querySelector('.f-image').value || null
  });
  const save = el.querySelector('.btn-save');
  if (save) save.addEventListener('click', async () => {
    save.disabled = true; const original = save.textContent; save.textContent = 'Salvando...';
    try { await api('/api/candidates/' + id, { method: 'PATCH', body: JSON.stringify(getFields()) }); }
    catch (e) {
      showInlineWarn(save, 'Erro: ' + e.message);
      save.disabled = false; save.textContent = original;
      return; // don't refresh — that would rebuild the card and wipe the warning above
    }
    save.disabled = false; save.textContent = original;
    await refreshOneCandidate(id);
  });
  const approve = el.querySelector('.btn-approve');
  if (approve) approve.addEventListener('click', async () => {
    approve.disabled = true; const original = approve.textContent; approve.textContent = 'Aprovando...';
    let result;
    try {
      await api('/api/candidates/' + id, { method: 'PATCH', body: JSON.stringify(getFields()) });
      result = await api('/api/candidates/' + id + '/approve', { method: 'POST' });
    } catch (e) {
      showInlineWarn(approve, 'Erro: ' + e.message);
      approve.disabled = false; approve.textContent = original;
      return;
    }
    await refreshOneCandidate(id);
    await loadStatus();
    // approve() returns fast without waiting on the sheet sync (see index.js) — do that
    // separately now, so the click itself doesn't block on a ~1.6s full sheet rewrite.
    await syncSheetIfNeeded(id, result, 'Candidato aprovado');
  });
  const reject = el.querySelector('.btn-reject');
  if (reject) reject.addEventListener('click', async () => {
    // Rejecting a candidate that's already approved (live in the sheet) removes it from
    // the feed right away — the confirm text needs to say so, not the softer "sai da fila
    // de revisão" wording used otherwise.
    const wasApproved = el.dataset.status === 'approved';
    const confirmMsg = wasApproved
      ? 'Rejeitar este candidato JÁ APROVADO? Ele será removido da planilha da marca agora.'
      : 'Rejeitar este candidato? Ele sai da fila de revisão (o produto pode voltar a ser proposto numa próxima descoberta).';
    if (!confirm(confirmMsg)) return;
    reject.disabled = true; const original = reject.textContent; reject.textContent = 'Rejeitando...';
    let result;
    try { result = await api('/api/candidates/' + id + '/reject', { method: 'POST' }); }
    catch (e) { showInlineWarn(reject, 'Erro: ' + e.message); reject.disabled = false; reject.textContent = original; return; }
    await refreshOneCandidate(id);
    await loadStatus();
    await syncSheetIfNeeded(id, result, 'Candidato rejeitado');
  });

  const retryCopy = el.querySelector('.btn-retry-copy');
  if (retryCopy) retryCopy.addEventListener('click', async () => {
    retryCopy.disabled = true; retryCopy.textContent = 'Gerando...';
    try { await api('/api/candidates/' + id + '/generate-copy', { method: 'POST', body: JSON.stringify({}) }); }
    catch (e) { /* copyStatus/copyError already persisted server-side */ }
    await refreshOneCandidate(id);
  });

  const approveImage = el.querySelector('.btn-approve-image');
  if (approveImage) approveImage.addEventListener('click', async () => {
    approveImage.disabled = true; const original = approveImage.textContent; approveImage.textContent = 'Aprovando...';
    try { await api('/api/candidates/' + id + '/image/approve', { method: 'POST' }); }
    catch (e) {
      showInlineWarn(approveImage, 'Erro: ' + e.message);
      approveImage.disabled = false; approveImage.textContent = original;
      return; // don't refresh — that would rebuild the card and wipe the warning above
    }
    await refreshOneCandidate(id);
  });

  const suggestPrompt = el.querySelector('.btn-suggest-prompt');
  if (suggestPrompt) suggestPrompt.addEventListener('click', async () => {
    const mode = el.querySelector('.f-image-mode').value;
    const textarea = el.querySelector('.f-image-prompt');
    suggestPrompt.disabled = true; const original = suggestPrompt.textContent;
    suggestPrompt.textContent = mode === 'before_after' ? 'Pensando na dor/resultado...' : 'Sugerindo...';
    try {
      const qs = mode ? '?mode=' + encodeURIComponent(mode) : '';
      const { prompt } = await api('/api/candidates/' + id + '/image-prompt' + qs);
      textarea.value = prompt;
    } catch (e) { showInlineWarn(suggestPrompt, 'Erro: ' + e.message); }
    suggestPrompt.disabled = false; suggestPrompt.textContent = original;
  });

  const genImage = el.querySelector('.btn-gen-image');
  if (genImage) genImage.addEventListener('click', async () => {
    const prompt = el.querySelector('.f-image-prompt').value.trim();
    genImage.disabled = true; genImage.textContent = 'Gerando imagem…';
    try {
      await api('/api/candidates/' + id + '/generate-image', { method: 'POST', body: JSON.stringify({ prompt }) });
      pollImageStatus(id);
    } catch (e) {
      showInlineWarn(genImage, e.message);
      genImage.disabled = false; genImage.textContent = 'Gerar imagem via IA';
    }
  });

  if (el.dataset.imageStatus === 'processing') pollImageStatus(id);
}

async function loadCandidates() {
  const qs = brandFilter ? '&brand=' + encodeURIComponent(brandFilter) : '';
  const perspectives = await api('/api/candidates?status=awaiting_perspective' + qs);
  const pending = await api('/api/candidates?status=pending_review' + qs);
  const approved = await api('/api/candidates?status=approved' + qs);

  document.getElementById('count-perspectives').textContent = perspectives.length ? '(' + perspectives.length + ')' : '';
  document.getElementById('count-pending').textContent = pending.length ? '(' + pending.length + ')' : '';
  document.getElementById('count-approved').textContent = approved.length ? '(' + approved.length + ')' : '';

  document.getElementById('perspectives').innerHTML = perspectives.length ? perspectives.map(c => perspectiveCard(c)).join('') : '<div class="empty">Nenhuma perspectiva pendente.</div>';
  document.getElementById('pending').innerHTML = pending.length ? pending.map(c => candidateCard(c)).join('') : '<div class="empty">Nenhum candidato pendente.</div>';
  document.getElementById('approved').innerHTML = approved.length ? approved.map(c => candidateCard(c)).join('') : '<div class="empty">Nenhum candidato aprovado ainda.</div>';

  document.querySelectorAll('#perspectives .candidate-wrap').forEach(wirePerspectiveCard);
  document.querySelectorAll('#pending .candidate-wrap, #approved .candidate-wrap').forEach(wireCandidateCard);
}

const SECTIONS = [
  ['perspectives', 'count-perspectives', 'Nenhuma perspectiva pendente.'],
  ['pending', 'count-pending', 'Nenhum candidato pendente.'],
  ['approved', 'count-approved', 'Nenhum candidato aprovado ainda.']
];

function updateSectionCounts() {
  SECTIONS.forEach(([containerId, countId, emptyText]) => {
    const container = document.getElementById(containerId);
    const count = container.querySelectorAll('.candidate-wrap').length;
    document.getElementById(countId).textContent = count ? '(' + count + ')' : '';
    if (!count && !container.querySelector('.empty')) {
      container.innerHTML = '<div class="empty">' + emptyText + '</div>';
    }
  });
}

// Refreshes exactly one candidate's card instead of tearing down and rebuilding every
// section (loadAll()/loadCandidates() replace the whole DOM via innerHTML). That full
// rebuild used to run after every single action on any candidate — including things as
// quick as a PATCH save — and it silently killed pollImageStatus()'s in-flight polling for
// every OTHER candidate whose image was still generating (a ~100s process), since their
// captured el reference stopped being attached to the document. This only touches the
// one card that actually changed; every other card (and any poll loop watching it) is left
// alone.
//
// Also preserves the card's position within its section and its expanded/collapsed state:
// this used to always re-insert at the end of the container and always render collapsed,
// which broke the backend's product/variant sort order (any touched card jumped to the
// bottom of the list) and collapsed the card right when an operator most wanted to see the
// result of the action they just took (a save, an image approval, a copy retry).
async function refreshOneCandidate(id) {
  let candidate = null;
  try { candidate = await api('/api/candidates/' + id); } catch (e) { candidate = null; }

  let anchorNode = null;   // whatever used to sit right after the old card, to insertBefore
  let anchorParent = null; // its container, in case the candidate is also changing section
  let wasExpanded = false;
  document.querySelectorAll('.candidate-wrap[data-id="' + id + '"]').forEach((el) => {
    wasExpanded = wasExpanded || el.classList.contains('expanded');
    anchorNode = el.nextElementSibling;
    anchorParent = el.parentElement;
    el.remove();
  });

  if (candidate && candidate.status !== 'rejected' && (!brandFilter || candidate.brand === brandFilter)) {
    let containerId, html, wire;
    if (candidate.status === 'awaiting_perspective') {
      containerId = 'perspectives'; html = perspectiveCard(candidate); wire = wirePerspectiveCard;
    } else {
      containerId = candidate.status === 'approved' ? 'approved' : 'pending';
      html = candidateCard(candidate); wire = wireCandidateCard;
    }
    const container = document.getElementById(containerId);
    const empty = container.querySelector('.empty');
    if (empty) empty.remove();

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newEl = temp.firstElementChild;
    // Only meaningful to preserve the old slot if the card is staying in the same
    // section — if it moved (e.g. perspective accepted into pending), there's no old
    // position in the NEW container to restore, so just append there.
    if (anchorParent === container && anchorNode && container.contains(anchorNode)) {
      container.insertBefore(newEl, anchorNode);
    } else {
      container.appendChild(newEl);
    }
    if (wasExpanded) newEl.classList.add('expanded');
    wire(newEl);
  }

  updateSectionCounts();
}

async function loadRuns() {
  const runs = await api('/api/runs');
  document.getElementById('runs').innerHTML = runs.length ? runs.map(r => {
    let line = esc(r.startedAt) + ' — <b>' + esc(r.brand || 'todas as marcas') + '</b> — ';
    line += r.error ? ('<span class="warn">erro: ' + esc(r.error) + '</span>') : ((r.topSellersFound || 0) + ' top sellers, ' + (r.candidatesCreated || 0) + ' candidatos');
    if (r.details && r.details.fuzzyMatched) line += ' · ' + r.details.fuzzyMatched + ' casado(s) por nome';
    if (r.details && r.details.alreadyTracked) line += ' · ' + r.details.alreadyTracked + ' já em análise';
    if (r.details && r.details.skippedBrands && r.details.skippedBrands.length) line += ' · marcas ignoradas: ' + esc(r.details.skippedBrands.join(', '));
    return '<div style="padding:6px 0; border-bottom:1px solid #8882; font-size:0.85rem;">' + line + '</div>';
  }).join('') : '<div class="empty">Nenhuma execução ainda.</div>';
}

async function loadAll() {
  await loadStatus();
  await loadBrands();
  await loadCandidates();
  await loadRuns();
}

// Background cron (/cron/discover) creates new perspectives independent of the dashboard's
// own "Rodar descoberta agora" button — without this, an operator keeping the tab open
// wouldn't see new items until a manual full-page reload. Deliberately lightweight: only
// GET /api/status (a few COUNT(*) queries) every 60s, comparing against what's actually
// rendered — never touches loadCandidates()/the DOM on its own, so it can't interrupt any
// in-progress polling or edits the way a real reload would. The visible refresh only
// happens if the operator clicks the banner.
function showNewItemsBanner() {
  const slot = document.getElementById('new-items-banner-slot');
  if (!slot || slot.querySelector('.new-items-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'warn new-items-banner';
  banner.style.cursor = 'pointer';
  banner.style.marginBottom = '12px';
  banner.textContent = 'Novos itens disponíveis — clique para atualizar';
  banner.addEventListener('click', async () => {
    banner.remove();
    await loadStatus();
    await loadCandidates();
  });
  slot.appendChild(banner);
}

setInterval(async () => {
  try {
    const qs = brandFilter ? '?brand=' + encodeURIComponent(brandFilter) : '';
    const status = await api('/api/status' + qs);
    const currentPerspectives = document.querySelectorAll('#perspectives .candidate-wrap').length;
    const currentPending = document.querySelectorAll('#pending .candidate-wrap').length;
    if (status.awaitingPerspectiveCount > currentPerspectives || status.pendingCount > currentPending) {
      showNewItemsBanner();
    }
  } catch (e) { /* silent — background convenience check, not a user-initiated action */ }
}, 60000);

loadAll();
</script>
</body>
</html>`;
