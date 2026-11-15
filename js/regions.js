// DAWRA — zone layers for Beni Mellal–Khénifra
// Climate (temperature, rain, root-zone soil wetness) is fetched LIVE from NASA POWER for the exact point.
// The layers below (SMAP, GRACE-FO, SRTM, ECOSTRESS, Landsat/Sentinel-2 NDVI, SoilGrids) are
// DEMO ESTIMATES per zone for the hackathon prototype. scripts/extract_layers_gee.js shows how to
// replace them with real Google Earth Engine extractions on a 250 m grid.

window.ZONES = [
  {
    id: 'beniamir', lat: 32.50, lng: -6.69, system: 'irrigated',
    name: { ar: 'بني عامر – الفقيه بن صالح', fr: 'Béni Amir – Fquih Ben Salah', en: 'Beni Amir – Fquih Ben Salah' },
    smapAnom: -0.045, graceTrend: -1.6, slope: 1.2, lstAnom: 1.4,
    soil: { texture: { ar: 'طينية-لومية', fr: 'Argilo-limoneux', en: 'Clay loam' }, om: 1.3, ph: 8.1, salinity: 'medium' },
    bareMonths: [6, 7, 8, 9], allocation: 5000,
    current: { main: ['beet', 'durum', 'durum'], summer: ['none', 'maize', 'none'] }
  },
  {
    id: 'benimoussa', lat: 32.28, lng: -6.62, system: 'irrigated',
    name: { ar: 'بني موسى – سوق السبت', fr: 'Béni Moussa – Souk Sebt', en: 'Beni Moussa – Souk Sebt' },
    smapAnom: -0.040, graceTrend: -1.4, slope: 1.0, lstAnom: 1.2,
    soil: { texture: { ar: 'طينية', fr: 'Argileux', en: 'Clay' }, om: 1.5, ph: 8.0, salinity: 'medium' },
    bareMonths: [6, 7, 8, 9], allocation: 5500,
    current: { main: ['alfalfa', 'soft', 'beet'], summer: ['none', 'maize', 'none'] }
  },
  {
    id: 'dir', lat: 32.37, lng: -6.33, system: 'mixed',
    name: { ar: 'الدير – بني ملال', fr: 'Dir de Béni Mellal', en: 'Beni Mellal Dir (foothills)' },
    smapAnom: -0.030, graceTrend: -1.1, slope: 7.5, lstAnom: 0.9,
    soil: { texture: { ar: 'لومية-حصوية', fr: 'Limoneux caillouteux', en: 'Stony loam' }, om: 1.9, ph: 7.8, salinity: 'low' },
    bareMonths: [6, 7, 8, 9, 10], allocation: 3000,
    current: { main: ['durum', 'durum', 'fallow'], summer: ['none', 'none', 'none'] }
  },
  {
    id: 'kasba', lat: 32.60, lng: -6.27, system: 'mixed',
    name: { ar: 'قصبة تادلة', fr: 'Kasba Tadla', en: 'Kasba Tadla' },
    smapAnom: -0.035, graceTrend: -1.2, slope: 3.0, lstAnom: 1.1,
    soil: { texture: { ar: 'لومية', fr: 'Limoneux', en: 'Loam' }, om: 1.4, ph: 8.2, salinity: 'low' },
    bareMonths: [6, 7, 8, 9, 10], allocation: 3500,
    current: { main: ['soft', 'barley', 'soft'], summer: ['none', 'none', 'none'] }
  },
  {
    id: 'azilal', lat: 31.96, lng: -6.57, system: 'rainfed',
    name: { ar: 'أزيلال (جبل)', fr: 'Azilal (montagne)', en: 'Azilal (mountain)' },
    smapAnom: -0.020, graceTrend: -0.8, slope: 15.0, lstAnom: 0.6,
    soil: { texture: { ar: 'لومية خفيفة', fr: 'Limono-sableux', en: 'Sandy loam' }, om: 2.2, ph: 7.6, salinity: 'low' },
    bareMonths: [6, 7, 8, 9, 10], allocation: 0,
    current: { main: ['barley', 'barley', 'fallow'], summer: ['none', 'none', 'none'] }
  },
  {
    id: 'khouribga', lat: 32.88, lng: -6.91, system: 'rainfed',
    name: { ar: 'هضبة خريبكة (بور)', fr: 'Plateau de Khouribga (bour)', en: 'Khouribga plateau (rain-fed)' },
    smapAnom: -0.035, graceTrend: -1.0, slope: 4.0, lstAnom: 1.0,
    soil: { texture: { ar: 'لومية حمراء (حمري)', fr: 'Limoneux rouge (hamri)', en: 'Red loam (hamri)' }, om: 1.1, ph: 7.9, salinity: 'low' },
    bareMonths: [5, 6, 7, 8, 9, 10], allocation: 0,
    current: { main: ['durum', 'fallow', 'durum'], summer: ['none', 'none', 'none'] }
  }
];

// Fallback when the field is far from all zones (> 45 km): generic semi-arid Moroccan profile
window.GENERIC_ZONE = {
  id: 'generic', system: 'mixed',
  name: { ar: 'منطقة عامة (بلا طبقات محلية)', fr: 'Zone générique (sans couches locales)', en: 'Generic zone (no local layers)' },
  smapAnom: -0.03, graceTrend: -1.0, slope: 3.0, lstAnom: 1.0,
  soil: { texture: { ar: 'غير معروفة', fr: 'Inconnue', en: 'Unknown' }, om: 1.2, ph: 8.0, salinity: 'unknown' },
  bareMonths: [6, 7, 8, 9], allocation: 4000,
  current: { main: ['durum', 'durum', 'durum'], summer: ['none', 'none', 'none'] },
  generic: true
};

// Demo fields for the judges
window.DEMO_FIELDS = [
  { zone: 'beniamir', lat: 32.512, lng: -6.701, label: { ar: 'حقل فاطمة (سقوي)', fr: 'Champ de Fatima (irrigué)', en: 'Fatima’s field (irrigated)' } },
  { zone: 'khouribga', lat: 32.862, lng: -6.884, label: { ar: 'حقل حسن (بور)', fr: 'Champ de Hassan (bour)', en: 'Hassan’s field (rain-fed)' } },
  { zone: 'dir', lat: 32.381, lng: -6.318, label: { ar: 'حقل فالدير', fr: 'Champ du Dir', en: 'Dir foothill field' } }
];
