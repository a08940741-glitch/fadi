# DAWRA دورة — Crop rotation advice for Moroccan farmers using NASA data

NASA Space Apps Challenge 2026 · Beni Mellal · Challenge: *Field Shift: Adapting Farms with NASA Data*

DAWRA turns 25 years of NASA Earth observations into a simple field card and compares the farmer's current crop rotation with 3 better ones, explaining **why**, the **evidence**, the **gaps** and the **risks**. Arabic/Darija (RTL), French and English.

## Run it

```bash
node server.js
```

Then open http://localhost:8766. No dependencies or install needed. Leaflet, Chart.js and the Cairo font load from CDNs.

## Farm profile (no login)

1. The site opens straight on the farm questionnaire: no name, phone number or code is asked. The DAWRA logo shows the info page. There is no account: the finished profile is saved in the farmer's own browser (localStorage), so the dashboard reopens on the next visit. **My farm → Clear my information** deletes it.
2. **Farm profile wizard** (5 steps, every answer required before moving on):
   - Land & soil: location on the map, commune/village, area, soil type (tirs/clay, hamri/loam, sandy, stony, salty, unknown)
   - Water: well (condition, depth), dam canal, amount of water, irrigation method
   - Crops: this year, the year before, 2 years ago; will you grow the same crop again (and why not); trees
   - Fertilizer (chemical / manure / both / none), pesticides (often / sometimes / never), livestock
   - Priorities ranked 1–4
3. The **dashboard** (field card, rotations, advice, my farm) is built on the profile + NASA data: soil type changes water needs and salt risk, chemical use adds fertilizer and pesticide advice, the "same crop again?" answer gets its own plan check, and "not enough water" never yields a rotation that needs more water.

### Interactive dashboard (5 tabs)
- **Field card:** farm banner, a 0–100 health gauge, 6 indicators sorted by risk (tap one to open its explanation), and a calendar where you tap a month to see what happens in it and why it is at risk.
- **Rotations:** a plan check for the "same crop again" answer, a **"What if…?" simulator** (sliders for available water, a dry/wet year, +0–3 °C) that recomputes every suggestion live, and 4 comparison cards with numeric scores.
- **Build my rotation:** the farmer picks the crop for each year and sees the score, the gain vs the current rotation, and warnings (repeated family, no legume, not enough water, beet too often, fallow) live, then opens the full advice for that rotation.
- **Advice:** a quick switch between all rotations, a score gauge, and sections you open and close (why and risks are open by default). **Download the PDF report** saves an A4 PDF with the farm, field health, comparison and full advice for every rotation, in the chosen language (html2pdf.js from cdnjs, loaded only on click). Without internet it saves the same report as an HTML page with a Print / PDF button.
- **My farm:** profile summary, edit, re-run analysis, clear my information.

### Privacy and security
- No accounts: no name, phone number or code is ever asked, and the server stores nothing about farmers. Each farmer's answers stay in their own browser (localStorage) until they tap **Clear my information**.
- `server.js` only serves an allow-list of public files (`server.js`, `data/` and `.git/` are unreachable) and sends a CSP, X-Frame-Options and nosniff headers. It has no API and no database.
- All user text is HTML-escaped in the interface.
- **Before a real deployment:** serve over HTTPS (Render does this automatically).

## The 5 screens

1. **Field**: tap the satellite map, use GPS, or pick a demo field (irrigated Tadla, rain-fed Khouribga, Dir foothills).
2. **My farm**: 4 icon questions: last 3 seasons' crops, water source & amount, livestock, priority ranking.
3. **Field card**: 6 traffic-light indicators (heat, water stress, rain reliability, groundwater, frost, erosion), a 12-month bare-field calendar, and charts of heat days and seasonal rain.
4. **Compare**: current rotation + 3 suggestions (best for you, water saver, soil healer, livestock or income) with water, income, soil, forage and risk scores, plus a confidence level.
5. **Advice**: why / satellite evidence / benefits / unknowns / risks, a reminder to check with an ONCA advisor, voice read-out, print/PDF, WhatsApp share.

**Advisor mode** (top switch) shows the raw indicator table and data sources.

## Data

| Layer | Status in this prototype |
|---|---|
| NASA POWER daily 2001–2025 (T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT) | **Live API** for the exact point, cached in the browser |
| Reference ET₀ | Computed from POWER with Hargreaves (FAO-56), ×0.85 semi-arid calibration |
| SMAP, GRACE-FO, SRTM, Landsat/Sentinel-2 NDVI, ECOSTRESS, SoilGrids | Demo estimates per zone (`js/regions.js`). `scripts/extract_layers_gee.js` extracts them for real in Google Earth Engine |

If the NASA API cannot be reached, the app falls back to typical Tadla values and tells the user.

## Engine (`js/engine.js`)

- FAO-56 monthly water balance: Kc × ET₀ − effective rain → irrigation need (m³/ha, with irrigation efficiency) or water deficit (rain-fed).
- Builds every 3-year rotation from 18 Moroccan crops under agronomic rules: no same plant family two years running, sugar beet at most once in 3 years, at least one legume, at least one wheat year (irrigated) or cereal (rain-fed), at most one summer crop, and only rain-fed crops on rain-fed land.
- Scores water / income / soil / forage, weighted by the farmer's own ranking (40/30/20/10%), minus climate risk (heat during sensitive months, frost at flowering, water shortfall, disease build-up, market risk).
- Every sentence in the explanations comes from computed facts in templates. Nothing is invented.

## Files

```
index.html  css/style.css  manifest.json  sw.js (offline)  server.js
js/i18n.js      translations ar / fr / en
js/crops.js     Moroccan crop library (Kc, sensitivities, notes, risks)
js/regions.js   Beni Mellal–Khénifra zones + demo fields
js/nasa.js      NASA POWER client + climate indicators
js/engine.js    indicators, water balance, rotations, scoring, explanations
js/app.js       user interface
scripts/extract_layers_gee.js   Earth Engine extraction of the zone layers
```

> DAWRA is a support tool. It does not replace the farmer's experience or the agricultural advisor.
