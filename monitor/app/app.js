const STATUS_URLS = [
  'https://raw.githubusercontent.com/GabrielGonzagaSilva/lottie-host/main/monitor/status.json',
  'https://cdn.jsdelivr.net/gh/GabrielGonzagaSilva/lottie-host@main/monitor/status.json'
];
const HISTORY_URLS = [
  'https://raw.githubusercontent.com/GabrielGonzagaSilva/lottie-host/main/monitor/history.json',
  'https://cdn.jsdelivr.net/gh/GabrielGonzagaSilva/lottie-host@main/monitor/history.json'
];
const LABELS = { online: 'Online', degraded: 'Atenção', offline: 'Offline', unknown: 'Indeterminado' };
const RANGE_MS = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
let state = { status: null, history: { sites: {} }, route: 'overview', range: '24h', manual: {} };

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(d);
};
const hostOf = url => { try { return new URL(url).hostname; } catch { return url || '—'; } };

async function fetchJsonWithFallback(urls) {
  let lastError;
  for (const base of urls) {
    try {
      const response = await fetch(`${base}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Falha ao carregar dados');
}

function routeFromHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, '').trim());
  if (!raw || raw === 'overview') return 'overview';
  return raw;
}

function siteById(id) {
  return state.status?.sites?.find(site => site.id === id) || null;
}

function samplesFor(id, range = state.range) {
  const all = state.history?.sites?.[id] || [];
  const cutoff = Date.now() - (RANGE_MS[range] || RANGE_MS['24h']);
  return all.filter(sample => new Date(sample.checked_at).getTime() >= cutoff);
}

function uptimeFor(id, range = state.range) {
  const samples = samplesFor(id, range);
  if (!samples.length) return null;
  const ok = samples.filter(s => s.status === 'online').length;
  return (ok / samples.length) * 100;
}

function overallUptime(range = state.range) {
  const sites = state.status?.sites || [];
  const values = sites.map(site => uptimeFor(site.id, range)).filter(v => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function currentAvgLatency() {
  const values = (state.status?.sites || []).map(s => s.latency_ms).filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function activeIssues() {
  return (state.status?.sites || []).reduce((sum, site) => sum + (Array.isArray(site.issues) ? site.issues.length : 0), 0);
}

function cssStatus(status) { return ['online', 'degraded', 'offline'].includes(status) ? status : 'unknown'; }

function metric(label, value, note = '', tone = '') {
  return `<article class="card metric"><div class="metric-label">${esc(label)}</div><div class="metric-value ${tone}">${esc(value)}</div><div class="metric-note">${note}</div></article>`;
}

function analyticsCard(projectName = 'Todos os projetos') {
  return `<article class="card card-body analytics-empty">
    <div class="analytics-icon">↗</div>
    <strong>Monitoramento de acessos</strong>
    <p>${esc(projectName)} ainda não possui uma fonte de Analytics conectada ao Gabriel Ops. O painel não exibe pageviews, visitantes ativos ou dispositivos até existir uma fonte real de dados.</p>
  </article>`;
}

function uptimeCard(siteId = null) {
  const uptime = siteId ? uptimeFor(siteId) : overallUptime();
  const display = uptime === null ? 'Coletando' : `${uptime.toFixed(uptime >= 99 ? 2 : 1)}%`;
  const percent = uptime === null ? 0 : Math.max(0, Math.min(100, uptime));
  const rows = ['24h', '7d', '30d'].map(range => {
    const value = siteId ? uptimeFor(siteId, range) : overallUptime(range);
    return `<div class="uptime-row"><span>${range.toUpperCase()}</span><strong>${value === null ? 'Coletando' : value.toFixed(value >= 99 ? 2 : 1) + '%'}</strong></div>`;
  }).join('');
  return `<article class="card card-body"><div class="card-header"><div class="card-title">Uptime</div><div class="card-info">Histórico real</div></div>
    <div class="uptime-layout"><div class="circle" style="--percent:${percent}"><div class="circle-inner"><strong>${display}</strong><span>${uptime === null ? 'histórico iniciando' : 'disponibilidade'}</span></div></div><div class="uptime-data">${rows}</div></div>
  </article>`;
}

function sampleStats(samples) {
  const latencies = samples.map(s => s.latency_ms).filter(Number.isFinite);
  if (!latencies.length) return { min: null, max: null, avg: null };
  return {
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
  };
}

function lineChart(samples, title = 'Latência') {
  const valid = samples.filter(s => Number.isFinite(s.latency_ms));
  const rangeButtons = ['24h', '7d', '30d'].map(range => `<button type="button" data-range="${range}" class="${state.range === range ? 'active' : ''}">${range.toUpperCase()}</button>`).join('');
  if (valid.length < 2) {
    return `<article class="card card-body"><div class="card-header"><div><div class="card-title">${esc(title)}</div><div class="card-info">Histórico de performance</div></div><div class="range">${rangeButtons}</div></div><div class="chart-empty">O histórico real começou a ser coletado agora.<br>O gráfico aparecerá automaticamente após novas checagens.</div></article>`;
  }
  const width = 720, height = 210, pad = 12;
  const values = valid.map(s => s.latency_ms);
  const min = Math.min(...values), max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = valid.map((sample, index) => {
    const x = pad + (index / Math.max(1, valid.length - 1)) * (width - pad * 2);
    const y = pad + (1 - ((sample.latency_ms - min) / spread)) * (height - pad * 2);
    return { x, y, sample };
  });
  const line = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const grid = [0.2, 0.4, 0.6, 0.8].map(v => `<line class="grid-line" x1="0" x2="${width}" y1="${(height * v).toFixed(1)}" y2="${(height * v).toFixed(1)}"></line>`).join('');
  const stats = sampleStats(valid);
  return `<article class="card card-body"><div class="card-header"><div><div class="card-title">${esc(title)}</div><div class="card-info">${valid.length} amostras reais</div></div><div class="range">${rangeButtons}</div></div>
    <div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ef66ff" stop-opacity=".25"/><stop offset="100%" stop-color="#7c36ff" stop-opacity="0"/></linearGradient></defs>${grid}<polygon class="chart-area" points="${area}"></polygon><polyline class="chart-line" points="${line}"></polyline></svg></div>
    <div class="chart-meta"><span>Mín. ${stats.min} ms</span><span>Média ${stats.avg} ms</span><span>Máx. ${stats.max} ms</span></div>
  </article>`;
}

function issuesMarkup(site = null) {
  const items = site ? (site.issues || []) : (state.status?.sites || []).flatMap(s => (s.issues || []).map(issue => ({ ...issue, project: s.name })));
  if (!items.length) return `<div class="incident"><div class="incident-main"><div class="incident-icon">✓</div><div><strong>Tudo operacional</strong><span>Nenhum incidente identificado na última checagem.</span></div></div><strong class="green">0</strong></div>`;
  return items.map(issue => {
    const severity = issue.severity === 'critical' ? 'critical' : issue.severity === 'warning' ? 'warning' : '';
    return `<div class="incident ${severity}"><div class="incident-main"><div class="incident-icon">${severity === 'critical' ? '!' : severity === 'warning' ? '•' : 'i'}</div><div><strong>${esc(issue.project ? `${issue.project} · ${issue.title}` : issue.title)}</strong><span>${esc(issue.detail || 'Ocorrência detectada')}</span></div></div></div>`;
  }).join('');
}

function projectRows() {
  return (state.status?.sites || []).map(site => `<div class="project" data-open-project="${esc(site.id)}"><div class="project-title"><span class="status-dot ${cssStatus(site.status)}"></span><div><strong>${esc(site.name)}</strong><span>${esc(hostOf(site.url))}</span></div></div><div class="project-info">HTTP ${esc(site.status_code ?? '—')}</div><div class="project-info">${esc(Number.isFinite(site.latency_ms) ? site.latency_ms + ' ms' : '—')}</div><div class="project-info ${site.status === 'online' ? 'green' : site.status === 'degraded' ? 'yellow' : 'red'}">${esc(LABELS[site.status] || site.status)}</div></div>`).join('');
}

function renderOverview() {
  const data = state.status;
  const uptime = overallUptime('30d');
  const avgLatency = currentAvgLatency();
  const issues = activeIssues();
  const aggregateSamples = [];
  (data.sites || []).forEach(site => aggregateSamples.push(...samplesFor(site.id)));
  aggregateSamples.sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));

  $('pageHead').innerHTML = `<div><div class="eyebrow">Command Center</div><h1>Overview</h1><div class="subtitle">Visão geral do status, performance e histórico dos projetos monitorados.</div></div><div class="last-check">Última checagem automática<br><strong>${esc(fmtDate(data.generated_at))}</strong></div>`;
  $('content').innerHTML = `
    <section class="metrics">
      ${metric('Sistemas online', `${data.counts?.online ?? 0} / ${data.sites?.length ?? 0}`, `${data.counts?.degraded ?? 0} em atenção · ${data.counts?.offline ?? 0} offline`, data.counts?.offline ? 'red' : data.counts?.degraded ? 'yellow' : 'green')}
      ${metric('Uptime 30 dias', uptime === null ? 'Coletando' : uptime.toFixed(2) + '%', uptime === null ? 'Histórico iniciado agora' : 'Baseado nas amostras do monitor')}
      ${metric('Latência média', avgLatency === null ? '—' : `${avgLatency} ms`, 'Média da última checagem', 'purple')}
      ${metric('Acessos', '—', 'Analytics não conectado')}
      ${metric('Incidentes ativos', String(issues), issues ? 'Requer revisão' : 'Nenhum problema', issues ? 'yellow' : 'green')}
    </section>
    <section class="dashboard-grid">${lineChart(aggregateSamples, 'Latência geral')}${analyticsCard()}</section>
    <section class="dashboard-grid"><article class="card card-body"><div class="card-header"><div class="card-title">Infraestrutura</div><div class="card-info">${data.sites.length} projetos</div></div><div class="projects">${projectRows()}</div></article>${uptimeCard()}</section>
    <section class="card card-body"><div class="card-header"><div class="card-title">Incidentes</div><div class="card-info">Última checagem</div></div><div class="incident-list">${issuesMarkup()}</div></section>`;
}

function renderProject(site) {
  const samples = samplesFor(site.id);
  const uptime30 = uptimeFor(site.id, '30d');
  const sslDays = site.ssl?.days_remaining;
  const issues = Array.isArray(site.issues) ? site.issues.length : 0;
  const manual = state.manual[site.id];

  $('pageHead').innerHTML = `<div><div class="eyebrow">Projeto monitorado</div><h1>${esc(site.name)}</h1><div class="subtitle">${esc(site.url)}</div></div><div class="last-check"><span class="badge ${cssStatus(site.status)}"><span class="status-dot ${cssStatus(site.status)}"></span>${esc(LABELS[site.status] || site.status)}</span><br>Última checagem · <strong>${esc(fmtDate(site.checked_at))}</strong></div>`;
  $('content').innerHTML = `
    ${manual ? `<div class="manual-result show"><span>Checagem manual · ${esc(fmtDate(manual.checked_at))}</span><strong class="${manual.status === 'online' ? 'green' : manual.status === 'degraded' ? 'yellow' : manual.status === 'offline' ? 'red' : ''}">${esc(manual.label)}${manual.http_code ? ' · HTTP ' + esc(manual.http_code) : ''}${Number.isFinite(manual.latency_ms) ? ' · ' + esc(manual.latency_ms) + ' ms' : ''}</strong></div>` : ''}
    <section class="metrics">
      ${metric('Status', LABELS[site.status] || site.status, site.error ? esc(site.error) : 'Última checagem automática', site.status === 'online' ? 'green' : site.status === 'degraded' ? 'yellow' : 'red')}
      ${metric('HTTP', site.status_code ?? '—', 'Resposta atual')}
      ${metric('Latência', Number.isFinite(site.latency_ms) ? `${site.latency_ms} ms` : '—', 'Tempo da última resposta', 'purple')}
      ${metric('Uptime 30 dias', uptime30 === null ? 'Coletando' : uptime30.toFixed(2) + '%', uptime30 === null ? 'Histórico iniciado agora' : 'Amostras reais')}
      ${metric('SSL', Number.isFinite(sslDays) ? `${sslDays} dias` : '—', site.ssl?.expires_at ? `Expira ${fmtDate(site.ssl.expires_at)}` : 'Validação SSL')}
    </section>
    <section class="dashboard-grid">${lineChart(samples, `Latência · ${site.name}`)}${uptimeCard(site.id)}</section>
    <section class="dashboard-grid">${analyticsCard(site.name)}<article class="card card-body"><div class="card-header"><div class="card-title">Detalhes técnicos</div><div class="card-info">Agora</div></div><div class="detail-list">
      <div class="detail-row"><span>URL monitorada</span><strong><a href="${esc(site.url)}" target="_blank" rel="noreferrer">${esc(site.url)}</a></strong></div>
      <div class="detail-row"><span>Destino final</span><strong>${esc(site.final_url || '—')}</strong></div>
      <div class="detail-row"><span>Repositório</span><strong>${site.repo ? `<a href="https://github.com/${esc(site.repo)}" target="_blank" rel="noreferrer">${esc(site.repo)}</a>` : '—'}</strong></div>
      <div class="detail-row"><span>Última checagem</span><strong>${esc(fmtDate(site.checked_at))}</strong></div>
      <div class="detail-row"><span>Certificado SSL</span><strong>${site.ssl?.expires_at ? `${esc(sslDays)} dias restantes` : '—'}</strong></div>
      <div class="detail-row"><span>Incidentes ativos</span><strong class="${issues ? 'yellow' : 'green'}">${issues}</strong></div>
    </div></article></section>
    <section class="card card-body"><div class="card-header"><div class="card-title">Incidentes e bugs</div><div class="card-info">${issues} item(ns)</div></div><div class="incident-list">${issuesMarkup(site)}</div></section>`;
}

function renderNav() {
  const sites = state.status?.sites || [];
  $('nav').innerHTML = `<button class="nav-item ${state.route === 'overview' ? 'active' : ''}" data-route="overview">Overview</button>${sites.map(site => `<button class="nav-item ${state.route === site.id ? 'active' : ''}" data-route="${esc(site.id)}">${esc(site.name)}</button>`).join('')}`;
  $('mobileSelect').innerHTML = `<option value="overview">Overview</option>${sites.map(site => `<option value="${esc(site.id)}">${esc(site.name)}</option>`).join('')}`;
  $('mobileSelect').value = state.route;
}

function render() {
  if (!state.status) return;
  state.route = routeFromHash();
  if (state.route !== 'overview' && !siteById(state.route)) state.route = 'overview';
  renderNav();
  const site = siteById(state.route);
  if (site) renderProject(site); else renderOverview();
  bindDynamicEvents();
}

function bindDynamicEvents() {
  document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => { location.hash = button.dataset.route === 'overview' ? '#/overview' : `#/${button.dataset.route}`; }));
  document.querySelectorAll('[data-open-project]').forEach(row => row.addEventListener('click', () => { location.hash = `#/${row.dataset.openProject}`; }));
  document.querySelectorAll('[data-range]').forEach(button => button.addEventListener('click', () => { state.range = button.dataset.range; render(); }));
}

async function proxyProbe(site) {
  const started = performance.now();
  const target = site.url + (site.url.includes('?') ? '&' : '?') + 'gabriel_ops_check=' + Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(target), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Proxy indisponível');
    const payload = await response.json();
    const code = Number(payload?.status?.http_code) || null;
    let status = 'unknown';
    if (code >= 200 && code < 400) status = 'online';
    else if (code >= 400 && code < 500) status = 'degraded';
    else if (code >= 500) status = 'offline';
    else if (payload?.contents) status = 'online';
    return { status, http_code: code, latency_ms: Math.round(performance.now() - started), checked_at: new Date().toISOString(), label: status === 'online' ? 'Acessível agora' : status === 'degraded' ? 'Respondendo com atenção' : status === 'offline' ? 'Falha confirmada' : 'Não foi possível confirmar' };
  } finally { clearTimeout(timeout); }
}

async function directProbe(site) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(site.url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: controller.signal });
    return { status: 'online', http_code: null, latency_ms: Math.round(performance.now() - started), checked_at: new Date().toISOString(), label: 'Acessível agora' };
  } catch {
    return { status: 'unknown', http_code: null, latency_ms: Math.round(performance.now() - started), checked_at: new Date().toISOString(), label: 'Browser bloqueou a confirmação' };
  } finally { clearTimeout(timeout); }
}

async function probe(site) {
  try { return await proxyProbe(site); } catch { return await directProbe(site); }
}

async function checkNow() {
  if (!state.status?.sites?.length) return;
  const button = $('checkNow');
  const label = $('checkLabel');
  button.disabled = true;
  button.classList.add('loading');
  label.textContent = state.route === 'overview' ? 'Checando todos…' : 'Checando…';
  $('notice').classList.add('show');
  try {
    const targets = state.route === 'overview' ? state.status.sites : [siteById(state.route)].filter(Boolean);
    const results = await Promise.all(targets.map(async site => [site.id, await probe(site)]));
    results.forEach(([id, result]) => { state.manual[id] = result; });
    render();
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    label.textContent = 'Checar agora';
  }
}

async function load() {
  try {
    const status = await fetchJsonWithFallback(STATUS_URLS);
    let history = { sites: {} };
    try { history = await fetchJsonWithFallback(HISTORY_URLS); } catch { }
    state.status = status;
    state.history = history;
    render();
    $('loading').hidden = true;
    $('dashboard').hidden = false;
  } catch (error) {
    $('loading').innerHTML = `<div class="card error-card"><strong>Não foi possível carregar o Gabriel Ops.</strong><span>${esc(error?.message || 'Falha de rede')}</span></div>`;
  }
}

$('checkNow').addEventListener('click', checkNow);
$('mobileSelect').addEventListener('change', event => { location.hash = event.target.value === 'overview' ? '#/overview' : `#/${event.target.value}`; });
window.addEventListener('hashchange', () => { state.route = routeFromHash(); render(); });
load();
setInterval(load, 60000);
