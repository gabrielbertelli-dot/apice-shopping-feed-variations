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
  .row-item.urgent { border-left-color: #d97706; }
  .row-item.review { border-left-color: #2563eb; }
  .row-item.done { border-left-color: #16a34a; }
  .row-item .row-thumb { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
  .row-item .row-main { flex: 1; min-width: 0; }
  .row-item .row-title { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-item .row-sub { font-size: 0.75rem; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
  table.brands { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
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
      <details id="approved-details">
        <summary class="section-summary">Aprovados (na planilha) <span class="count" id="count-approved"></span></summary>
        <div id="approved" style="margin-top: 12px;"></div>
      </details>
    </section>
  </div>

  <div class="tab-panel" id="tab-brands" hidden>
    <section>
      <h2>Marcas cadastradas</h2>
      <table class="brands" id="brands-table"></table>
      <div class="brand-row">
        <div class="brand-grid">
          <label>Nome da marca<input type="text" id="brand-name" placeholder="Ex: Ápice"></label>
          <label>Merchant Center ID<input type="text" id="brand-merchant-id" placeholder="1234567"></label>
          <label>Google Sheet ID<input type="text" id="brand-sheet-id" placeholder="1AbC..."></label>
          <label>Aba da planilha<input type="text" id="brand-tab" placeholder="feed" value="feed"></label>
          <label class="checkbox-field"><input type="checkbox" id="brand-active" checked> Marca ativa (considerada nas descobertas)</label>
          <label class="checkbox-field"><input type="checkbox" id="brand-large-catalog"> Catálogo muito grande (usa busca via Merchant API Reports em vez de listar tudo — exige registro prévio de developer na conta, ver docs)</label>
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
    for (const input of inputs) {
      await api('/api/settings', { method: 'POST', body: JSON.stringify({ key: input.dataset.key, value: input.value }) });
    }
    await loadStatus();
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
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
  if (!brand) { alert('Selecione a marca.'); return; }
  if (!productName) { alert('Digite o nome do produto a buscar no Merchant Center.'); return; }
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
      alert('Erro: ' + e.message);
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
      alert('Erro: ' + e.message);
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
  if (!name || !merchantId || !sheetId) { alert('Preencha nome, Merchant ID e Sheet ID.'); return; }
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    await api('/api/brands', { method: 'POST', body: JSON.stringify({ name, merchantId, sheetId, sheetTabName, active, largeCatalog }) });
    resetBrandForm();
    await loadBrands();
  } catch (e) {
    alert('Erro: ' + e.message);
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

function toggleRow(el) {
  const row = el.querySelector('.row-item');
  row.addEventListener('click', (e) => {
    if (e.target.closest('button, input, textarea, a, select, label')) return;
    el.classList.toggle('expanded');
  });
}

function perspectiveCard(c) {
  const thumb = c.productImage
    ? '<img class="row-thumb" src="' + esc(c.productImage) + '">'
    : '<span class="status-dot amber"></span>';
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
      '<div class="row"><button class="primary btn-accept">Aceitar esta perspectiva</button></div>' +
      '<label>Ou descreva a perspectiva que prefere testar:<textarea class="f-feedback" rows="2" placeholder="Ex: focar em custo-benefício para famílias"></textarea></label>' +
      '<div class="row"><button class="btn-reject-feedback">Usar minha perspectiva</button></div>' +
    '</div>' +
  '</div>';
}

function wirePerspectiveCard(el) {
  toggleRow(el);
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

const IMAGE_STATUS_DOT = { none: 'gray', processing: 'amber', preview: 'blue', approved: 'green', failed: 'red' };
const IMAGE_STATUS_LABEL = { none: 'sem imagem', processing: 'gerando imagem', preview: 'imagem p/ revisar', approved: 'imagem aprovada', failed: 'imagem falhou' };

function candidateCard(c) {
  const imgStatus = c.imageStatus || 'none';
  const previewImg = c.imageUrl || c.productImage;
  const generating = imgStatus === 'processing';
  const needsImageReview = imgStatus === 'preview';
  const rowClass = c.status === 'approved' ? 'done' : (needsImageReview || imgStatus === 'failed' ? 'urgent' : 'review');
  const thumb = previewImg ? '<img class="row-thumb" src="' + esc(previewImg) + '">' : '<span class="status-dot ' + (IMAGE_STATUS_DOT[imgStatus] || 'gray') + '"></span>';

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
    (previewImg ? '<img class="thumb" src="' + esc(previewImg) + '">' : '') +
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

  return '<div class="candidate-wrap" data-id="' + c.id + '" data-image-status="' + esc(imgStatus) + '">' +
    '<div class="row-item ' + rowClass + '">' + thumb +
      '<div class="row-main">' +
        '<div class="row-title">' + esc(c.brand) + ' · ' + esc(c.merchantProductId) + ' · variação ' + c.variantIndex + fuzzyBadge(c) + '</div>' +
        '<div class="row-sub">' + esc(c.titleSuggestion || c.resolvedPerspective) + ' · ' + (IMAGE_STATUS_LABEL[imgStatus] || imgStatus) + '</div>' +
      '</div>' +
      '<span class="status">' + esc(c.status) + '</span>' +
      '<span class="chevron">▾</span>' +
    '</div>' +
    '<div class="detail">' +
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
    '</div>' +
  '</div>';
}

function pollImageStatus(el, id) {
  let attempts = 0;
  const poll = async () => {
    if (!document.body.contains(el)) return;
    attempts++;
    try {
      const result = await api('/api/candidates/' + id + '/check-image', { method: 'POST' });
      if (result.imageStatus === 'processing' && attempts < 20) { setTimeout(poll, 6000); return; }
    } catch (e) { /* fall through to reload below — the card will show whatever status actually persisted */ }
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
  toggleRow(el);
  const id = el.dataset.id;
  const getFields = () => ({
    titleSuggestion: el.querySelector('.f-title').value,
    descriptionSuggestion: el.querySelector('.f-desc').value,
    imageUrl: el.querySelector('.f-image').value || null
  });
  const save = el.querySelector('.btn-save');
  if (save) save.addEventListener('click', async () => {
    save.disabled = true; const original = save.textContent; save.textContent = 'Salvando...';
    try { await api('/api/candidates/' + id, { method: 'PATCH', body: JSON.stringify(getFields()) }); }
    catch (e) { alert('Erro: ' + e.message); }
    save.disabled = false; save.textContent = original;
    await loadAll();
  });
  const approve = el.querySelector('.btn-approve');
  if (approve) approve.addEventListener('click', async () => {
    approve.disabled = true; const original = approve.textContent; approve.textContent = 'Aprovando...';
    try {
      await api('/api/candidates/' + id, { method: 'PATCH', body: JSON.stringify(getFields()) });
      await api('/api/candidates/' + id + '/approve', { method: 'POST' });
    } catch (e) {
      alert('Erro: ' + e.message);
      approve.disabled = false; approve.textContent = original;
    }
    await loadAll();
  });
  const reject = el.querySelector('.btn-reject');
  if (reject) reject.addEventListener('click', async () => {
    if (!confirm('Rejeitar este candidato? Ele sai da fila de revisão (o produto pode voltar a ser proposto numa próxima descoberta).')) return;
    reject.disabled = true; const original = reject.textContent; reject.textContent = 'Rejeitando...';
    try { await api('/api/candidates/' + id + '/reject', { method: 'POST' }); }
    catch (e) { alert('Erro: ' + e.message); reject.disabled = false; reject.textContent = original; }
    await loadAll();
  });

  const approveImage = el.querySelector('.btn-approve-image');
  if (approveImage) approveImage.addEventListener('click', async () => {
    approveImage.disabled = true; const original = approveImage.textContent; approveImage.textContent = 'Aprovando...';
    try { await api('/api/candidates/' + id + '/image/approve', { method: 'POST' }); }
    catch (e) { alert('Erro: ' + e.message); approveImage.disabled = false; approveImage.textContent = original; }
    await loadAll();
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
    } catch (e) { alert('Erro: ' + e.message); }
    suggestPrompt.disabled = false; suggestPrompt.textContent = original;
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

loadAll();
</script>
</body>
</html>`;
