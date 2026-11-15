// DAWRA — Moroccan crop library
// kc: monthly crop coefficient, index 0 = January ... 11 = December (0 = not in the field)
// Values follow FAO-56 stages adapted to the usual Moroccan calendar (Tadla / bour).
// income, forage, soil, droughtTol, heatTol, saltTol: 1 (low) .. 5 (high)
// heatSens: months when heat > 35 °C hurts the crop most (flowering / grain filling)
// frostSens: months when frost hurts (flowering)

window.CROPS = {
  durum: {
    icon: '🌾', family: 'cereal', season: 'winter', rainfed: true,
    name: { ar: 'القمح الصلب', fr: 'Blé dur', en: 'Durum wheat' },
    kc: [1.0, 1.15, 1.15, 1.0, 0.5, 0, 0, 0, 0, 0, 0.4, 0.7],
    heatSens: [3, 4], frostSens: [2], income: 3, forage: 2, soil: 1, root: 'medium',
    droughtTol: 3, heatTol: 2, saltTol: 3, nfix: false, marketRisk: 1,
    note: { ar: 'سوق مضمون وثمن مرجعي، لكن الشركي فأبريل وماي كيضر الحبة.', fr: 'Marché sûr, mais le chergui d’avril–mai abîme le remplissage du grain.', en: 'Secure market, but April–May chergui heat damages grain filling.' },
    risk: { ar: 'تكرار القمح كيزيد أمراض الجذور (الفوزاريوم) والأعشاب.', fr: 'Blé sur blé : plus de maladies racinaires (fusariose) et d’adventices.', en: 'Wheat after wheat raises root diseases (Fusarium) and weeds.' }
  },
  soft: {
    icon: '🌾', family: 'cereal', season: 'winter', rainfed: true,
    name: { ar: 'القمح الطري', fr: 'Blé tendre', en: 'Soft wheat' },
    kc: [1.0, 1.15, 1.15, 0.95, 0.45, 0, 0, 0, 0, 0, 0.4, 0.7],
    heatSens: [3, 4], frostSens: [2], income: 3, forage: 2, soil: 1, root: 'medium',
    droughtTol: 3, heatTol: 2, saltTol: 3, nfix: false, marketRisk: 1,
    note: { ar: 'محصول أساسي ومدعوم، حساس للحرارة فوقت امتلاء الحبة.', fr: 'Culture de base soutenue, sensible à la chaleur au remplissage.', en: 'Staple, supported crop; heat-sensitive at grain filling.' },
    risk: { ar: 'نفس أمراض القمح الصلب إلا تكرر.', fr: 'Mêmes maladies que le blé dur en cas de répétition.', en: 'Same disease build-up as durum when repeated.' }
  },
  barley: {
    icon: '🌿', family: 'cereal', season: 'winter', rainfed: true,
    name: { ar: 'الشعير', fr: 'Orge', en: 'Barley' },
    kc: [1.0, 1.1, 1.05, 0.7, 0.3, 0, 0, 0, 0, 0, 0.4, 0.7],
    heatSens: [3], frostSens: [2], income: 2, forage: 4, soil: 1, root: 'medium',
    droughtTol: 4, heatTol: 4, saltTol: 4, nfix: false, marketRisk: 1,
    note: { ar: 'كيتحمل الجفاف والملوحة، كيكمل بكري قبل الشركي، علف وتبن للماشية.', fr: 'Tolère sécheresse et salinité, finit avant le chergui, grain + paille pour le bétail.', en: 'Drought and salt tolerant, finishes before chergui, grain + straw for livestock.' },
    risk: { ar: 'مازال حبوب: ما كيكسرش دورة أمراض القمح.', fr: 'Reste une céréale : ne casse pas le cycle des maladies du blé.', en: 'Still a cereal: does not break wheat disease cycles.' }
  },
  faba: {
    icon: '🍃', family: 'legume', season: 'winter', rainfed: true,
    name: { ar: 'الفول', fr: 'Fève / Féverole', en: 'Faba bean' },
    kc: [1.0, 1.1, 1.1, 0.8, 0.3, 0, 0, 0, 0, 0, 0.45, 0.7],
    heatSens: [2, 3], frostSens: [1, 2], income: 3, forage: 3, soil: 5, root: 'medium',
    droughtTol: 2, heatTol: 2, saltTol: 2, nfix: true, marketRisk: 2,
    note: { ar: 'كيثبت الآزوت فالتربة (تقريبا 50–100 كغ/هكتار) وكيكسر دورة أمراض الحبوب.', fr: 'Fixe l’azote (≈50–100 kg N/ha) et casse le cycle des maladies des céréales.', en: 'Fixes nitrogen (~50–100 kg N/ha) and breaks cereal disease cycles.' },
    risk: { ar: 'الهالوك (الأوروبانش) والتبقع الشوكولاتي فالعوام الرطبة.', fr: 'Orobanche et botrytis (taches chocolat) les années humides.', en: 'Broomrape (Orobanche) and chocolate spot in wet years.' }
  },
  chickpea: {
    icon: '🟤', family: 'legume', season: 'winter', rainfed: true,
    name: { ar: 'الحمص', fr: 'Pois chiche', en: 'Chickpea' },
    kc: [0.6, 0.9, 1.0, 1.0, 0.6, 0.2, 0, 0, 0, 0, 0, 0.4],
    heatSens: [3, 4], frostSens: [2], income: 4, forage: 1, soil: 4, root: 'deep',
    droughtTol: 4, heatTol: 3, saltTol: 2, nfix: true, marketRisk: 2,
    note: { ar: 'قليل الما، ثمن مزيان، كيثبت الآزوت، جذوره عميقة.', fr: 'Peu d’eau, bon prix, fixe l’azote, racines profondes.', en: 'Low water, good price, fixes nitrogen, deep roots.' },
    risk: { ar: 'مرض الأسكوكيتا فالشتا الرطب: خاص بذور مقاومة.', fr: 'Anthracnose (Ascochyta) en hiver humide : semences tolérantes.', en: 'Ascochyta blight in wet winters: use tolerant seed.' }
  },
  lentil: {
    icon: '🟠', family: 'legume', season: 'winter', rainfed: true,
    name: { ar: 'العدس', fr: 'Lentille', en: 'Lentil' },
    kc: [0.9, 1.05, 1.05, 0.7, 0.3, 0, 0, 0, 0, 0, 0.4, 0.6],
    heatSens: [3], frostSens: [2], income: 4, forage: 2, soil: 4, root: 'medium',
    droughtTol: 4, heatTol: 3, saltTol: 2, nfix: true, marketRisk: 2,
    note: { ar: 'مناسب للبور، كيعوض الجاشير وكيزيد الآزوت للقمح الجاي.', fr: 'Adaptée au bour, remplace la jachère et enrichit le blé suivant.', en: 'Suited to rain-fed land, replaces fallow, feeds the next wheat.' },
    risk: { ar: 'الحصاد صعيب بالآلة، والهالوك ممكن.', fr: 'Récolte mécanique délicate, orobanche possible.', en: 'Hard to harvest mechanically; broomrape possible.' }
  },
  pea: {
    icon: '🟢', family: 'legume', season: 'winter', rainfed: true,
    name: { ar: 'الجلبانة', fr: 'Petit pois', en: 'Pea' },
    kc: [1.0, 1.1, 1.0, 0.6, 0, 0, 0, 0, 0, 0, 0.45, 0.7],
    heatSens: [2, 3], frostSens: [1, 2], income: 3, forage: 3, soil: 4, root: 'shallow',
    droughtTol: 2, heatTol: 2, saltTol: 2, nfix: true, marketRisk: 2,
    note: { ar: 'دورة قصيرة، كيخلي الأرض بكري، كيثبت الآزوت.', fr: 'Cycle court, libère le sol tôt, fixe l’azote.', en: 'Short cycle, frees the land early, fixes nitrogen.' },
    risk: { ar: 'حساس للصقيع وقت النوار وللحرارة.', fr: 'Sensible au gel à la floraison et à la chaleur.', en: 'Sensitive to frost at flowering and to heat.' }
  },
  vetchoat: {
    icon: '🌱', family: 'legume', season: 'winter', rainfed: true,
    name: { ar: 'البيقية + الخرطال (علف)', fr: 'Vesce-avoine (fourrage)', en: 'Vetch-oat (forage)' },
    kc: [1.0, 1.0, 0.9, 0.6, 0, 0, 0, 0, 0, 0.5, 0.6, 0.8],
    heatSens: [], frostSens: [], income: 2, forage: 5, soil: 4, root: 'medium',
    droughtTol: 3, heatTol: 3, saltTol: 3, nfix: true, marketRisk: 1,
    note: { ar: 'علف شتوي رخيص للبقر، كيغطي الأرض وكيثبت الآزوت، كيتقطع قبل الحرارة.', fr: 'Fourrage d’hiver bon marché, couvre le sol, fixe l’azote, fauché avant la chaleur.', en: 'Cheap winter forage, covers soil, fixes nitrogen, cut before the heat.' },
    risk: { ar: 'الدخل المباشر ضعيف إلا ما عندكش الماشية.', fr: 'Faible revenu direct sans élevage.', en: 'Low direct income without livestock.' }
  },
  berseem: {
    icon: '☘️', family: 'legume', season: 'winter', rainfed: false,
    name: { ar: 'البرسيم', fr: 'Bersim', en: 'Berseem clover' },
    kc: [1.0, 1.05, 1.05, 1.05, 0.9, 0, 0, 0, 0, 0.5, 0.8, 0.95],
    heatSens: [], frostSens: [0, 1], income: 2, forage: 5, soil: 4, root: 'medium',
    droughtTol: 2, heatTol: 2, saltTol: 3, nfix: true, marketRisk: 1,
    note: { ar: 'علف أخضر بعدة حشات فالشتا، كيحسن التربة.', fr: 'Fourrage vert à plusieurs coupes en hiver, améliore le sol.', en: 'Multi-cut green winter forage, improves soil.' },
    risk: { ar: 'خاصو السقي، ماشي للبور.', fr: 'Exige l’irrigation, pas pour le bour.', en: 'Needs irrigation, not for rain-fed land.' }
  },
  alfalfa: {
    icon: '🍀', family: 'legume', season: 'year', rainfed: false,
    name: { ar: 'الفصة', fr: 'Luzerne', en: 'Alfalfa' },
    kc: [0.6, 0.7, 0.85, 0.95, 1.0, 1.05, 1.05, 1.0, 0.95, 0.85, 0.7, 0.6],
    heatSens: [], frostSens: [], income: 3, forage: 5, soil: 5, root: 'deep',
    droughtTol: 2, heatTol: 4, saltTol: 3, nfix: true, marketRisk: 1,
    note: { ar: 'جذور عميقة بزاف، كتحسن التربة وكتعطي علف طول العام للحليب.', fr: 'Racines très profondes, améliore le sol, fourrage toute l’année pour le lait.', en: 'Very deep roots, builds soil, year-round forage for dairy.' },
    risk: { ar: 'كتشرب بزاف ديال الما فالصيف: صعيبة مع قطع السقي.', fr: 'Très gourmande en eau l’été : risquée avec les coupures d’irrigation.', en: 'Very thirsty in summer: risky with irrigation cuts.' }
  },
  beet: {
    icon: '🟣', family: 'amaranth', season: 'winter', rainfed: false,
    name: { ar: 'الشمندر السكري', fr: 'Betterave sucrière', en: 'Sugar beet' },
    kc: [1.0, 1.15, 1.2, 1.2, 1.1, 0.9, 0, 0, 0, 0.35, 0.5, 0.8],
    heatSens: [4, 5], frostSens: [], income: 4, forage: 2, soil: 1, root: 'deep',
    droughtTol: 2, heatTol: 3, saltTol: 4, nfix: false, marketRisk: 1,
    note: { ar: 'عقد مع المعمل وثمن مضمون، لكن كتحتاج ما كثير.', fr: 'Contrat avec la sucrerie et prix garanti, mais beaucoup d’eau.', en: 'Factory contract and guaranteed price, but high water use.' },
    risk: { ar: 'إلا تقطع الما فالربيع، الخسارة كبيرة. ما تعاودهاش قبل 3–4 سنين (النيماتود).', fr: 'Coupure d’eau au printemps = grosse perte. Pas avant 3–4 ans (nématodes).', en: 'A spring water cut means big losses. Wait 3–4 years before repeating (nematodes).' }
  },
  maize: {
    icon: '🌽', family: 'cereal', season: 'summer', rainfed: false,
    name: { ar: 'الذرة العلفية', fr: 'Maïs ensilage', en: 'Silage maize' },
    kc: [0, 0, 0, 0, 0.4, 0.8, 1.15, 1.15, 0.7, 0, 0, 0],
    heatSens: [6, 7], frostSens: [], income: 3, forage: 5, soil: 1, root: 'medium',
    droughtTol: 1, heatTol: 3, saltTol: 2, nfix: false, marketRisk: 1,
    note: { ar: 'علف قوي للبقر الحلوب فالصيف.', fr: 'Fourrage énergétique pour vaches laitières en été.', en: 'High-energy summer forage for dairy cows.' },
    risk: { ar: 'أكثر محصول كيشرب الما فوقت الحرارة والفرشة نازلة.', fr: 'Très gourmand en eau en plein été, quand la nappe baisse.', en: 'Very thirsty at peak summer, when groundwater is falling.' }
  },
  sorghum: {
    icon: '🌾', family: 'cereal', season: 'summer', rainfed: false,
    name: { ar: 'الذرة البيضاء العلفية', fr: 'Sorgho fourrager', en: 'Forage sorghum' },
    kc: [0, 0, 0, 0, 0.4, 0.75, 1.0, 1.0, 0.6, 0, 0, 0],
    heatSens: [], frostSens: [], income: 2, forage: 4, soil: 2, root: 'deep',
    droughtTol: 4, heatTol: 5, saltTol: 4, nfix: false, marketRisk: 1,
    note: { ar: 'كيتحمل الحرارة والعطش أكثر من الذرة، تقريبا 30% ما أقل.', fr: 'Supporte chaleur et soif mieux que le maïs, ≈30 % d’eau en moins.', en: 'Handles heat and drought better than maize, ~30% less water.' },
    risk: { ar: 'الحشة الأولى صغيرة: خطر الدورين (HCN) على الماشية.', fr: 'Jeunes repousses : risque d’acide cyanhydrique pour le bétail.', en: 'Young regrowth: prussic acid (HCN) risk for livestock.' }
  },
  quinoa: {
    icon: '🌼', family: 'amaranth', season: 'winter', rainfed: true,
    name: { ar: 'الكينوا', fr: 'Quinoa', en: 'Quinoa' },
    kc: [0.9, 1.0, 1.0, 0.6, 0, 0, 0, 0, 0, 0, 0.4, 0.6],
    heatSens: [2, 3], frostSens: [], income: 3, forage: 1, soil: 2, root: 'medium',
    droughtTol: 4, heatTol: 2, saltTol: 5, nfix: false, marketRisk: 4,
    note: { ar: 'كتتحمل الملوحة والجفاف، جربوها فالمغرب (INRA)، ثمنها عالي.', fr: 'Tolère sel et sécheresse, testée au Maroc (INRA), prix élevé.', en: 'Salt and drought tolerant, trialled in Morocco (INRA), high price.' },
    risk: { ar: 'السوق صغير: خاص عقد مع تعاونية قبل الزريعة.', fr: 'Marché étroit : contrat avec une coopérative avant de semer.', en: 'Small market: get a cooperative contract before sowing.' }
  },
  rapeseed: {
    icon: '🌻', family: 'brassica', season: 'winter', rainfed: true,
    name: { ar: 'السلجم (الكولزا)', fr: 'Colza', en: 'Rapeseed' },
    kc: [1.0, 1.1, 1.15, 1.0, 0.5, 0, 0, 0, 0, 0, 0.4, 0.7],
    heatSens: [3], frostSens: [2], income: 3, forage: 1, soil: 3, root: 'deep',
    droughtTol: 3, heatTol: 2, saltTol: 3, nfix: false, marketRisk: 2,
    note: { ar: 'جذر وتدي كيفتح التربة، كيكسر دورة الحبوب، الدولة كتشجع الزيوت.', fr: 'Racine pivotante qui décompacte, casse le cycle céréalier, filière oléagineuse soutenue.', en: 'Taproot loosens soil, breaks the cereal cycle, oilseed sector is supported.' },
    risk: { ar: 'خاص زريعة بكري، والطيور والحشرات فوقت النوار.', fr: 'Semis précoce nécessaire ; ravageurs à la floraison.', en: 'Needs early sowing; pests at flowering.' }
  },
  sunflower: {
    icon: '🌻', family: 'aster', season: 'spring', rainfed: true,
    name: { ar: 'عباد الشمس', fr: 'Tournesol', en: 'Sunflower' },
    kc: [0, 0.3, 0.5, 0.85, 1.05, 0.9, 0.4, 0, 0, 0, 0, 0],
    heatSens: [5], frostSens: [2], income: 3, forage: 1, soil: 3, root: 'deep',
    droughtTol: 3, heatTol: 3, saltTol: 3, nfix: false, marketRisk: 2,
    note: { ar: 'جذور عميقة كتجبد الما من التحت، محصول زيتي مدعوم.', fr: 'Racines profondes qui puisent l’eau en profondeur, oléagineux soutenu.', en: 'Deep roots draw water from depth; supported oilseed.' },
    risk: { ar: 'الطيور والهالوك، وحساس للحرارة فوقت امتلاء الحبة.', fr: 'Oiseaux et orobanche ; sensible à la chaleur au remplissage.', en: 'Birds and broomrape; heat-sensitive at seed filling.' }
  },
  cumin: {
    icon: '🟫', family: 'apiaceae', season: 'winter', rainfed: true,
    name: { ar: 'الكمون', fr: 'Cumin', en: 'Cumin' },
    kc: [0.7, 0.9, 0.9, 0.5, 0, 0, 0, 0, 0, 0, 0, 0.4],
    heatSens: [3], frostSens: [1], income: 5, forage: 0, soil: 2, root: 'shallow',
    droughtTol: 3, heatTol: 3, saltTol: 2, nfix: false, marketRisk: 4,
    note: { ar: 'محصول نقدي مربح فالبور، كيكسر دورة الحبوب.', fr: 'Culture de rente rentable en bour, casse le cycle céréalier.', en: 'Profitable cash crop on rain-fed land, breaks the cereal cycle.' },
    risk: { ar: 'الثمن كيطلع ويهبط بزاف، ومرض الفوزاريوم فالرطوبة.', fr: 'Prix très volatils ; fusariose en conditions humides.', en: 'Very volatile prices; Fusarium wilt in humid conditions.' }
  },
  coriander: {
    icon: '🌿', family: 'apiaceae', season: 'winter', rainfed: true,
    name: { ar: 'القزبور (حبوب)', fr: 'Coriandre (graines)', en: 'Coriander (seed)' },
    kc: [1.0, 1.0, 0.9, 0.5, 0, 0, 0, 0, 0, 0, 0.4, 0.7],
    heatSens: [3], frostSens: [], income: 3, forage: 0, soil: 2, root: 'shallow',
    droughtTol: 3, heatTol: 3, saltTol: 2, nfix: false, marketRisk: 3,
    note: { ar: 'دورة قصيرة، سوق التصدير، كيجلب النحل.', fr: 'Cycle court, marché d’export, attire les pollinisateurs.', en: 'Short cycle, export market, attracts pollinators.' },
    risk: { ar: 'السوق متقلب: خاص مشتري قبل الزريعة.', fr: 'Marché fluctuant : trouver un acheteur avant de semer.', en: 'Fluctuating market: find a buyer before sowing.' }
  },
  fallow: {
    icon: '🟫', family: 'none', season: 'none', rainfed: true,
    name: { ar: 'جاشير (أرض فارغة)', fr: 'Jachère (sol nu)', en: 'Fallow (bare soil)' },
    kc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    heatSens: [], frostSens: [], income: 0, forage: 1, soil: 1, root: 'none',
    droughtTol: 5, heatTol: 5, saltTol: 5, nfix: false, marketRisk: 0,
    note: { ar: 'الأرض كترتاح ولكن كتبقى عريانة وكتتعرى بالريح والشتا.', fr: 'Le sol se repose mais reste nu, exposé à l’érosion.', en: 'Land rests but stays bare and exposed to erosion.' },
    risk: { ar: 'بلا دخل والتربة كتضيع.', fr: 'Aucun revenu et perte de sol.', en: 'No income and soil loss.' }
  }
};

// Crops a farmer can pick as "what I grew" (winter/main slot and summer slot)
window.MAIN_CROPS = ['durum', 'soft', 'barley', 'beet', 'faba', 'chickpea', 'lentil', 'pea', 'vetchoat', 'berseem', 'alfalfa', 'quinoa', 'rapeseed', 'sunflower', 'cumin', 'coriander', 'fallow'];
window.SUMMER_CROPS = ['none', 'maize', 'sorghum'];
