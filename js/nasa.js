// DAWRA — NASA POWER live data + climate indicators
// API docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
(function () {
  const START = 2001, END = 2025;
  const PARAMS = 'T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT';
  const CACHE_KEY = 'dawra.power.v2.';
  const HG_CAL = 0.85;

  function powerUrl(lat, lng) {
    return 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=' + PARAMS +
      '&community=AG&longitude=' + lng.toFixed(3) + '&latitude=' + lat.toFixed(3) +
      '&start=' + START + '0101&end=' + END + '1231&format=JSON';
  }

  // Extraterrestrial radiation Ra (mm/day equivalent) — FAO-56 eq. 21, used by Hargreaves ET0
  function ra(latDeg, doy) {
    const phi = latDeg * Math.PI / 180;
    const dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365);
    const dec = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
    const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))));
    const raMJ = (24 * 60 / Math.PI) * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
    return raMJ * 0.408;
  }

  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
  const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
  function slope(xs, ys) {
    const mx = mean(xs), my = mean(ys);
    let n = 0, d = 0;
    xs.forEach((x, i) => { n += (x - mx) * (ys[i] - my); d += (x - mx) ** 2; });
    return d ? n / d : 0;
  }

  function computeClimate(param, lat) {
    const tmaxD = param.T2M_MAX, tminD = param.T2M_MIN, prD = param.PRECTOTCORR, gwD = param.GWETROOT;
    const keys = Object.keys(tmaxD).sort();
    const years = [];
    for (let y = START; y <= END; y++) years.push(y);
    const heatAM = {}, frostFA = {}, stormY = {}, rainSeason = {};
    const heatMonth = {}, frostMonth = {};
    const rainM = {}, et0M = {}, gwM = {};
    years.forEach(y => { heatAM[y] = 0; frostFA[y] = 0; stormY[y] = 0; heatMonth[y] = Array(12).fill(0); frostMonth[y] = Array(12).fill(0); rainM[y] = Array(12).fill(0); et0M[y] = Array(12).fill(0); gwM[y] = Array.from({ length: 12 }, () => []); });
    const daily = []; // for onset detection
    keys.forEach(k => {
      const y = +k.slice(0, 4), m = +k.slice(4, 6) - 1, d = +k.slice(6, 8);
      const tx = tmaxD[k], tn = tminD[k], pr = prD[k], gw = gwD[k];
      if (tx === -999 || tn === -999) return;
      const date = new Date(Date.UTC(y, m, d));
      const doy = Math.floor((date - Date.UTC(y, 0, 0)) / 864e5);
      const tm = (tx + tn) / 2;
      // Hargreaves overestimates ET0 at dry inland sites; 0.85 is a common semi-arid calibration factor
      const et0 = Math.max(0, HG_CAL * 0.0023 * ra(lat, doy) * (tm + 17.8) * Math.sqrt(Math.max(0, tx - tn)));
      const p = pr === -999 ? 0 : pr;
      if (tx > 35) { heatMonth[y][m]++; if (m === 3 || m === 4) heatAM[y]++; }
      if (tn < 0) { frostMonth[y][m]++; if (m >= 1 && m <= 3) frostFA[y]++; }
      if (p >= 20) stormY[y]++;
      rainM[y][m] += p; et0M[y][m] += et0;
      if (gw !== -999) gwM[y][m].push(gw);
      const season = m >= 8 ? y + 1 : y;
      rainSeason[season] = (rainSeason[season] || 0) + p;
      daily.push({ y, m, d, p, season });
    });

    // Full hydrological seasons only (Sep–Aug)
    const seasons = Object.keys(rainSeason).map(Number).filter(s => s > START && s <= END).sort();
    const rainSeries = seasons.map(s => Math.round(rainSeason[s]));

    // Rain onset: first day after 1 Sep where the 5-day sum >= 20 mm
    const onsets = [];
    seasons.forEach(s => {
      const days = daily.filter(x => x.season === s);
      for (let i = 0; i < days.length && i < 200; i++) {
        let sum = 0;
        for (let j = i; j < i + 5 && j < days.length; j++) sum += days[j].p;
        if (sum >= 20) { onsets.push(i); break; }
      }
    });

    const recent = years.filter(y => y >= 2011);
    const monthAvg = (obj, ys) => Array.from({ length: 12 }, (_, m) => mean(ys.map(y => obj[y][m])));
    const gwMean = ys => mean(ys.flatMap(y => gwM[y].flat()));

    const heatSeries = years.map(y => heatAM[y]);
    const heatOld = mean(years.filter(y => y <= 2010).map(y => heatAM[y]));
    const heatNow = mean(years.filter(y => y >= 2016).map(y => heatAM[y]));
    const rainAnnual = mean(rainSeries);
    const et0Monthly = monthAvg(et0M, recent);
    const et0Annual = et0Monthly.reduce((a, b) => a + b, 0);

    return {
      years, heatSeries, seasons, rainSeries,
      heatOld: +heatOld.toFixed(1), heatNow: +heatNow.toFixed(1),
      heatTrend: +(slope(years, heatSeries) * 10).toFixed(1),
      heatMonthRecent: monthAvg(heatMonth, years.filter(y => y >= 2016)),
      frostMonthProb: Array.from({ length: 12 }, (_, m) => mean(years.map(y => frostMonth[y][m] > 0 ? 1 : 0))),
      frostProb: mean(years.map(y => frostFA[y] > 0 ? 1 : 0)),
      rainMonthly: monthAvg(rainM, recent), et0Monthly, rainAnnual, et0Annual,
      rainCV: std(rainSeries) / rainAnnual,
      rainTrend: +(slope(seasons, rainSeries) * 10).toFixed(0),
      onsetStd: onsets.length > 2 ? std(onsets) : 15,
      stormsPerYear: mean(years.map(y => stormY[y])),
      gwetBase: gwMean(years.filter(y => y <= 2015)), gwetRecent: gwMean(years.filter(y => y >= 2021))
    };
  }

  // Offline fallback: typical Tadla plain climate (estimated, used only when the API is unreachable)
  function fallbackClimate() {
    const years = []; for (let y = START; y <= END; y++) years.push(y);
    const heat = [2, 1, 4, 3, 2, 1, 3, 2, 1, 2, 3, 5, 2, 4, 3, 6, 5, 4, 7, 5, 6, 8, 9, 7, 8];
    const seasons = years.slice(1);
    const rain = [330, 290, 410, 260, 300, 350, 240, 420, 460, 390, 280, 360, 310, 340, 300, 230, 380, 270, 210, 250, 190, 230, 260, 310];
    return {
      years, heatSeries: heat, seasons, rainSeries: rain,
      heatOld: 2.1, heatNow: 6.6, heatTrend: 2.6,
      heatMonthRecent: [0, 0, 0.2, 1.5, 5.1, 12, 20, 19, 8, 1.5, 0, 0],
      frostMonthProb: [0.35, 0.25, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0.05, 0.3], frostProb: 0.3,
      rainMonthly: [45, 40, 42, 35, 18, 4, 1, 3, 10, 30, 48, 45], et0Monthly: [55, 70, 105, 130, 165, 195, 215, 200, 150, 105, 65, 50],
      rainAnnual: 310, et0Annual: 1505, rainCV: 0.24, rainTrend: -40, onsetStd: 22, stormsPerYear: 1.3,
      gwetBase: 0.42, gwetRecent: 0.36
    };
  }

  async function getClimate(lat, lng, onStep) {
    const key = CACHE_KEY + lat.toFixed(2) + ',' + lng.toFixed(2);
    try {
      const cached = localStorage.getItem(key);
      if (cached) { onStep && onStep('power'); return { climate: JSON.parse(cached), source: 'cache' }; }
    } catch (e) { /* storage unavailable */ }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const r = await fetch(powerUrl(lat, lng), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const climate = computeClimate(j.properties.parameter, lat);
      try { localStorage.setItem(key, JSON.stringify(climate)); } catch (e) { /* quota */ }
      onStep && onStep('power');
      return { climate, source: 'live' };
    } catch (e) {
      console.warn('NASA POWER unavailable, using fallback', e);
      onStep && onStep('power');
      return { climate: fallbackClimate(), source: 'offline' };
    }
  }

  window.NASA = { getClimate, computeClimate, fallbackClimate, powerUrl };
})();
