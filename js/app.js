// DAWRA — farmer platform interface: farm profile wizard, dashboard (no login; profile kept in this browser)
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const CROPS = window.CROPS, E = window.ENGINE;
  const HIST_SEASONS = ['2023–24', '2024–25', '2025–26'];   // index 0 = 2 years ago, 2 = this year
  const NEXT_SEASONS = ['2026–27', '2027–28', '2028–29'];
  const IND_ICONS = { heat: '🌡️', water: '💧', rain: '🌧️', ground: '⛏️', frost: '❄️', erosion: '⛰️' };
  const PRIO_ICONS = { water: '💧', income: '💰', soil: '🌱', forage: '🐄' };
  const SOIL_ICONS = { clay: '🟫', loam: '🟤', sandy: '🏜️', stony: '🪨', salty: '🧂', unknown: '❔' };
  const TREE_ICONS = { olive: '🫒', almond: '🌰', citrus: '🍊', pomegranate: '🔴' };
  const WZ_STEPS = 5;

  // Escape every user-supplied string before it goes into HTML (XSS protection)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    lang: localStorage.getItem('dawra.lang') || 'ar',
    user: loadUser(), draft: null, wz: 0,
    zone: null, farm: null, climate: null, source: null, ind: null, rec: null, selected: 1,
    screen: 'home'
  };
  function loadUser() {
    try { const p = JSON.parse(localStorage.getItem('dawra.profile')); return p ? { name: '', profile: p } : null; }
    catch (e) { return null; }
  }

  // ---------- i18n ----------
  const t = k => (window.I18N[state.lang][k] ?? window.I18N.en[k] ?? k);
  const fmt = (k, vars) => t(k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
  const cname = id => CROPS[id] ? CROPS[id].name[state.lang] : id;
  const loc = () => ({ ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' }[state.lang]);
  const nf = n => Number(n).toLocaleString(loc());

  function applyLang(lang) {
    state.lang = lang;
    localStorage.setItem('dawra.lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = t('dir');
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('.langs button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    renderDemoChips();
    if (state.screen === 'onboard') renderWizard();
    if (state.rec) { renderDashboard(); }
    if (state.user) renderProfileView();
  }

  // ---------- screens ----------
  const DASH = ['card', 'compare', 'build', 'detail', 'profile'];
  const bdi = s => `<bdi class="n">${s}</bdi>`; // keep numbers/dates left-to-right inside Arabic text
  function show(screen) {
    state.screen = screen;
    $$('.screen').forEach(el => el.classList.toggle('active', el.id === 's-' + screen));
    $('#wizSteps').hidden = screen !== 'onboard';
    $('#dashTabs').hidden = !DASH.includes(screen);
    $$('#dashTabs button').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === screen);
      b.disabled = b.dataset.tab !== 'profile' && !state.rec;
    });
    $('#advisorSwitch').hidden = !state.user;
    if (screen === 'onboard') setTimeout(() => map && map.invalidateSize(), 80);
    if (screen === 'card' && state.rec) setTimeout(drawCharts, 60);
    if (screen === 'build' && state.rec) renderBuild();
    if (screen === 'detail' && state.rec) renderDetail(state.selected);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab && !tab.disabled) { e.preventDefault(); show(tab.dataset.tab); }
    if (e.target.closest('[data-start]')) { if (state.user && state.user.profile.complete) analyse(); else if (state.draft) show('onboard'); else startWizard(); }
  });
  $('#brandLink').addEventListener('click', e => {
    e.preventDefault();
    if (!state.user) show('home');   // the logo opens the info page
    else if (state.rec) show('card');
    else show('onboard');
  });

  // ---------- clear saved farm ----------
  $('#logoutBtn').addEventListener('click', () => {
    if (!confirm(t('prof.logout') + ' ?')) return;
    localStorage.removeItem('dawra.profile');
    Object.assign(state, { user: null, draft: null, rec: null, farm: null, climate: null });
    document.body.classList.remove('advisor'); $('#advisorToggle').checked = false;
    show('home');
  });

  // ---------- wizard ----------
  function emptyProfile() {
    return {
      field: null, place: '', area: '', soil: null,
      well: null, wellState: null, wellDepth: null, canal: null, waterLevel: 2, method: 'gravity',
      crops: { main: ['durum', 'durum', 'durum'], summer: ['none', 'none', 'none'] },
      cont: null, stopReason: null, trees: [], fert: null, pest: null, livestock: null, prio: []
    };
  }
  function startWizard(edit) {
    state.draft = edit && state.user && state.user.profile ? JSON.parse(JSON.stringify(state.user.profile)) : emptyProfile();
    state.wz = 0;
    initMap();
    show('onboard');
    renderWizard();
  }
  $('#editProfile').addEventListener('click', () => startWizard(true));

  function waterType(p) {
    const wellOk = p.well && p.wellState !== 'dry';
    if (p.canal && wellOk) return 'mixed';
    if (p.canal) return 'canal';
    if (wellOk) return 'well';
    return 'rain';
  }
  function renderWizard() {
    const p = state.draft; if (!p) return;
    $('#wzTitle').textContent = fmt('wz.title', { name: state.user ? state.user.name : '' });
    $$('.wz').forEach(el => el.classList.toggle('on', +el.dataset.step === state.wz));
    $$('#wizSteps button').forEach(b => {
      const i = +b.dataset.wz;
      b.classList.toggle('on', i === state.wz); b.classList.toggle('done', i < state.wz);
      b.disabled = i > state.wz;
    });
    $('#wzBack').style.visibility = state.wz === 0 ? 'hidden' : 'visible';
    $('#wzNext').textContent = t(state.wz === WZ_STEPS - 1 ? 'wz.finish' : 'wz.next');
    $('#wzErr').hidden = true;
    // step 1
    renderSel();
    $('#fPlace').value = p.place || '';
    $('#fArea').value = p.area || '';
    $$('#soilTiles button').forEach(b => b.classList.toggle('on', b.dataset.soil === p.soil));
    // step 2
    $$('#wellTiles button').forEach(b => b.classList.toggle('on', p.well !== null && (b.dataset.well === '1') === p.well));
    $('#wellMore').hidden = !p.well;
    $$('#wellStateTiles button').forEach(b => b.classList.toggle('on', b.dataset.wstate === p.wellState));
    $$('#wellDepthTiles button').forEach(b => b.classList.toggle('on', b.dataset.wdepth === p.wellDepth));
    $$('#canalTiles button').forEach(b => b.classList.toggle('on', p.canal !== null && (b.dataset.canal === '1') === p.canal));
    const wt = waterType(p), answered = p.well !== null && p.canal !== null;
    $('#irrigBox').hidden = !answered || wt === 'rain';
    $('#rainOnly').hidden = !answered || wt !== 'rain';
    $$('#levelTiles button').forEach(b => b.classList.toggle('on', +b.dataset.level === p.waterLevel));
    $$('#methodSeg button').forEach(b => b.classList.toggle('on', b.dataset.method === p.method));
    // step 3
    renderHistory();
    $('#contQ').textContent = fmt('cont.q', { c: cname(p.crops.main[2]) });
    $$('#contTiles button').forEach(b => b.classList.toggle('on', b.dataset.cont === p.cont));
    $('#stopBox').hidden = p.cont !== 'no';
    $$('#stopTiles button').forEach(b => b.classList.toggle('on', b.dataset.stop === p.stopReason));
    $$('#treeTiles button').forEach(b => b.classList.toggle('on', p.trees.includes(b.dataset.tree)));
    // step 4
    $$('#fertTiles button').forEach(b => b.classList.toggle('on', b.dataset.fert === p.fert));
    $$('#pestTiles button').forEach(b => b.classList.toggle('on', b.dataset.pest === p.pest));
    $$('#liveTiles button').forEach(b => b.classList.toggle('on', p.livestock !== null && (b.dataset.live === '1') === p.livestock));
    // step 5
    $$('#prioTiles button').forEach(b => {
      const i = p.prio.indexOf(b.dataset.prio);
      b.classList.toggle('on', i >= 0);
      b.querySelector('em').textContent = i >= 0 ? i + 1 : '';
    });
    if (state.wz === WZ_STEPS - 1) $('#profileSummary').innerHTML = summaryHTML(p);
  }
  function wzError(key) { const er = $('#wzErr'); er.textContent = t(key); er.hidden = false; er.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  function validateStep(i) {
    const p = state.draft;
    if (i === 0) {
      if (!p.field) return 'err.field';
      const a = parseFloat(p.area);
      if (!(a > 0 && a <= 5000)) return 'err.area';
      if (!p.soil) return 'err.soil';
    }
    if (i === 1) {
      if (p.well === null) return 'err.well';
      if (p.well && !p.wellState) return 'err.wellState';
      if (p.canal === null) return 'err.canal';
    }
    if (i === 2) {
      if (!p.cont) return 'err.cont';
      if (!p.trees.length) return 'err.trees';
    }
    if (i === 3) {
      if (!p.fert) return 'err.fert';
      if (!p.pest) return 'err.pest';
      if (p.livestock === null) return 'err.live';
    }
    if (i === 4 && p.prio.length !== 4) return 'farm.err.prio';
    return null;
  }
  $('#wzNext').addEventListener('click', async () => {
    const err = validateStep(state.wz);
    if (err) return wzError(err);
    if (state.wz < WZ_STEPS - 1) { state.wz++; renderWizard(); window.scrollTo({ top: 0, behavior: 'smooth' }); if (state.wz === 0) map.invalidateSize(); return; }
    // save profile
    const p = { ...state.draft, area: parseFloat(state.draft.area), complete: true };
    p.updated = new Date().toISOString();
    try { localStorage.setItem('dawra.profile', JSON.stringify(p)); } catch (e) { /* private mode: keep it for this visit only */ }
    state.user = { name: '', profile: p };
    analyse();
  });
  $('#wzBack').addEventListener('click', () => { if (state.wz > 0) { state.wz--; renderWizard(); if (state.wz === 0) setTimeout(() => map.invalidateSize(), 60); } });
  $('#wizSteps').addEventListener('click', e => { const b = e.target.closest('[data-wz]'); if (b && +b.dataset.wz < state.wz) { state.wz = +b.dataset.wz; renderWizard(); } });

  // tile handlers
  const onTiles = (sel, attr, fn) => $(sel).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !state.draft) return;
    fn(b.dataset[attr], state.draft); renderWizard();
  });
  onTiles('#soilTiles', 'soil', (v, p) => { p.soil = v; });
  onTiles('#wellTiles', 'well', (v, p) => { p.well = v === '1'; if (!p.well) { p.wellState = null; p.wellDepth = null; } });
  onTiles('#wellStateTiles', 'wstate', (v, p) => { p.wellState = v; });
  onTiles('#wellDepthTiles', 'wdepth', (v, p) => { p.wellDepth = v; });
  onTiles('#canalTiles', 'canal', (v, p) => { p.canal = v === '1'; });
  onTiles('#levelTiles', 'level', (v, p) => { p.waterLevel = +v; });
  onTiles('#methodSeg', 'method', (v, p) => { p.method = v; });
  onTiles('#contTiles', 'cont', (v, p) => { p.cont = v; if (v !== 'no') p.stopReason = null; });
  onTiles('#stopTiles', 'stop', (v, p) => { p.stopReason = v; });
  onTiles('#treeTiles', 'tree', (v, p) => {
    if (v === 'none') p.trees = p.trees.includes('none') ? [] : ['none'];
    else { p.trees = p.trees.filter(x => x !== 'none'); p.trees = p.trees.includes(v) ? p.trees.filter(x => x !== v) : [...p.trees, v]; }
  });
  onTiles('#fertTiles', 'fert', (v, p) => { p.fert = v; });
  onTiles('#pestTiles', 'pest', (v, p) => { p.pest = v; });
  onTiles('#liveTiles', 'live', (v, p) => { p.livestock = v === '1'; });
  onTiles('#prioTiles', 'prio', (v, p) => { p.prio = p.prio.includes(v) ? p.prio.filter(x => x !== v) : [...p.prio, v]; });
  $('#prioReset').addEventListener('click', () => { if (state.draft) { state.draft.prio = []; renderWizard(); } });
  $('#fPlace').addEventListener('input', e => { if (state.draft) state.draft.place = e.target.value.slice(0, 80); });
  $('#fArea').addEventListener('input', e => { if (state.draft) state.draft.area = e.target.value; });

  // crop history
  function summerAllowed(main, p) {
    const k = CROPS[main].kc;
    const rain = p.well !== null && p.canal !== null && waterType(p) === 'rain';
    return !rain && k[5] === 0 && k[6] === 0;
  }
  function renderHistory() {
    const p = state.draft; if (!p) return;
    // only restrict to rain-fed crops once the water questions are answered
    const rain = p.well !== null && p.canal !== null && waterType(p) === 'rain';
    if (rain) { p.crops.summer = ['none', 'none', 'none']; p.crops.main = p.crops.main.map(id => CROPS[id].rainfed ? id : 'durum'); }
    $('#historyBox').innerHTML = [2, 1, 0].map(i => `
      <div class="hist-year">
        <h4>${t('hist.' + i)} · ${HIST_SEASONS[i]}</h4>
        <div class="crop-pick">${window.MAIN_CROPS.filter(id => !rain || CROPS[id].rainfed).map(id =>
          `<button type="button" data-y="${i}" data-main="${id}" class="${p.crops.main[i] === id ? 'on' : ''}">${CROPS[id].icon} ${cname(id)}</button>`).join('')}</div>
        ${summerAllowed(p.crops.main[i], p) ? `<div class="summer-pick crop-pick"><b>☀️ ${t('farm.summer')}</b>${window.SUMMER_CROPS.map(id =>
          `<button type="button" data-y="${i}" data-summer="${id}" class="${p.crops.summer[i] === id ? 'on' : ''}">${id === 'none' ? '— ' + t('farm.none') : CROPS[id].icon + ' ' + cname(id)}</button>`).join('')}</div>` : ''}
      </div>`).join('');
  }
  $('#historyBox').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !state.draft) return;
    const p = state.draft, y = +b.dataset.y;
    if (b.dataset.main) { p.crops.main[y] = b.dataset.main; if (!summerAllowed(b.dataset.main, p)) p.crops.summer[y] = 'none'; }
    if (b.dataset.summer) p.crops.summer[y] = b.dataset.summer;
    renderWizard();
  });

  // ---------- map ----------
  let map, marker;
  function initMap() {
    if (map) return;
    map = L.map('map').setView([32.45, -6.55], innerWidth < 760 ? 8 : 9);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(map);
    window.ZONES.forEach(z => {
      L.circle([z.lat, z.lng], { radius: 9000, color: z.system === 'irrigated' ? '#4fc3f7' : z.system === 'rainfed' ? '#ffcc66' : '#a5d6a7', weight: 1.5, fillOpacity: 0.08 })
        .addTo(map).bindTooltip(() => z.name[state.lang]);
    });
    map.on('click', e => setField(e.latlng.lat, e.latlng.lng));
  }
  function distKm(a, b, c, d) {
    const r = Math.PI / 180;
    const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(x));
  }
  function findZone(lat, lng) {
    let best = null, bd = 1e9;
    window.ZONES.forEach(z => { const d = distKm(lat, lng, z.lat, z.lng); if (d < bd) { bd = d; best = z; } });
    return bd <= 45 ? best : window.GENERIC_ZONE;
  }
  function setField(lat, lng) {
    const p = state.draft; if (!p) return;
    const first = !p.field;
    p.field = { lat: +lat.toFixed(5), lng: +lng.toFixed(5) };
    const z = findZone(lat, lng);
    if (first) p.crops = JSON.parse(JSON.stringify(z.current)); // sensible starting point, farmer edits in step 3
    if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], Math.max(map.getZoom(), 12));
    renderWizard();
  }
  function renderSel() {
    const p = state.draft, box = $('#selInfo');
    if (!p || !p.field) { box.innerHTML = '<span class="big-emo">📍</span><span class="muted">' + esc(t('map.none')) + '</span>'; return; }
    const z = findZone(p.field.lat, p.field.lng);
    if (map) { if (marker) marker.setLatLng([p.field.lat, p.field.lng]); else marker = L.marker([p.field.lat, p.field.lng]).addTo(map); }
    box.innerHTML = `<span class="big-emo">🌾</span><div><b>${t('map.selected')}:</b> ${p.field.lat.toFixed(4)}, ${p.field.lng.toFixed(4)}<br><b>${t('map.zone')}:</b> ${esc(z.name[state.lang])}</div>${z.generic ? '<div class="warn">⚠️ ' + t('map.far') + '</div>' : ''}`;
  }
  function renderDemoChips() {
    $('#demoFields').innerHTML = window.DEMO_FIELDS.map((d, i) => `<button type="button" class="chip" data-demo="${i}">${esc(d.label[state.lang])}</button>`).join('');
  }
  $('#demoFields').addEventListener('click', e => {
    const b = e.target.closest('[data-demo]'); if (!b) return;
    const d = window.DEMO_FIELDS[+b.dataset.demo];
    if (state.draft) state.draft.field = null; // reset crops to the zone's typical rotation
    setField(d.lat, d.lng);
  });
  $('#gpsBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => setField(pos.coords.latitude, pos.coords.longitude), () => wzError('err.field'));
  });

  // ---------- profile → engine farm ----------
  function farmFromProfile(p) {
    const water = waterType(p);
    let level = p.waterLevel || 2;
    if (water === 'well' && p.wellState === 'weak') level = Math.min(level, 2);
    return {
      current: JSON.parse(JSON.stringify(p.crops)), water, waterLevel: level, method: p.method || 'gravity',
      livestock: !!p.livestock, prio: p.prio.slice(), area: p.area, soil: p.soil, fert: p.fert, pest: p.pest,
      continue: p.cont, stopReason: p.stopReason
    };
  }
  function summaryHTML(p) {
    const water = waterType(p);
    const wparts = [];
    if (p.well) wparts.push(`⛏️ ${t('well')}: ${t('well.' + p.wellState)}${p.wellDepth ? ' · ' + t('depth.' + p.wellDepth) : ''}`);
    if (p.canal) wparts.push('🚰 ' + t('canal'));
    if (water === 'rain') wparts.push('🌧️ ' + t('water.rain'));
    else wparts.push(`${t('wl.' + p.waterLevel)} · ${t('m.' + p.method)}`);
    const crops = [2, 1, 0].map(i => `${HIST_SEASONS[i]}: ${CROPS[p.crops.main[i]].icon} ${esc(cname(p.crops.main[i]))}${p.crops.summer[i] !== 'none' ? ' + ☀️ ' + esc(cname(p.crops.summer[i])) : ''}`).join('<br>');
    const plan = p.cont ? t('cont.' + p.cont) + (p.stopReason ? ' (' + t('stop.' + p.stopReason) + ')' : '') : '—';
    const trees = p.trees.includes('none') || !p.trees.length ? t('tree.none') : p.trees.map(x => TREE_ICONS[x] + ' ' + t('tree.' + x)).join('، ');
    const row = (k, v) => `<dt>${t(k)}</dt><dd>${v}</dd>`;
    return `<dl>
      ${row('sum.place', (p.place ? esc(p.place) + ' · ' : '') + (p.field ? esc(findZone(p.field.lat, p.field.lng).name[state.lang]) : '—'))}
      ${row('sum.area', esc(p.area) + ' ' + t('ha'))}
      ${row('sum.soil', p.soil ? SOIL_ICONS[p.soil] + ' ' + t('soil.' + p.soil) : '—')}
      ${row('sum.water', wparts.join('<br>'))}
      ${row('sum.crops', crops)}
      ${row('sum.plan', plan)}
      ${row('sum.trees', trees)}
      ${row('sum.fert', p.fert ? t('fert.' + p.fert) : '—')}
      ${row('sum.pest', p.pest ? t('pest.' + p.pest) : '—')}
      ${row('sum.live', p.livestock === null ? '—' : t(p.livestock ? 'yes' : 'no'))}
      ${row('sum.prio', p.prio.map((x, i) => `${i + 1}. ${PRIO_ICONS[x]} ${t('prio.' + x)}`).join(' · ') || '—')}
      ${p.updated ? row('sum.updated', new Date(p.updated).toLocaleString(loc())) : ''}
    </dl>`;
  }
  function renderProfileView() {
    if (state.user && state.user.profile) $('#profileView').innerHTML = summaryHTML(state.user.profile);
  }
  $('#refreshBtn').addEventListener('click', () => analyse());

  // ---------- analysis ----------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function analyse() {
    const p = state.user.profile;
    if (!p || !p.complete) return startWizard();
    const steps = ['power', 'smap', 'imerg', 'grace', 'ndvi', 'srtm', 'engine'];
    $('#loadSteps').innerHTML = steps.map(s => `<li data-s="${s}">${t('load.' + s)}</li>`).join('');
    $('#loading').hidden = false;
    const done = s => { const li = $(`#loadSteps li[data-s="${s}"]`); if (li) li.classList.add('done'); };
    state.zone = findZone(p.field.lat, p.field.lng);
    state.farm = farmFromProfile(p);
    const { climate, source } = await window.NASA.getClimate(p.field.lat, p.field.lng, done);
    for (const s of ['smap', 'imerg', 'grace', 'ndvi', 'srtm']) { await sleep(150); done(s); }
    state.climate = climate; state.source = source;
    state.ind = E.indicators(climate, state.zone, state.farm);
    state.rec = E.recommend(climate, state.zone, state.farm);
    await sleep(200); done('engine'); await sleep(200);
    $('#loading').hidden = true;
    state.selected = 1; state.custom = null; state.build = null;
    initSim(); $('#simActive').hidden = true; $('#simBox').open = false;
    renderDashboard(); renderProfileView();
    show('card');
  }
  function renderDashboard() { renderCard(); renderCompare(); renderDetail(state.selected); }

  // ---------- field card ----------
  const srcBadge = () => `<span class="badge ${state.source}">🛰️ ${t('src.' + state.source)}</span>`;
  function renderCard() {
    const p = state.user.profile, z = state.zone, f = state.farm;
    const waterTxt = f.water === 'rain' ? '🌧️ ' + t('water.rain') : (p.well ? '⛏️ ' + t('well') + ' ' : '') + (p.canal ? '🚰 ' + t('canal') : '');
    $('#farmBanner').innerHTML = `
      <div><h2>${esc(fmt('hello', { name: state.user.name }))}</h2><p class="sub">${t('hello.sub')}</p></div>
      <button class="btn" data-tab="profile">✏️ ${t('tab.profile')}</button>
      <div class="facts">
        <span>📍 ${p.place ? esc(p.place) + ' · ' : ''}${esc(z.name[state.lang])}</span>
        <span>📐 ${bdi(nf(p.area))} ${t('ha')}</span>
        <span>${SOIL_ICONS[p.soil]} ${t('soil.' + p.soil)}</span>
        <span>${waterTxt}</span>
        <span>${CROPS[f.current.main[2]].icon} ${cname(f.current.main[2])}</span>
        ${srcBadge()}
      </div>`;
    // health gauge
    const ind = state.ind, levels = Object.values(ind).map(i => i.level);
    const n = l => levels.filter(x => x === l).length;
    const score = Math.round((n('green') * 100 + n('amber') * 50) / levels.length);
    const col = score < 40 ? 'var(--red)' : score < 70 ? 'var(--amber)' : 'var(--ok)';
    $('#healthBox').innerHTML = `<div class="ring" style="--v:${score};--c:${col}"><b>${score}</b></div>
      <div><h3>${t('health.title')}: ${t(score < 40 ? 'health.bad' : score < 70 ? 'health.mid' : 'health.good')}</h3>
      <div class="counts"><span class="light red">${n('red')} ${t('lvl.red')}</span><span class="light amber">${n('amber')} ${t('lvl.amber')}</span><span class="light green">${n('green')} ${t('lvl.green')}</span></div></div>`;
    // compact, expandable indicators (red first)
    const sentence = { heat: 'heat.s', water: 'water.s', rain: 'rain.s', ground: 'ground.s', frost: 'frost.s', erosion: 'erosion.s' };
    const order = { red: 0, amber: 1, green: 2 };
    $('#indGrid').innerHTML = Object.keys(ind).sort((a, b) => order[ind[a].level] - order[ind[b].level]).map(k => {
      const it = ind[k], vars = { ...it.vars };
      if (k === 'water') vars.dir = t(vars.dir === 'drier' ? 'water.drier' : 'water.wetter');
      return `<div class="ind ${it.level}" data-ind="${k}" role="button" tabindex="0" aria-expanded="false">
        <div class="top"><span class="emo">${IND_ICONS[k]}</span><div><h4>${t('ind.' + k)}</h4><span class="light ${it.level}">${t('lvl.' + it.level)}</span></div><span class="chev">▾</span></div>
        <div class="more"><p>${fmt(sentence[k], vars)}</p>
          <div class="row"><small>🛰️ ${it.src}${it.demo ? ' · ' + t('src.demo') : ''}</small><button class="qbtn" data-gl="${it.gl}" aria-label="${t('gl.title')}">?</button></div></div>
      </div>`;
    }).join('');
    // interactive calendar
    state.cal = E.calendar(f.current.main[2], f.current.summer[2], state.climate, f);
    $('#calendar').innerHTML = calHTML(state.cal, false) + `<div class="legend"><span><i style="background:var(--green-2)"></i>${t('cal.crop')}</span><span><i style="background:#d8b989"></i>${t('cal.bare')}</span><span><i style="background:var(--red)"></i>${t('cal.stress')}</span></div>`;
    $('#calDetail').hidden = true;
    const bare = state.cal.filter(c => c.s === 'bare').length;
    $('#calMsg').textContent = bare >= 3 ? fmt('cal.msg', { n: bare }) : '';
    renderAdvTable();
  }
  function calHTML(cal, mini) {
    const mo = t('months'), icon = { crop: '🌱', bare: '', stress: '⚠️' };
    return `<div class="cal${mini ? ' mini' : ''}">${cal.map((c, i) => `<div><div class="cell ${c.s}" ${mini ? '' : `data-cal="${i}" role="button" tabindex="0"`}>${mini ? '' : icon[c.s]}</div>${mo[c.m]}</div>`).join('')}</div>`;
  }
  $('#indGrid').addEventListener('click', e => {
    if (e.target.closest('[data-gl]')) return;
    const card = e.target.closest('[data-ind]'); if (!card) return;
    const open = !card.classList.contains('open');
    $$('#indGrid .ind').forEach(c => { c.classList.remove('open'); c.setAttribute('aria-expanded', 'false'); });
    if (open) { card.classList.add('open'); card.setAttribute('aria-expanded', 'true'); }
  });
  $('#calendar').addEventListener('click', e => {
    const cell = e.target.closest('[data-cal]'); if (!cell) return;
    $$('#calendar .cell').forEach(c => c.classList.remove('sel')); cell.classList.add('sel');
    const c = state.cal[+cell.dataset.cal], m = t('months')[c.m], f = state.farm, cl = state.climate;
    const crops = [f.current.main[2], f.current.summer[2]].filter(x => x && x !== 'none' && CROPS[x].kc[c.m] > 0);
    const cn = crops.map(cname).join(' + ');
    let txt;
    if (c.s === 'bare') txt = fmt('cal.d.bare', { m });
    else if (c.s === 'crop') txt = fmt('cal.d.crop', { m, c: cn });
    else {
      const why = [];
      crops.forEach(id => {
        const cr = CROPS[id];
        if (cr.heatSens.includes(c.m) && cl.heatMonthRecent[c.m] >= 2) why.push(t('why.w.heat'));
        if (cr.frostSens.includes(c.m) && cl.frostMonthProb[c.m] > 0.2) why.push(t('why.w.frost'));
      });
      if (!why.length) why.push(t('why.w.dry'));
      txt = fmt('cal.d.stress', { m, c: cn, why: [...new Set(why)].join(' + ') });
    }
    const d = $('#calDetail'); d.textContent = (c.s === 'stress' ? '⚠️ ' : c.s === 'bare' ? '🟫 ' : '🌱 ') + txt; d.hidden = false;
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-ind],[data-cal]')) { e.preventDefault(); e.target.click(); }
  });
  function renderAdvTable() {
    const c = state.climate, z = state.zone, p = state.user.profile;
    const rows = [
      ['Tmax > 35 °C (Apr–May), 2001–10 → 2016–25', `${c.heatOld} → ${c.heatNow} d/yr (trend ${c.heatTrend > 0 ? '+' : ''}${c.heatTrend}/decade)`, 'NASA POWER T2M_MAX'],
      ['Season rainfall (mean, CV, trend)', `${Math.round(c.rainAnnual)} mm · CV ${Math.round(c.rainCV * 100)}% · ${c.rainTrend} mm/decade`, 'NASA POWER PRECTOTCORR'],
      ['Reference ET₀ (Hargreaves ×0.85)', `${Math.round(c.et0Annual)} mm/yr`, 'NASA POWER + FAO-56'],
      ['Root-zone wetness 2001–15 → 2021–25', `${c.gwetBase.toFixed(3)} → ${c.gwetRecent.toFixed(3)}`, 'NASA POWER GWETROOT'],
      ['Rain onset variability', `±${Math.round(c.onsetStd)} days`, 'NASA POWER / GPM IMERG'],
      ['Heavy-rain days (≥ 20 mm)', `${c.stormsPerYear.toFixed(1)} /yr`, 'NASA POWER / GPM IMERG'],
      ['Frost Feb–Apr probability', `${Math.round(c.frostProb * 100)}%`, 'NASA POWER T2M_MIN'],
      ['Surface soil moisture anomaly', `${z.smapAnom} m³/m³`, 'SMAP L3 (' + t('src.demo') + ')'],
      ['Water storage trend', `${z.graceTrend} cm/yr`, 'GRACE-FO (' + t('src.demo') + ')'],
      ['Slope', `${z.slope}%`, 'SRTM 30 m (' + t('src.demo') + ')'],
      ['Soil (farmer)', `${t('soil.' + p.soil)} · zone: ${z.soil.texture[state.lang]}, OM ${z.soil.om}%, pH ${z.soil.ph}`, 'Farmer + SoilGrids (' + t('src.demo') + ')'],
      ['Water (farmer)', `${state.farm.water} · ${E.availableWater(state.farm)} m³/ha · ${state.farm.method}`, 'Farmer profile'],
      ['Fertilizer / pesticides (farmer)', `${p.fert} / ${p.pest}`, 'Farmer profile']
    ];
    $('#advTable').innerHTML = `<h3>🧑‍🔬 ${t('adv.title')}</h3><table class="adv"><tr><th>${t('adv.param')}</th><th>${t('adv.value')}</th><th>${t('adv.source')}</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td>${r[2]}</td></tr>`).join('')}</table>`;
  }
  let heatChart, rainChart;
  function drawCharts() {
    if (!window.Chart || !state.climate) return;
    const c = state.climate, font = { family: 'Cairo' };
    heatChart && heatChart.destroy(); rainChart && rainChart.destroy();
    heatChart = new Chart($('#heatChart'), {
      type: 'bar',
      data: { labels: c.years, datasets: [{ data: c.heatSeries, backgroundColor: c.heatSeries.map(v => v >= 7 ? '#c8412f' : v >= 3 ? '#d89416' : '#4f9a5c'), borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { font, maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }, y: { beginAtZero: true, ticks: { font } } } }
    });
    const avg = c.rainAnnual;
    rainChart = new Chart($('#rainChart'), {
      type: 'bar',
      data: { labels: c.seasons.map(s => (s - 1) + '–' + String(s).slice(2)), datasets: [
        { data: c.rainSeries, backgroundColor: c.rainSeries.map(v => v < avg * 0.8 ? '#c9a36b' : '#1f4e79'), borderRadius: 4 },
        { type: 'line', data: c.rainSeries.map(() => Math.round(avg)), borderColor: '#23271f', borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { font, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { font } } } }
    });
  }

  // ---------- compare ----------
  // the simulator can replace the real recommendation while active
  const activeRec = () => state.simRec || state.rec;
  const ctxNow = () => state.simRec ? state.simCtx : { cl: state.climate, farm: state.farm };
  const allRecs = () => { const r = activeRec(); return [r.current, ...r.suggestions, ...(state.custom ? [state.custom] : [])]; };
  function seqHTML(rot, labels) {
    return `<div class="seq">${rot.main.map((m, i) => `<div><b>${bdi(labels[i])}</b>${CROPS[m].icon} ${cname(m)}${rot.summer[i] !== 'none' ? ' + ☀️ ' + CROPS[rot.summer[i]].icon + ' ' + cname(rot.summer[i]) : ''}</div>`).join('')}</div>`;
  }
  const metricRow = (label, val, risk, text) => `<div class="metric"><span>${label}</span><span class="bar${risk ? ' risk' : ''}"><i style="width:${Math.max(3, val)}%"></i></span><span class="val">${Math.round(val)}</span></div>${text ? `<div class="muted" style="font-size:12px;margin-top:-4px">${text}</div>` : ''}`;

  // ---------- "what if" simulator ----------
  function initSim() {
    const avail = E.availableWater(state.farm);
    state.sim = { water: avail, rain: 0, heat: 0 };
    state.simRec = null; state.simCtx = null;
    $('#simWaterRow').hidden = state.farm.water === 'rain';
    $('#simWater').value = avail; $('#simRain').value = 0; $('#simHeat').value = 0;
    simOutputs();
  }
  function simOutputs() {
    const s = state.sim;
    $('#simWaterOut').innerHTML = bdi(nf(s.water) + ' m³');
    $('#simRainOut').innerHTML = bdi((s.rain > 0 ? '+' : '') + s.rain + '%') + ' ' + t(s.rain <= -20 ? 'sim.dry' : s.rain >= 20 ? 'sim.wet' : 'sim.normal');
    $('#simHeatOut').innerHTML = bdi('+' + s.heat + ' °C');
  }
  function simulate() {
    const s = state.sim, base = E.availableWater(state.farm);
    const active = (state.farm.water !== 'rain' && s.water !== base) || s.rain !== 0 || s.heat !== 0;
    if (!active) { state.simRec = null; state.simCtx = null; }
    else {
      const cl = JSON.parse(JSON.stringify(state.climate)), k = 1 + s.rain / 100, e = 1 + 0.03 * s.heat;
      cl.rainMonthly = cl.rainMonthly.map(x => x * k); cl.rainAnnual *= k;
      cl.heatMonthRecent = cl.heatMonthRecent.map((x, m) => x + (m >= 2 && m <= 9 ? s.heat * 2.5 : 0));
      cl.et0Monthly = cl.et0Monthly.map(x => x * e); cl.et0Annual *= e;
      cl.heatNow = +(cl.heatNow + s.heat * 5).toFixed(1);
      const farm = { ...state.farm, waterCustom: state.farm.water === 'rain' ? null : s.water };
      state.simCtx = { cl, farm };
      state.simRec = E.recommend(cl, state.zone, farm);
    }
    $('#simActive').hidden = !active;
    state.custom = null;
    renderCompare();
    if (state.selected >= allRecs().length) state.selected = 1;
  }
  let simTimer;
  [['#simWater', 'water'], ['#simRain', 'rain'], ['#simHeat', 'heat']].forEach(([sel, key]) => {
    $(sel).addEventListener('input', e => {
      state.sim[key] = +e.target.value; simOutputs();
      clearTimeout(simTimer); simTimer = setTimeout(simulate, 120);
    });
  });
  $('#simReset').addEventListener('click', () => { initSim(); simulate(); });
  function renderPlan() {
    const p = state.user.profile, f = state.farm;
    if (p.cont === 'yes') {
      const pc = E.planCheck(state.climate, f, t, fmt, state.lang);
      return `<div class="card plan ${pc.ok ? 'good' : ''}"><h3>${CROPS[pc.crop].icon} ${esc(fmt('plan.title', { c: cname(pc.crop) }))}</h3><ul>${pc.items.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
    }
    if (p.cont === 'no') return `<div class="card plan good"><h3>🔄 ${fmt('plan.change', { r: p.stopReason ? t('stop.' + p.stopReason) : '—' })}</h3></div>`;
    return `<div class="card plan"><h3>🤔 ${t('plan.unsure')}</h3></div>`;
  }
  function renderCompare() {
    const { farm: f, cl } = ctxNow();
    $('#planBox').innerHTML = renderPlan();
    $('#prioSummary').innerHTML = f.prio.map((p, i) => `<span>${i + 1}. ${PRIO_ICONS[p]} ${t('prio.' + p)}</span>`).join('');
    const ctx = { source: state.source, zone: state.zone };
    const recs = allRecs().filter(r => r.arch !== 'custom');
    $('#cmpGrid').innerHTML = recs.map((r, i) => {
      const cur = r.arch === 'current', conf = cur ? null : E.confidence(r, ctx);
      const waterTxt = f.water === 'rain' ? `${t('m.deficit')}: ${bdi(r.ev.deficitPct + '%')}` : `${t('m.water')}: ${bdi(nf(r.ev.needYear))}`;
      return `<div class="rcard ${cur ? 'current' : ''} ${i === 1 ? 'best' : ''}">
        <span class="arch">${cur ? '🔁 ' + t('cmp.current') : (i === 1 ? '⭐ ' : '') + t('arch.' + r.arch)}</span>
        ${seqHTML(r.rot, cur ? HIST_SEASONS : NEXT_SEASONS)}
        ${calHTML(E.calendar(r.rot.main[cur ? 2 : 0], r.rot.summer[cur ? 2 : 0], cl, f), true)}
        ${metricRow('💧 ' + t('m.water').split(' (')[0], r.ev.metrics.water, false, waterTxt)}
        ${metricRow('💰 ' + t('m.income'), r.ev.metrics.income)}
        ${metricRow('🌱 ' + t('m.soil'), r.ev.metrics.soil)}
        ${metricRow('🐄 ' + t('m.forage'), r.ev.metrics.forage)}
        ${metricRow('⚠️ ' + t('m.risk'), r.ev.risk, true)}
        ${r.ev.shortfall > 0.05 ? `<div class="short">🚱 ${t('short.water')}</div>` : ''}
        <div class="score"><span>${t('m.score')} <strong>${Math.round(r.ev.total)}</strong>/100</span>${conf ? `<span class="conf ${conf}">${t('conf.' + conf)}</span>` : ''}</div>
        <button class="btn ${cur ? 'ghost' : 'primary'}" data-detail="${i}">${t('cmp.why')}</button>
      </div>`;
    }).join('');
  }
  $('#cmpGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-detail]'); if (!b) return;
    state.selected = +b.dataset.detail; renderDetail(state.selected); show('detail');
  });

  // ---------- detail ----------
  let lastExplain = null;
  const recLabel = r => r.arch === 'current' ? '🔁 ' + t('cmp.current') : r.arch === 'custom' ? '🧩 ' + t('build.custom') : t('arch.' + r.arch);
  function renderDetail(i) {
    if (!state.rec) return;
    const recs = allRecs();
    if (i >= recs.length) i = state.selected = 1;
    const r = recs[i], { cl, farm } = ctxNow(), cur = activeRec().current;
    $('#detailPicker').innerHTML = recs.map((x, k) => `<button type="button" class="chip ${k === i ? 'on' : ''}" data-pick="${k}">${recLabel(x)}</button>`).join('');
    const ctx = { cl, zone: state.zone, farm, ind: state.ind, source: state.source };
    const x = E.explain(r, cur, ctx, t, fmt, state.lang);
    lastExplain = { r, x };
    const isCur = r.arch === 'current', labels = isCur ? HIST_SEASONS : NEXT_SEASONS;
    const conf = isCur ? null : E.confidence(r, { source: state.source, zone: state.zone });
    const area = farm.area, sc = Math.round(r.ev.total);
    const col = sc < 40 ? 'var(--red)' : sc < 65 ? 'var(--amber)' : 'var(--ok)';
    const list = (cls, head, items, open) => items.length ? `<details class="card sec ${cls}" ${open ? 'open' : ''}><summary>${head} <span class="cnt">${items.length}</span></summary><ul>${items.map(s => `<li>${s}</li>`).join('')}</ul></details>` : '';
    $('#detailBox').innerHTML = `
      <div class="det-head"><div><span class="pill">${recLabel(r)}</span>
        <h2>${r.rot.main.map(m => CROPS[m].icon + ' ' + cname(m)).join(t('dir') === 'rtl' ? ' ← ' : ' → ')}</h2></div>
        <div class="row">${srcBadge()} ${conf ? `<span class="conf ${conf}">${t('conf.' + conf)}</span>` : ''}</div></div>
      <div class="timeline">${r.rot.main.map((m, k) => `<div><b>${t('y')} ${k + 1} · ${bdi(labels[k])}</b><span class="big">${CROPS[m].icon}</span><div>${cname(m)}</div>
        ${r.rot.summer[k] !== 'none' ? `<div class="muted">☀️ ${cname(r.rot.summer[k])}</div>` : ''}</div>`).join('')}</div>
      <div class="card health">
        <div class="ring sm" style="--v:${sc};--c:${col}"><b>${sc}</b></div>
        <div class="metric" style="grid-template-columns:auto 1fr;gap:4px 16px;flex:1">
          ${farm.water === 'rain'
            ? `<b>💧 ${t('m.deficit')}</b><span>${bdi(r.ev.deficitPct + '%')}</span>`
            : `<b>💧 ${t('m.water')}</b><span>${bdi(nf(r.ev.needYear))} · ${bdi(nf(Math.round(r.ev.needYear * area)) + ' m³')} / ${bdi(nf(area))} ${t('ha')}</span>`}
          <b>🌱 ${t('m.soil')}</b><span>${bdi(Math.round(r.ev.metrics.soil) + '/100')}</span>
          <b>⚠️ ${t('m.risk')}</b><span>${bdi(Math.round(r.ev.risk) + '/100')}</span></div></div>
      ${list('why', '💡 ' + t('det.why'), x.why, true)}
      ${list('risk', '⚠️ ' + t('det.risks'), x.risks, true)}
      ${list('ev', '🛰️ ' + t('det.evidence'), x.ev)}
      ${list('ben', '🌿 ' + t('det.benefits'), x.ben)}
      ${list('gap', '❓ ' + t('det.gaps'), x.gaps)}`;
  }
  $('#detailPicker').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    state.selected = +b.dataset.pick; renderDetail(state.selected);
  });

  // ---------- build your own rotation ----------
  function renderBuild() {
    const f = state.farm, rain = f.water === 'rain';
    if (!state.build) {
      const best = state.rec.suggestions[0].rot;
      state.build = { main: best.main.slice(), summer: best.summer.slice() };
    }
    const b = state.build;
    const opts = window.MAIN_CROPS.filter(id => !rain || CROPS[id].rainfed);
    $('#buildYears').innerHTML = '<div class="build-sticky" id="buildSticky"></div>' + [0, 1, 2].map(i => {
      const k = CROPS[b.main[i]].kc, summerOk = !rain && k[5] === 0 && k[6] === 0;
      return `<div class="by"><h4><span>${t('y')} ${i + 1} · ${bdi(NEXT_SEASONS[i])}</span><span>${CROPS[b.main[i]].icon}</span></h4>
        <div class="crop-pick">${opts.map(id => `<button type="button" data-by="${i}" data-bmain="${id}" class="${b.main[i] === id ? 'on' : ''}">${CROPS[id].icon} ${cname(id)}</button>`).join('')}</div>
        ${summerOk ? `<div class="summer-pick crop-pick"><b>☀️ ${t('build.summer')}</b>${window.SUMMER_CROPS.map(id => `<button type="button" data-by="${i}" data-bsummer="${id}" class="${b.summer[i] === id ? 'on' : ''}">${id === 'none' ? '— ' + t('farm.none') : CROPS[id].icon + ' ' + cname(id)}</button>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    renderBuildResult();
  }
  function renderBuildResult() {
    const f = state.farm, b = state.build;
    const ev = E.evaluate(b, state.climate, f), cur = state.rec.current.ev, best = state.rec.suggestions[0].ev;
    const sc = Math.round(ev.total), d = sc - Math.round(cur.total);
    const col = sc < 40 ? 'var(--red)' : sc < 65 ? 'var(--amber)' : 'var(--ok)';
    const warns = [];
    for (let i = 0; i < 3; i++) {
      const a = CROPS[b.main[i]], n = CROPS[b.main[(i + 1) % 3]];
      if (a.family === n.family && a.family !== 'none' && !(b.main[i] === 'alfalfa' && b.main[(i + 1) % 3] === 'alfalfa')) { warns.push(t('build.wRepeat')); break; }
    }
    if (!b.main.some(x => CROPS[x].nfix)) warns.push(t('build.wNoLeg'));
    if (ev.shortfall > 0.05) warns.push(t('build.wWater'));
    if (b.main.filter(x => x === 'beet').length > 1) warns.push(t('build.wBeet'));
    if (b.main.includes('fallow')) warns.push(t('build.wFallow'));
    const waterTxt = f.water === 'rain' ? `${t('m.deficit')}: ${bdi(ev.deficitPct + '%')}` : `${t('m.water')}: ${bdi(nf(ev.needYear))}`;
    $('#buildResult').innerHTML = `
      <div class="top"><div class="ring" style="--v:${sc};--c:${col}"><b>${sc}</b></div>
        <div><b class="${d >= 0 ? 'up' : 'down'}" style="color:${d >= 0 ? 'var(--ok)' : 'var(--red)'};font-size:18px">${d >= 0 ? '▲' : '▼'} ${esc(fmt('build.vsCur', { d: (d > 0 ? '+' : '') + d }))}</b>
        <div class="muted">${fmt('build.vsBest', { b: Math.round(best.total) })}</div></div></div>
      ${metricRow('💧 ' + t('m.water').split(' (')[0], ev.metrics.water, false, waterTxt)}
      ${metricRow('💰 ' + t('m.income'), ev.metrics.income)}
      ${metricRow('🌱 ' + t('m.soil'), ev.metrics.soil)}
      ${metricRow('🐄 ' + t('m.forage'), ev.metrics.forage)}
      ${metricRow('⚠️ ' + t('m.risk'), ev.risk, true)}
      <ul class="warns">${warns.length ? warns.map(w => `<li>⚠️ ${w}</li>`).join('') : `<li class="ok">${t('build.ok')}</li>`}</ul>
      <div class="row wrap"><button class="btn primary" id="buildDetails" type="button">💡 ${t('build.details')}</button>
        <button class="btn ghost" id="buildBest" type="button">⭐ ${t('build.useBest')}</button></div>`;
    $('#buildSticky').innerHTML = `<div class="ring sm" style="--v:${sc};--c:${col}"><b>${sc}</b></div>
      <div><b style="color:${d >= 0 ? 'var(--ok)' : 'var(--red)'}">${d >= 0 ? '▲' : '▼'} ${esc(fmt('build.vsCur', { d: (d > 0 ? '+' : '') + d }))}</b>
      <div class="muted small">${warns.length ? '⚠️ ' + warns[0] : t('build.ok')}</div></div>`;
    state.buildEv = ev;
  }
  $('#buildYears').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn || !state.build) return;
    const i = +btn.dataset.by, b = state.build;
    if (btn.dataset.bmain) {
      b.main[i] = btn.dataset.bmain;
      const k = CROPS[b.main[i]].kc;
      if (!(k[5] === 0 && k[6] === 0)) b.summer[i] = 'none';
    }
    if (btn.dataset.bsummer) b.summer[i] = btn.dataset.bsummer;
    renderBuild();
  });
  $('#buildResult').addEventListener('click', e => {
    if (e.target.closest('#buildBest')) { state.build = null; renderBuild(); return; }
    if (e.target.closest('#buildDetails')) {
      state.custom = { rot: { main: state.build.main.slice(), summer: state.build.summer.slice() }, ev: E.evaluate(state.build, ctxNow().cl, ctxNow().farm), arch: 'custom' };
      state.selected = allRecs().length - 1;
      show('detail');
    }
  });

  // voice / print / share
  let speaking = false;
  $('#listenBtn').addEventListener('click', () => {
    const synth = window.speechSynthesis, err = $('#voiceErr');
    if (!synth || !lastExplain) return;
    if (speaking) { synth.cancel(); speaking = false; $('#listenBtn span').textContent = t('det.listen'); return; }
    const voice = synth.getVoices().find(v => v.lang.toLowerCase().startsWith(state.lang));
    if (!voice) { err.textContent = t('det.novoice'); err.hidden = false; return; }
    err.hidden = true;
    const { r, x } = lastExplain;
    const text = [r.rot.main.map(cname).join(', '), t('det.why'), ...x.why, t('det.risks'), ...x.risks.slice(0, 3), t('det.advisor')].join('. ').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = 0.95;
    u.onend = () => { speaking = false; $('#listenBtn span').textContent = t('det.listen'); };
    speaking = true; $('#listenBtn span').textContent = t('det.stop');
    synth.speak(u);
  });
  $('#printBtn').addEventListener('click', () => window.print());

  // ---------- download the full plan (one self-contained HTML file, printable to PDF) ----------
  function planParts() {
    const p = state.user.profile, z = state.zone, { cl, farm } = ctxNow(), recs = allRecs();
    const cur = activeRec().current, arrow = t('dir') === 'rtl' ? ' ← ' : ' → ';
    const ctx = { cl, zone: state.zone, farm, ind: state.ind, source: state.source };
    const ind = state.ind, levels = Object.values(ind).map(i => i.level), n = l => levels.filter(x => x === l).length;
    const health = Math.round((n('green') * 100 + n('amber') * 50) / levels.length);
    const sentence = { heat: 'heat.s', water: 'water.s', rain: 'rain.s', ground: 'ground.s', frost: 'frost.s', erosion: 'erosion.s' };
    const order = { red: 0, amber: 1, green: 2 };
    const indRows = Object.keys(ind).sort((a, b) => order[ind[a].level] - order[ind[b].level]).map(k => {
      const it = ind[k], vars = { ...it.vars };
      if (k === 'water') vars.dir = t(vars.dir === 'drier' ? 'water.drier' : 'water.wetter');
      return `<tr><td>${IND_ICONS[k]} ${t('ind.' + k)}</td><td><span class="lv ${it.level}">${t('lvl.' + it.level)}</span></td><td>${fmt(sentence[k], vars)}<br><small>🛰️ ${it.src}${it.demo ? ' · ' + t('src.demo') : ''}</small></td></tr>`;
    }).join('');
    const mo = t('months'), calc = E.calendar(farm.current.main[2], farm.current.summer[2], cl, farm);
    const calRow = `<table class="cal"><tr>${calc.map(c => `<th>${mo[c.m]}</th>`).join('')}</tr><tr>${calc.map(c => `<td class="${c.s}">${{ crop: '🌱', bare: '—', stress: '⚠️' }[c.s]}</td>`).join('')}</tr></table>
      <p class="legend"><span class="crop">🌱 ${t('cal.crop')}</span> <span class="bare">— ${t('cal.bare')}</span> <span class="stress">⚠️ ${t('cal.stress')}</span></p>`;
    const seq = r => r.rot.main.map((m, k) => `${CROPS[m].icon} ${cname(m)}${r.rot.summer[k] !== 'none' ? ' + ☀️ ' + cname(r.rot.summer[k]) : ''}`).join(arrow);
    const conf = r => r.arch === 'current' || r.arch === 'custom' ? '' : t('conf.' + E.confidence(r, { source: state.source, zone: state.zone }));
    const water = r => farm.water === 'rain' ? `${t('m.deficit')}: ${r.ev.deficitPct}%` : `${nf(r.ev.needYear)} m³/${t('ha')} · ${nf(Math.round(r.ev.needYear * farm.area))} m³`;
    const cmpRows = recs.map((r, i) => `<tr class="${i === 1 ? 'best' : ''}"><td><b>${(i === 1 ? '⭐ ' : '') + recLabel(r)}</b><br>${seq(r)}</td><td>${water(r)}</td>
      <td>${Math.round(r.ev.metrics.income)}</td><td>${Math.round(r.ev.metrics.soil)}</td><td>${Math.round(r.ev.metrics.forage)}</td><td>${Math.round(r.ev.risk)}</td>
      <td><b>${Math.round(r.ev.total)}</b>/100${conf(r) ? '<br><small>' + conf(r) + '</small>' : ''}</td></tr>`).join('');
    const list = (head, items) => items.length ? `<h4>${head}</h4><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
    const advice = recs.map((r, i) => {
      const x = E.explain(r, cur, ctx, t, fmt, state.lang), labels = r.arch === 'current' ? HIST_SEASONS : NEXT_SEASONS;
      return `<section class="rot"><h3>${(i === 1 ? '⭐ ' : '') + recLabel(r)} · ${t('m.score')} ${Math.round(r.ev.total)}/100</h3>
        <table class="years"><tr>${r.rot.main.map((m, k) => `<td><b>${t('y')} ${k + 1} · ${labels[k]}</b><br><span class="big">${CROPS[m].icon}</span><br>${cname(m)}${r.rot.summer[k] !== 'none' ? `<br>☀️ ${cname(r.rot.summer[k])}` : ''}</td>`).join('')}</tr></table>
        <p>💧 ${water(r)} · 🌱 ${t('m.soil')} ${Math.round(r.ev.metrics.soil)}/100 · ⚠️ ${t('m.risk')} ${Math.round(r.ev.risk)}/100</p>
        ${list('💡 ' + t('det.why'), x.why)}${list('⚠️ ' + t('det.risks'), x.risks)}${list('🛰️ ' + t('det.evidence'), x.ev)}${list('🌿 ' + t('det.benefits'), x.ben)}${list('❓ ' + t('det.gaps'), x.gaps)}
      </section>`;
    }).join('');
    const date = new Date().toLocaleDateString(loc(), { year: 'numeric', month: 'long', day: 'numeric' });
    const css = `body{font-family:Cairo,'Segoe UI',Tahoma,Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#2b2b2b;background:#fff;line-height:1.6}
      h1{color:#2f6b3a;margin:0}h2{color:#2f6b3a;border-bottom:2px solid #2f6b3a;padding-bottom:4px;margin-top:32px}h3{margin:0 0 8px;color:#24502d}
      header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:4px solid #2f6b3a;padding-bottom:12px}
      .meta{color:#666}button{background:#2f6b3a;color:#fff;border:0;border-radius:8px;padding:10px 18px;font:inherit;cursor:pointer}
      table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #ddd;padding:6px 8px;vertical-align:top;text-align:start}th{background:#f2efe6}
      dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px}dt{font-weight:bold;color:#555}dd{margin:0}
      .lv{padding:2px 8px;border-radius:10px;color:#fff;white-space:nowrap}.lv.red{background:#c0392b}.lv.amber{background:#d68910}.lv.green{background:#2e8b57}
      .cal td,.cal th{text-align:center;padding:4px 2px;font-size:12px}.cal td.crop{background:#cfe8c9}.cal td.bare{background:#ecdcbf}.cal td.stress{background:#f5b7b1}
      .legend span{margin-inline-end:12px;font-size:13px}tr.best{background:#f3faf0}.rot{border:1px solid #ddd;border-radius:10px;padding:14px;margin:14px 0;page-break-inside:avoid}
      .years td{text-align:center;width:33%}.big{font-size:28px}.note{background:#fff8e1;border-inline-start:4px solid #d68910;padding:8px 12px}
      .gauge{font-size:20px}footer{margin-top:32px;color:#666;font-size:13px;border-top:1px solid #ddd;padding-top:12px}
      @media print{button{display:none}body{padding:0}h2{page-break-after:avoid}}`;
    const body = `<header><div><h1>🌾 DAWRA دورة</h1><div>${t('dl.title')}</div><div class="meta">${t('dl.date')}: ${date} · 🛰️ ${t('src.' + state.source)}</div></div>
        <button class="no-pdf" onclick="window.print()">📄 ${t('det.print')}</button></header>
      ${state.simRec ? `<p class="note">${t('dl.sim')}</p>` : ''}
      <h2>👤 ${t('tab.profile')}</h2><p>📍 ${p.place ? esc(p.place) + ' · ' : ''}${esc(z.name[state.lang])}</p>${summaryHTML(p)}
      <h2>🛰️ ${t('health.title')}</h2><p class="gauge"><b>${health}/100</b> — ${t(health < 40 ? 'health.bad' : health < 70 ? 'health.mid' : 'health.good')}</p>
      <h3>${t('dl.ind')}</h3><table>${indRows}</table>
      <h3>${t('cal.title')}</h3>${calRow}
      <h2>🔁 ${t('dl.cmp')}</h2>${renderPlan().replace(/class="card plan[^"]*"/, 'class="note"')}
      <table><tr><th>${t('dl.rot')}</th><th>💧 ${t('m.water').split(' (')[0]}</th><th>💰 ${t('m.income')}</th><th>🌱 ${t('m.soil')}</th><th>🐄 ${t('m.forage')}</th><th>⚠️ ${t('m.risk')}</th><th>${t('m.score')}</th></tr>${cmpRows}</table>
      <h2>💡 ${t('dl.advice')}</h2>${advice}
      <p class="note">🤝 ${t('det.advisor')}</p>
      <footer>${t('dl.footer')}<br>NASA POWER · SMAP · GPM IMERG · GRACE-FO · SRTM · Landsat / Sentinel-2 · NASA Space Apps 2026 · Beni Mellal</footer>`;
    return { css, body };
  }
  function planDocument() {
    const { css, body } = planParts();
    return `<!DOCTYPE html><html lang="${state.lang}" dir="${t('dir')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>DAWRA — ${t('dl.title')}</title><style>${css}</style></head><body>${body}</body></html>`;
  }
  const PDF_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  // Build the PDF inside a hidden page as wide as the A4 printable area (194 mm ≈ 733 px), so the report keeps its own layout and text direction
  function makePdf(filename) {
    return new Promise((ok, fail) => {
      const fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
      fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:733px;height:1123px;border:0;background:#fff';
      document.body.appendChild(fr);
      const done = (err) => { setTimeout(() => fr.remove(), 500); err ? fail(err) : ok(); };
      const doc = fr.contentDocument;
      doc.open();
      doc.write(planDocument().replace('</style>', 'body{max-width:none;padding:16px 20px}.no-pdf{display:none}</style>'));
      doc.close();
      const sc = doc.createElement('script');
      sc.src = PDF_LIB;
      sc.onerror = () => done(new Error('PDF library could not load'));
      sc.onload = async () => {
        try {
          const w = fr.contentWindow;
          if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
          // options are rebuilt inside the frame: the library only accepts arrays made there
          const opts = w.JSON.parse(JSON.stringify({
            margin: [10, 8, 12, 8], filename,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', foreignObjectRendering: true, scrollX: 0, scrollY: 0, windowWidth: 733 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: ['.rot', 'tr', 'h3', 'li', '.note'] }
          }));
          await w.html2pdf().set(opts).from(doc.body).save();
          done();
        } catch (e) { done(e); }
      };
      doc.head.appendChild(sc);
    });
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function dlMessage(key, err) {
    const m = $('#dlMsg'); m.textContent = t(key); m.className = err ? 'err' : 'muted'; m.hidden = false;
    clearTimeout(dlMessage.timer); dlMessage.timer = setTimeout(() => { m.hidden = true; }, 6000);
  }
  $('#downloadBtn').addEventListener('click', async () => {
    if (!state.rec) return;
    const btn = $('#downloadBtn'), day = new Date().toISOString().slice(0, 10);
    btn.disabled = true; dlMessage('dl.working');
    try {
      await makePdf(`DAWRA-plan-${day}.pdf`);
      dlMessage('dl.done');
    } catch (e) {
      console.warn('PDF report failed:', e);
      // No internet for the PDF library: still give the farmer the full plan as a file they can print to PDF
      downloadBlob(new Blob([planDocument()], { type: 'text/html;charset=utf-8' }), `DAWRA-plan-${day}.html`);
      dlMessage('dl.fallback', true);
    } finally { btn.disabled = false; }
  });
  $('#shareBtn').addEventListener('click', () => {
    if (!lastExplain) return;
    const { r, x } = lastExplain;
    const msg = `🌾 ${t('share.head')}\n\n${r.rot.main.map((m, i) => `${NEXT_SEASONS[i]}: ${CROPS[m].icon} ${cname(m)}`).join('\n')}\n\n💡 ${x.why.slice(0, 3).join('\n• ')}\n\n🤝 ${t('det.advisor')}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  // glossary
  document.addEventListener('click', e => {
    const q = e.target.closest('[data-gl]'); if (!q) return;
    $('#glText').textContent = t(q.dataset.gl);
    $('#glList').innerHTML = ['gl.ndvi', 'gl.et', 'gl.soil', 'gl.frost', 'gl.grace', 'gl.balance', 'gl.sat'].filter(k => k !== q.dataset.gl).map(k => `<li>${t(k)}</li>`).join('');
    $('#glossary').hidden = false;
  });
  $('#glClose').addEventListener('click', () => { $('#glossary').hidden = true; });
  $('#glossary').addEventListener('click', e => { if (e.target.id === 'glossary') $('#glossary').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#glossary').hidden = true; });

  // header
  $$('.langs button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));
  $('#advisorToggle').addEventListener('change', e => document.body.classList.toggle('advisor', e.target.checked));

  // ---------- start ----------
  applyLang(state.lang);
  (async () => {
    // no sign-up: a new visitor lands straight on the farm questionnaire
    if (state.user && state.user.profile.complete) analyse(); else startWizard();
  })();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
