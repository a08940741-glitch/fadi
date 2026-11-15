// DAWRA — 7-day weather forecast for the field + farm alerts (chergui, frost, strong heat, heavy rain)
// Source: Open-Meteo forecast API (free, no key; ECMWF / GFS / other national weather models).
// NASA has no free day-by-day point forecast, so this is the one non-NASA data source in the app.
(function () {
  const CACHE_KEY = 'dawra.wx.v1.';
  const MAX_AGE = 3 * 3600e3; // reuse a forecast for 3 hours

  function url(lat, lng) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(3) + '&longitude=' + lng.toFixed(3) +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,' +
      'wind_speed_10m_max,wind_direction_10m_dominant,relative_humidity_2m_min' +
      '&timezone=Africa%2FCasablanca&forecast_days=7';
  }

  // Chergui: the hot, very dry wind that blows from the east / south-east (the Sahara) over the Moroccan plains.
  const fromEastOrSouth = dir => dir != null && dir >= 60 && dir <= 200;

  // Turn one day of forecast into alerts. Each alert: { type, level: 'amber'|'red' }
  function dayAlerts(d) {
    const out = [];
    const chergui = d.tmax >= 32 && d.rhMin != null && d.rhMin <= 20 && fromEastOrSouth(d.windDir);
    if (chergui) out.push({ type: 'chergui', level: d.tmax >= 38 ? 'red' : 'amber' });
    else if (d.tmax >= 35) out.push({ type: 'heat', level: d.tmax >= 40 ? 'red' : 'amber' });
    if (d.tmin <= 2) out.push({ type: 'frost', level: d.tmin <= 0 ? 'red' : 'amber' });
    if (d.rain >= 10) out.push({ type: 'rain', level: d.rain >= 25 ? 'red' : 'amber' });
    return out;
  }

  function parse(j) {
    const D = j.daily;
    return D.time.map((date, i) => {
      const day = {
        date,
        tmax: D.temperature_2m_max[i], tmin: D.temperature_2m_min[i],
        rain: D.precipitation_sum[i] || 0,
        rainProb: D.precipitation_probability_max ? D.precipitation_probability_max[i] : null,
        wind: D.wind_speed_10m_max ? D.wind_speed_10m_max[i] : null,
        windDir: D.wind_direction_10m_dominant ? D.wind_direction_10m_dominant[i] : null,
        rhMin: D.relative_humidity_2m_min ? D.relative_humidity_2m_min[i] : null
      };
      day.alerts = dayAlerts(day);
      return day;
    }).filter(d => d.tmax != null && d.tmin != null);
  }

  async function getForecast(lat, lng) {
    const key = CACHE_KEY + lat.toFixed(2) + ',' + lng.toFixed(2);
    try {
      const c = JSON.parse(localStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < MAX_AGE) return { days: c.days, fetched: c.t, cached: true };
    } catch (e) { /* storage unavailable */ }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(url(lat, lng), { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const days = parse(await r.json());
      if (!days.length) throw new Error('empty');
      const t = Date.now();
      try { localStorage.setItem(key, JSON.stringify({ t, days })); } catch (e) { /* quota */ }
      return { days, fetched: t, cached: false };
    } finally { clearTimeout(timer); }
  }

  window.WEATHER = { getForecast, dayAlerts, parse, url };
})();
