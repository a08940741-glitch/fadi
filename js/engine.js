// DAWRA — indicators, FAO-56 water balance, rotation generation, scoring and explanations
(function () {
  const C = () => window.CROPS;
  const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
  const WATER_LEVELS = [3000, 6000, 9000, 13000];
  const AG_YEAR = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7]; // Sep → Aug
  // Soil texture factor on net irrigation need (water holding capacity, deep percolation)
  const SOIL_NEED = { clay: 0.95, loam: 1, sandy: 1.15, stony: 1.1, salty: 1.1, unknown: 1 }; // salty: extra leaching water

  // Effective rainfall (USDA-SCS simplified, monthly mm)
  const peff = p => p > 75 ? 0.8 * p - 25 : Math.max(0, 0.6 * p - 10);

  function availableWater(farm) {
    if (farm.water === 'rain') return 0;
    if (farm.waterCustom != null) return farm.waterCustom; // "what if" simulator
    return WATER_LEVELS[(farm.waterLevel || 2) - 1];
  }
  const efficiency = farm => farm.method === 'drip' ? 0.9 : 0.7;

  // ---------- Field indicators ----------
  function indicators(cl, zone, farm) {
    const lvl = (v, amber, red, inverse) => inverse
      ? (v <= red ? 'red' : v <= amber ? 'amber' : 'green')
      : (v >= red ? 'red' : v >= amber ? 'amber' : 'green');
    const pct = Math.round(clamp(cl.rainAnnual / cl.et0Annual * 100));
    const gwAnom = cl.gwetRecent - cl.gwetBase;
    const bare = currentBareMonths(farm);
    const erosion = zone.slope / 10 + bare / 6 + cl.stormsPerYear / 3;
    let water = pct < 25 || gwAnom < -0.04 ? 'red' : pct < 45 || gwAnom < -0.015 ? 'amber' : 'green';
    let rainLvl = cl.rainCV > 0.35 || cl.onsetStd > 25 ? 'red' : cl.rainCV > 0.22 || cl.onsetStd > 15 ? 'amber' : 'green';
    return {
      heat: { level: lvl(cl.heatNow, 3, 7), vars: { now: cl.heatNow, old: cl.heatOld }, src: 'NASA POWER', gl: 'gl.sat' },
      water: { level: water, vars: { pct, dir: gwAnom < 0 ? 'drier' : 'wetter' }, src: 'NASA POWER · SMAP', gl: 'gl.soil' },
      rain: { level: rainLvl, vars: { cv: Math.round(cl.rainCV * 100), onset: Math.round(cl.onsetStd) }, src: 'NASA POWER · GPM IMERG', gl: 'gl.balance' },
      ground: { level: lvl(zone.graceTrend, -0.7, -1.3, true), vars: { v: Math.abs(zone.graceTrend).toFixed(1) }, src: 'GRACE-FO', gl: 'gl.grace', demo: true },
      frost: { level: lvl(cl.frostProb, 0.15, 0.4), vars: { p: Math.round(cl.frostProb * 100) }, src: 'NASA POWER', gl: 'gl.frost' },
      erosion: { level: lvl(erosion, 0.9, 1.6), vars: { slope: zone.slope, bare, storm: cl.stormsPerYear.toFixed(1) }, src: 'SRTM · IMERG · NDVI', gl: 'gl.ndvi', demo: true }
    };
  }

  function yearKc(main, summer) {
    const a = C()[main].kc, b = summer && summer !== 'none' ? C()[summer].kc : null;
    return a.map((k, m) => Math.max(k, b ? b[m] : 0));
  }
  function currentBareMonths(farm) {
    const kc = yearKc(farm.current.main[0], farm.current.summer[0]);
    return kc.filter(k => k === 0).length;
  }

  // Month-by-month status for one rotation year (Sep → Aug)
  function calendar(main, summer, cl, farm) {
    const kc = yearKc(main, summer);
    const crops = [main, summer].filter(c => c && c !== 'none').map(c => C()[c]);
    return AG_YEAR.map(m => {
      if (kc[m] === 0) return { m, s: 'bare' };
      let stress = crops.some(c => c.kc[m] > 0 && (
        (c.heatSens.includes(m) && cl.heatMonthRecent[m] >= 2) ||
        (c.frostSens.includes(m) && cl.frostMonthProb[m] > 0.2)));
      if (farm.water === 'rain' && kc[m] * cl.et0Monthly[m] - peff(cl.rainMonthly[m]) > 70) stress = true;
      return { m, s: stress ? 'stress' : 'crop' };
    });
  }

  // ---------- Rotation evaluation ----------
  function evaluate(rot, cl, farm) {
    const eff = efficiency(farm), avail = availableWater(farm), rainfed = farm.water === 'rain';
    let needM3 = 0, demand = 0, deficit = 0, cover = 0, income = 0, forage = 0;
    let heatPen = 0, frostPen = 0, marketPen = 0, legumes = 0, deep = 0, heavy = 0, nCrops = 0, saltPen = 0;
    const soilNeed = SOIL_NEED[farm.soil] || 1;
    const fams = new Set();
    for (let i = 0; i < 3; i++) {
      const main = rot.main[i], summer = rot.summer[i];
      const kc = yearKc(main, summer);
      let net = 0, dem = 0;
      kc.forEach((k, m) => {
        if (k === 0) return;
        const etc = k * cl.et0Monthly[m];
        dem += etc; net += Math.max(0, etc - peff(cl.rainMonthly[m]));
      });
      demand += dem; deficit += net * soilNeed;
      needM3 += net * soilNeed * 10 / eff;
      cover += kc.filter(k => k > 0).length;
      [main, summer].filter(c => c && c !== 'none').forEach((id, j) => {
        const c = C()[id];
        if (id !== 'fallow') { nCrops++; fams.add(c.family); }
        income += c.income * (j ? 0.7 : 1) * (1 - c.marketRisk * 0.07);
        forage += c.forage;
        if (c.nfix) legumes++;
        if (c.root === 'deep') deep++;
        if (id === 'beet' || id === 'maize') heavy++;
        c.heatSens.forEach(m => { heatPen += cl.heatMonthRecent[m] * (1 - c.heatTol / 6); });
        c.frostSens.forEach(m => { frostPen += cl.frostMonthProb[m] * 10; });
        marketPen += c.marketRisk;
        if (farm.soil === 'salty' && id !== 'fallow' && c.saltTol <= 2) saltPen += 8;
        if (farm.soil === 'stony' && c.root === 'deep') deep -= 0.5; // shallow stony soil limits deep roots
      });
    }
    let repeats = 0;
    for (let i = 0; i < 3; i++) {
      const a = C()[rot.main[i]], b = C()[rot.main[(i + 1) % 3]];
      if (a.family === b.family && a.family !== 'none' && !(rot.main[i] === 'alfalfa' && rot.main[(i + 1) % 3] === 'alfalfa')) repeats++;
    }
    const needYear = needM3 / 3;
    const deficitRatio = demand ? deficit / demand : 0;
    const shortfall = rainfed ? 0 : Math.max(0, needYear - avail) / Math.max(needYear, 1);
    const droughtTol = mean(rot.main.map(id => C()[id].droughtTol));

    const waterScore = rainfed ? clamp(100 - deficitRatio * 100) : clamp(100 - needYear / 150);
    const soilScore = clamp(25 + legumes * 14 + deep * 6 + (cover / 36) * 30 + fams.size * 4 - repeats * 12 - heavy * 6 - rot.main.filter(x => x === 'fallow').length * 10);
    const forageScore = clamp(forage / 21 * 100);
    const riskRaw = shortfall * 60 + (rainfed ? deficitRatio * (1 - droughtTol / 6) * 40 : 0) +
      heatPen * 2.2 + frostPen + repeats * 12 + marketPen * 1.5 + saltPen +
      (farm.pest === 'often' ? repeats * 6 : 0); // farms already spraying a lot suffer more from repeated families
    const risk = clamp(riskRaw);
    const incomeScore = clamp(income / 3 / 5.5 * 100 * (1 - risk / 200) + (farm.livestock ? forage * 0.8 : 0));
    const metrics = { water: waterScore, income: incomeScore, soil: soilScore, forage: forageScore };
    const W = [0.4, 0.3, 0.2, 0.1];
    let total = 0;
    farm.prio.forEach((p, i) => { total += W[i] * metrics[p]; });
    total = clamp(total - risk * 0.35 + 15);
    return {
      needYear: Math.round(needYear / 50) * 50, deficitPct: Math.round(deficitRatio * 100), shortfall,
      cover: Math.round(cover / 3), legumes, deep, repeats, heatPen, frostPen, metrics, risk, total,
      marketMax: Math.max(...[...rot.main, ...rot.summer].filter(c => c !== 'none').map(c => C()[c].marketRisk))
    };
  }
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

  // ---------- Candidate generation ----------
  function candidates(farm) {
    const rainfed = farm.water === 'rain';
    const mains = window.MAIN_CROPS.filter(id => id !== 'fallow' && (!rainfed || C()[id].rainfed));
    const out = [];
    const summerOpts = main => {
      if (rainfed) return ['none'];
      const k = C()[main].kc;
      return (k[5] === 0 && k[6] === 0) ? ['none', 'maize', 'sorghum'] : ['none'];
    };
    const famOk = (a, b) => C()[a].family !== C()[b].family || (a === 'alfalfa' && b === 'alfalfa');
    for (const a of mains) for (const b of mains) {
      if (!famOk(a, b)) continue;
      for (const c of mains) {
        if (!famOk(b, c) || !famOk(c, a)) continue;
        const main = [a, b, c];
        if (main.filter(x => x === 'beet').length > 1) continue;
        if (main.filter(x => x === 'alfalfa').length === 3) continue;
        if (!main.some(x => C()[x].nfix)) continue;
        // irrigated farms keep at least one wheat year (food security, markets); rain-fed at least one cereal
        if (!main.some(x => (rainfed ? ['durum', 'soft', 'barley'] : ['durum', 'soft']).includes(x))) continue;
        for (const sa of summerOpts(a)) for (const sb of summerOpts(b)) for (const sc of summerOpts(c)) {
          const summer = [sa, sb, sc];
          if (summer.filter(x => x !== 'none').length > 1) continue; // at most one thirsty summer crop in 3 years
          out.push({ main, summer });
        }
      }
    }
    // remove cyclic duplicates
    const seen = new Set();
    return out.filter(r => {
      const k = canon(r);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }
  function canon(r) {
    const s = [0, 1, 2].map(i => r.main[i] + '+' + r.summer[i]);
    const rots = [0, 1, 2].map(k => [s[k], s[(k + 1) % 3], s[(k + 2) % 3]].join('|'));
    return rots.sort()[0];
  }
  function bag(r) { return [...r.main, ...r.summer.filter(x => x !== 'none')].sort(); }
  function differs(r1, r2) {
    const a = bag(r1), b = bag(r2).slice();
    let diff = 0;
    a.forEach(x => { const i = b.indexOf(x); if (i >= 0) b.splice(i, 1); else diff++; });
    return diff + b.length >= 2;
  }
  // Start the suggestion with a family different from the farmer's last season
  function alignStart(r, farm) {
    const lastFam = C()[farm.current.main[2]].family;
    for (let k = 0; k < 3; k++) {
      const idx = [k, (k + 1) % 3, (k + 2) % 3];
      if (C()[r.main[idx[0]]].family !== lastFam) return { main: idx.map(i => r.main[i]), summer: idx.map(i => r.summer[i]) };
    }
    return r;
  }

  function recommend(cl, zone, farm) {
    const current = { main: farm.current.main.slice(), summer: farm.current.summer.slice() };
    const curEval = evaluate(current, cl, farm);
    const avail = availableWater(farm);
    let pool = candidates(farm).filter(r => canon(r) !== canon(current)).map(r => ({ rot: r, ev: evaluate(r, cl, farm) }));
    const feasible = pool.filter(p => farm.water === 'rain' || p.ev.needYear <= avail * 1.05);
    if (feasible.length >= 3) pool = feasible;
    else pool.sort((a, b) => a.ev.needYear - b.ev.needYear), pool = pool.slice(0, 40);
    // farmer said water is short (or ranks water first): never suggest more water than today
    if (farm.water !== 'rain' && (farm.stopReason === 'water' || farm.prio[0] === 'water')) {
      const lower = pool.filter(p => p.ev.needYear <= curEval.needYear);
      if (lower.length >= 3) pool = lower;
    }
    pool.sort((a, b) => b.ev.total - a.ev.total);
    const chosen = [];
    const add = (p, arch) => { chosen.push({ ...p, arch }); };
    add(pool[0], 'best');
    const top = farm.prio[0];
    const archs = ['water', 'soil', farm.livestock ? 'forage' : 'income'].filter(a => a !== top);
    if (archs.length < 2) archs.push('income');
    for (const arch of archs) {
      if (chosen.length >= 3) break;
      const minTotal = pool[0].ev.total * 0.6;
      const pick = pool.filter(p => p.ev.total >= minTotal && chosen.every(c => differs(c.rot, p.rot)))
        .sort((a, b) => (b.ev.metrics[arch] - a.ev.metrics[arch]) || (b.ev.total - a.ev.total))[0];
      if (pick) add(pick, arch);
    }
    for (const p of pool) { if (chosen.length >= 3) break; if (chosen.every(c => differs(c.rot, p.rot))) add(p, 'best'); }
    const suggestions = chosen.map(c => {
      const rot = alignStart(c.rot, farm);
      return { rot, ev: c.ev, arch: c.arch };
    });
    return { current: { rot: current, ev: curEval, arch: 'current' }, suggestions };
  }

  function confidence(rec, ctx) {
    let pts = 0;
    if (ctx.source === 'offline') pts += 2;
    if (ctx.zone.generic) pts += 1;
    if (rec.ev.marketMax >= 4) pts += 1;
    if (rec.ev.shortfall > 0.1) pts += 1;
    return pts === 0 ? 'high' : pts <= 1 ? 'medium' : 'low';
  }

  // ---------- Explanations ----------
  function explain(rec, cur, ctx, t, fmt, lang) {
    const { cl, zone, farm, ind } = ctx;
    const nm = id => C()[id].name[lang];
    const loc = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' }[lang];
    const sep = lang === 'ar' ? '، ' : ', ';
    const crops = [...new Set([...rec.rot.main, ...rec.rot.summer].filter(c => c !== 'none'))];
    const why = [], ev = [], ben = [], gaps = [], risks = [];
    if (rec.arch === 'current') {
      why.push(t('cur.why'));
    } else {
      const a = cur.ev.needYear, b = rec.ev.needYear;
      if (farm.water !== 'rain' && a > 0 && b < a * 0.95) why.push(fmt('why.water', { a: a.toLocaleString(loc), b: b.toLocaleString(loc), p: '-' + Math.round((1 - b / a) * 100) }));
      else if (farm.water !== 'rain' && b > a * 1.05) why.push(fmt('why.waterUp', { a: a.toLocaleString(loc), b: b.toLocaleString(loc) }));
      const leg = crops.filter(c => C()[c].nfix);
      if (leg.length) why.push(fmt('why.legume', { c: leg.map(nm).join(sep) }));
      if (rec.ev.cover > cur.ev.cover) why.push(fmt('why.cover', { a: rec.ev.cover, b: cur.ev.cover }));
      if (rec.ev.repeats < cur.ev.repeats || cur.ev.repeats > 0) why.push(t('why.break'));
      const deep = crops.find(c => C()[c].root === 'deep');
      if (deep) why.push(fmt('why.deep', { c: nm(deep) }));
      if (ind.heat.level !== 'green' && rec.ev.heatPen < cur.ev.heatPen * 0.9) why.push(t('why.heat'));
      if (farm.livestock && rec.ev.metrics.forage > cur.ev.metrics.forage + 5) why.push(t('why.forage'));
      if (rec.ev.metrics.income > cur.ev.metrics.income + 3) why.push(t('why.income'));
      // personalised with the farmer's own answers
      if (leg.length && (farm.fert === 'chem' || farm.fert === 'both')) why.push(t('why.fertSave'));
      if (leg.length && (farm.fert === 'none' || farm.fert === 'manure')) why.push(t('why.organicN'));
      if ((farm.pest === 'often' || farm.pest === 'some') && rec.ev.repeats === 0) why.push(t('why.pestLess'));
      if (farm.soil === 'salty' && crops.every(c => C()[c].saltTol >= 3)) why.push(t('why.salt'));
      if (farm.continue === 'no' && farm.stopReason === 'water' && farm.water !== 'rain' && b < a) why.push(t('why.yourWater'));
      if (farm.continue === 'no' && farm.stopReason === 'disease' && rec.ev.repeats === 0) why.push(t('why.yourDisease'));
    }
    ev.push(fmt('ev.heat', { old: cl.heatOld, now: cl.heatNow }));
    const d = cl.gwetRecent - cl.gwetBase;
    ev.push(fmt('ev.gwet', { d: (d < 0 ? '−' : '+') + Math.abs(d * 100).toFixed(0) + '% ' + t(d < 0 ? 'water.drier' : 'water.wetter') }));
    ev.push(fmt('ev.rain', { r: Math.round(cl.rainAnnual), e: Math.round(cl.et0Annual) }));
    ev.push(fmt('ev.smap', { v: zone.smapAnom.toFixed(3) }));
    if (farm.water !== 'rain') ev.push(fmt('ev.grace', { v: Math.abs(zone.graceTrend).toFixed(1) }));
    ev.push(fmt('ev.ndvi', { m: zone.bareMonths.map(m => t('months')[m]).join(sep) }));
    if (zone.slope > 3) ev.push(fmt('ev.srtm', { s: zone.slope }));

    crops.forEach(c => ben.push(C()[c].icon + ' ' + nm(c) + ': ' + C()[c].note[lang]));

    gaps.push(t(farm.soil && farm.soil !== 'unknown' ? 'gap.soilTest' : 'gap.salinity'));
    if (rec.ev.marketMax >= 2) gaps.push(t('gap.market'));
    gaps.push(t('gap.smap'));
    gaps.push(t('gap.demo'));
    if (zone.generic) gaps.push(t('gap.generic'));
    if (ctx.source === 'offline') gaps.push(t('gap.offline'));

    if (rec.ev.shortfall > 0.05) risks.push(t('risk.water'));
    crops.forEach(c => {
      const cr = C()[c];
      if (cr.heatSens.some(m => cl.heatMonthRecent[m] >= 2) && cr.heatTol <= 3) risks.push(fmt('risk.heat', { c: nm(c) }));
      if (cr.frostSens.some(m => cl.frostMonthProb[m] > 0.2)) risks.push(fmt('risk.frost', { c: nm(c) }));
      if (farm.soil === 'salty' && cr.saltTol <= 2) risks.push(fmt('risk.salt', { c: nm(c) }));
      if (farm.soil === 'sandy' && cr.droughtTol <= 2) risks.push(fmt('risk.sandy', { c: nm(c) }));
    });
    if (rec.ev.repeats > 0) risks.push(t('risk.repeat'));
    if (farm.pest === 'often') risks.push(t('risk.pestHealth'));
    crops.forEach(c => risks.push(C()[c].icon + ' ' + nm(c) + ': ' + C()[c].risk[lang]));
    return { why, ev, ben, gaps, risks: [...new Set(risks)] };
  }

  // Farmer says they will plant last season's crop again: check that plan
  function planCheck(cl, farm, t, fmt, lang) {
    const last = farm.current.main[2], prev = farm.current.main[1], crop = C()[last];
    const items = [];
    let ok = true;
    if (last === 'fallow') return { crop: last, ok: true, items };
    if (crop.family === C()[prev].family || last === prev) { ok = false; items.push(t('plan.repeat')); }
    const rot = { main: [prev, last, last], summer: ['none', farm.current.summer[2], 'none'] };
    const ev = evaluate(rot, cl, farm);
    const one = evaluate({ main: [last, last, last], summer: ['none', 'none', 'none'] }, cl, farm);
    if (farm.water !== 'rain' && one.needYear > availableWater(farm)) { ok = false; items.push(fmt('plan.water', { n: one.needYear.toLocaleString({ ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' }[lang]), a: availableWater(farm).toLocaleString({ ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' }[lang]) })); }
    if (crop.heatSens.some(m => cl.heatMonthRecent[m] >= 2) && crop.heatTol <= 3) { ok = false; items.push(t('plan.heat')); }
    if (farm.soil === 'salty' && crop.saltTol <= 2) { ok = false; items.push(t('plan.salt')); }
    if (ok) items.push(t('plan.ok'));
    return { crop: last, ok, items, ev };
  }

  window.ENGINE = { planCheck, indicators, calendar, evaluate, recommend, confidence, explain, availableWater, WATER_LEVELS, AG_YEAR, yearKc };
})();
