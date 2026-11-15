// DAWRA — Google Earth Engine script (paste into https://code.earthengine.google.com)
// Replaces the demo zone values in js/regions.js with real extractions on a common 250 m grid.
// Output: one CSV row per zone with SMAP anomaly, GRACE-FO trend, SRTM slope, NDVI bare months, IMERG heavy-rain days.

var zones = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-6.69, 32.50]).buffer(9000), {id: 'beniamir'}),
  ee.Feature(ee.Geometry.Point([-6.62, 32.28]).buffer(9000), {id: 'benimoussa'}),
  ee.Feature(ee.Geometry.Point([-6.33, 32.37]).buffer(9000), {id: 'dir'}),
  ee.Feature(ee.Geometry.Point([-6.27, 32.60]).buffer(9000), {id: 'kasba'}),
  ee.Feature(ee.Geometry.Point([-6.57, 31.96]).buffer(9000), {id: 'azilal'}),
  ee.Feature(ee.Geometry.Point([-6.91, 32.88]).buffer(9000), {id: 'khouribga'})
]);
var SCALE = 250;

// 1. SMAP surface soil moisture anomaly: 2021–2025 vs 2016–2020 (NASA SMAP L3 / SPL3SMP_E via GEE)
var smap = ee.ImageCollection('NASA/SMAP/SPL3SMP_E/006').select('soil_moisture_am');
var smapAnom = smap.filterDate('2021-01-01', '2026-01-01').mean()
  .subtract(smap.filterDate('2016-01-01', '2021-01-01').mean()).rename('smapAnom');

// 2. GRACE-FO / GRACE mascon water-storage trend (cm/yr)
var grace = ee.ImageCollection('NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI').select('lwe_thickness')
  .filterDate('2010-01-01', '2026-01-01')
  .map(function (img) {
    var t = ee.Image(img.date().difference(ee.Date('2010-01-01'), 'year')).float().rename('t');
    return t.addBands(img).set('system:time_start', img.get('system:time_start'));
  });
var graceTrend = grace.reduce(ee.Reducer.linearFit()).select('scale').rename('graceTrend');

// 3. SRTM slope (%)
var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003')).multiply(Math.PI / 180).tan().multiply(100).rename('slope');

// 4. Bare months from Sentinel-2 NDVI (monthly median NDVI < 0.2, 2021–2025)
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
  .filterDate('2021-01-01', '2026-01-01')
  .map(function (i) { return i.normalizedDifference(['B8', 'B4']).rename('ndvi').copyProperties(i, ['system:time_start']); });
var bareBands = ee.List.sequence(1, 12).map(function (m) {
  return s2.filter(ee.Filter.calendarRange(m, m, 'month')).median().lt(0.2).rename(ee.String('bare_').cat(ee.Number(m).format('%02d')));
});
var bare = ee.ImageCollection.fromImages(bareBands).toBands();

// 5. GPM IMERG heavy-rain days (>= 20 mm/day), mean per year 2001–2025
var imerg = ee.ImageCollection('NASA/GPM_L3/IMERG_V07').select('precipitation').filterDate('2001-01-01', '2026-01-01');
var daily = ee.List.sequence(0, 24).map(function (y) {
  var start = ee.Date('2001-01-01').advance(y, 'year');
  var days = ee.List.sequence(0, 364).map(function (d) {
    var s = start.advance(d, 'day');
    return imerg.filterDate(s, s.advance(1, 'day')).mean().multiply(24).gte(20);
  });
  return ee.ImageCollection.fromImages(days).sum();
});
var storms = ee.ImageCollection.fromImages(daily).mean().rename('storms');

// 6. ECOSTRESS LST could be added via AppEEARS (ECO2LSTE) — not in the GEE public catalog.

var stack = smapAnom.addBands(graceTrend).addBands(slope).addBands(bare).addBands(storms);
var table = stack.reduceRegions({ collection: zones, reducer: ee.Reducer.mean(), scale: SCALE, tileScale: 4 });
print(table);
Export.table.toDrive({ collection: table, description: 'dawra_zone_layers', fileFormat: 'CSV' });
