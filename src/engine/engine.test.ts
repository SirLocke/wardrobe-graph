import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyColorTemp,
  deriveSeasonPalette,
  hexToHsl,
  scoreGarmentBiometrics,
} from './colorMath';
import { generateOutfitsForContext } from './outfitGenerator';
import { analyzeWardrobeGaps } from './gapAnalyzer';
import {
  buildLlmWardrobeAnalysisPrompt,
  parseAndNormalizeWardrobeImport,
} from './wardrobeFormatter';
import {
  DEFAULT_BIOMETRIC_PROFILE,
  deriveScopeFromTargets,
  getQuickItemsForScopes,
  isSubcategoryAllowedForScope,
  normalizeWardrobeScopes,
  SEED_WARDROBE_GARMENTS,
  SEED_WOMENSWEAR_GARMENTS,
} from '../data/seedData';
import {
  createDefaultWardrobeState,
  handleMcpJsonRpcRequest,
} from '../mcp/mcpHandler';
import {
  buildDefaultGarmentName,
  getShortOutfitTitle,
  isDefaultGarmentName,
  matchesGarmentSearch,
  normalizeBrandKey,
  suggestSizeForGarment,
} from './brandSizeMatcher';

test('colorMath: hexToHsl and classifyColorTemp classify warm, cool, and neutral accurately', () => {
  const sage = hexToHsl('#8F9779');
  assert.equal(classifyColorTemp(sage), 'warm');

  const charcoal = hexToHsl('#141414');
  assert.equal(classifyColorTemp(charcoal), 'neutral');

  const offWhite = hexToHsl('#F4F1EA');
  assert.ok(offWhite.l >= 90);

  const navy = hexToHsl('#1B263B');
  assert.equal(classifyColorTemp(navy), 'cool');
});

test('colorMath: deriveSeasonPalette maps Soft Autumn for Olive + Medium Contrast + Muted Chroma', () => {
  const palette = deriveSeasonPalette(DEFAULT_BIOMETRIC_PROFILE);
  assert.ok(palette.seasonName.includes('Soft Autumn'));
  assert.equal(palette.powerColors.length, 12);
  assert.equal(palette.coreNeutrals.length, 6);
  assert.equal(palette.avoidColors.length, 6);
  assert.equal(palette.recommendedNecklines.length, 3);
});

test('colorMath: scoreGarmentBiometrics rewards eye echo and penalizes clashing neon/pastel', () => {
  const sageTee = SEED_WARDROBE_GARMENTS.find((g) => g.id === 'seed_top_1')!;
  const sageScore = scoreGarmentBiometrics(sageTee, DEFAULT_BIOMETRIC_PROFILE);
  assert.ok(sageScore.score >= 85, `Expected sage tee >= 85, got ${sageScore.score}`);
  assert.ok(
    sageScore.reasons.some((r) => r.includes('Augenfarbe')),
    'Expected eye color amplifier trace on Sage Tee'
  );

  // Test clashing neon magenta v-neck on olive muted skin
  const neonHsl = hexToHsl('#FF1493');
  const clashScore = scoreGarmentBiometrics(
    {
      category: 'base_top',
      colorName: 'Neon-Magenta',
      colorHex: '#FF1493',
      hsl: neonHsl,
      colorTemp: classifyColorTemp(neonHsl),
      neckline: 'v_neck',
      texture: 'smooth_cotton',
    },
    DEFAULT_BIOMETRIC_PROFILE
  );
  assert.ok(clashScore.score < 40, `Expected clashing neon < 40, got ${clashScore.score}`);
  assert.ok(
    clashScore.reasons.some((r) => r.includes('Farbtemperatur beißt sich')),
    'Expected undertone clash trace'
  );
});

test('outfitGenerator: generates top outfits with German rule traces across contexts', () => {
  const mildOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
    },
    5
  );
  assert.ok(mildOutfits.length > 0, 'Should generate outfits for Mild Casual 18°C');
  assert.ok(mildOutfits[0].totalScore >= 80, `Top outfit score should be >= 80, got ${mildOutfits[0].totalScore}`);
  assert.ok(mildOutfits[0].traces.length >= 2, 'Should include German rule traces');

  // Verify MMR diversity: Top 3 outfits must use 3 different mid-layers, Top 4 must use 4 different base-tops
  const top3MidIds = new Set(
    mildOutfits.slice(0, 3).map((o) => o.items.find((i) => i.category === 'mid_layer')?.id)
  );
  assert.equal(top3MidIds.size, 3, 'Top 3 outfits must showcase 3 distinct mid-layers');

  const top4BaseIds = new Set(
    mildOutfits.slice(0, 4).map((o) => o.items.find((i) => i.category === 'base_top')?.id)
  );
  assert.equal(top4BaseIds.size, 4, 'Top 4 outfits must showcase 4 distinct base-tops');

  // Rain filter excludes non-water-resistant footwear
  const rainOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 6,
      weather: 'rain_wet',
      occasion: 'casual',
      lockedGarmentIds: [],
    },
    5
  );
  assert.ok(rainOutfits.length > 0, 'Should generate outfits for Cold/Wet 6°C');
  for (const outfit of rainOutfits) {
    for (const item of outfit.items) {
      if (item.category === 'footwear' || item.category === 'outerwear') {
        assert.equal(item.waterResistant, true, `${item.name} must be waterResistant in rain_wet`);
      }
    }
  }
});

test('gapAnalyzer: detects deliberate Orphan Pieces and computes Top 5 High-ROI Shopping Recommendations', () => {
  const report = analyzeWardrobeGaps(SEED_WARDROBE_GARMENTS, DEFAULT_BIOMETRIC_PROFILE);

  assert.ok(
    report.orphanPieces.length >= 2,
    `Expected at least 2 orphan pieces, got ${report.orphanPieces.length}`
  );
  const orphanIds = report.orphanPieces.map((o) => o.garment.id);
  assert.ok(orphanIds.includes('seed_orphan_1'), 'Expected Burgunder Turtleneck to be flagged as Orphan Piece');
  assert.ok(orphanIds.includes('seed_orphan_2'), 'Expected Waldkiefer Suede Blouson to be flagged as Orphan Piece');

  assert.equal(report.recommendations.length, 5, 'Should return Top 5 High-ROI recommendations');
  assert.ok(
    report.recommendations[0].newOutfitsUnlocked > 0,
    'Top recommendation must unlock new valid outfits'
  );
});

test('wardrobeFormatter: parses LLM Markdown code fence JSON, auto-calculates HSL/colorTemp, and repairs missing fields', () => {
  const llmMarkdownOutput = `
Hier sind deine 2 empfohlenen Teile als JSON:
\`\`\`json
[
  {
    "name": "Merino Pullover Waldkiefer",
    "subcategory": "knit_sweater",
    "colorName": "Waldkiefer",
    "colorHex": "2D4A3E",
    "fit": "regular",
    "neckline": "crewneck",
    "texture": "fine_knit",
    "thermalRating": 3,
    "formality": 4,
    "waterResistant": false
  },
  {
    "name": "Wollhose Anthrazit",
    "category": "bottom",
    "subcategory": "trousers",
    "colorName": "Anthrazit",
    "colorHex": "#2B2D42",
    "fit": "regular",
    "texture": "flannel_wool",
    "thermalRating": 3,
    "formality": 4
  }
]
\`\`\`
  `;

  const parsed = parseAndNormalizeWardrobeImport(llmMarkdownOutput);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.garments.length, 2);
  // Inferred category 'mid_layer' from 'knit_sweater' and normalized '#2D4A3E'
  assert.equal(parsed.garments[0].category, 'mid_layer');
  assert.equal(parsed.garments[0].colorHex, '#2D4A3E');
  assert.equal(parsed.garments[0].colorTemp, 'warm');
  assert.equal(parsed.garments[1].neckline, 'none');

  const report = analyzeWardrobeGaps(SEED_WARDROBE_GARMENTS, DEFAULT_BIOMETRIC_PROFILE);
  const prompt = buildLlmWardrobeAnalysisPrompt(
    DEFAULT_BIOMETRIC_PROFILE,
    SEED_WARDROBE_GARMENTS,
    report
  );
  assert.ok(prompt.includes('ImportGarment'), 'Prompt should include TypeScript/JSON schema');
  assert.ok(prompt.includes('seed_top_1'), 'Prompt should include current wardrobe JSON');
});

test('mcpHandler: executes initialize, tools/list, and tools/call (add_garment + list_garments) deterministically', async () => {
  let memState = createDefaultWardrobeState();
  const mockStore = {
    getState: async () => memState,
    setState: async (next: typeof memState) => {
      memState = next;
    },
  };

  const initRes = await handleMcpJsonRpcRequest(
    { jsonrpc: '2.0', id: 1, method: 'initialize' },
    mockStore
  );
  assert.equal(initRes?.id, 1);

  const toolsRes = await handleMcpJsonRpcRequest(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    mockStore
  );
  const toolsList = (toolsRes?.result as { tools: Array<{ name: string }> }).tools;
  assert.equal(toolsList.length, 9);

  const addRes = await handleMcpJsonRpcRequest(
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'add_garment',
        arguments: {
          name: 'MCP Test Overshirt Salbei',
          subcategory: 'overshirt',
          colorName: 'Salbeigrün',
          colorHex: '#8F9779',
          fit: 'relaxed',
          texture: 'twill_chino',
          thermalRating: 3,
          formality: 3,
        },
      },
    },
    mockStore
  );
  const contentText = (
    addRes?.result as { content: Array<{ text: string }> }
  ).content[0].text;
  const parsedPayload = JSON.parse(contentText);
  assert.equal(parsedPayload.status, 'created');
  assert.equal(parsedPayload.totalWardrobeCount, 22);
  assert.ok(parsedPayload.biometricScore >= 80);
});

test('womenswear & styleVibe: generates Womenswear outfits across style vibes and detects Womenswear orphans', () => {
  const chicOutfits = generateOutfitsForContext(
    SEED_WOMENSWEAR_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 16,
      weather: 'sunny_dry',
      occasion: 'smart_casual_office',
      styleVibe: 'tailored_chic',
      lockedGarmentIds: [],
    },
    5
  );
  assert.ok(chicOutfits.length > 0, 'Should generate Womenswear outfits for Tailored Chic 16°C');
  assert.ok(chicOutfits[0].totalScore >= 85, `Expected high Tailored Chic score, got ${chicOutfits[0].totalScore}`);

  const capsuleOutfits = generateOutfitsForContext(
    SEED_WOMENSWEAR_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 16,
      weather: 'sunny_dry',
      occasion: 'casual',
      styleVibe: 'minimal_capsule',
      lockedGarmentIds: [],
    },
    5
  );
  assert.ok(capsuleOutfits.length > 0, 'Should generate Minimal Capsule outfits');
  assert.ok(
    capsuleOutfits[0].traces.some((t) => t.includes('Capsule')),
    'Should include Capsule trace when minimal_capsule is active'
  );

  const womenGapReport = analyzeWardrobeGaps(SEED_WOMENSWEAR_GARMENTS, DEFAULT_BIOMETRIC_PROFILE);
  const orphanIds = womenGapReport.orphanPieces.map((o) => o.garment.id);
  assert.ok(orphanIds.includes('fem_orphan_1'), 'Should detect Feinstrick Rollkragen Burgunder as orphan piece');
  assert.ok(orphanIds.includes('fem_orphan_2'), 'Should detect Suede-Bikerjacke Waldkiefer as orphan piece');
});

test('brandSizeMatcher: normalizes typos like "addidas", suggests brand sizes ("Nike = L"), searches by brand/size, and builds concise outfit titles', () => {
  assert.equal(normalizeBrandKey('addidas'), 'adidas');
  assert.equal(normalizeBrandKey('Adidas'), 'adidas');
  assert.equal(normalizeBrandKey('NIKE'), 'nike');

  const nikeSug = suggestSizeForGarment('mid_layer', 'nike', DEFAULT_BIOMETRIC_PROFILE);
  assert.equal(nikeSug.suggestedSize, 'L');
  assert.equal(nikeSug.source, 'brand_rule');

  const adidasTypoSug = suggestSizeForGarment('base_top', 'addidas', DEFAULT_BIOMETRIC_PROFILE);
  assert.equal(adidasTypoSug.suggestedSize, 'M');
  assert.equal(adidasTypoSug.source, 'brand_rule');

  const shoeSug = suggestSizeForGarment('footwear', '', DEFAULT_BIOMETRIC_PROFILE);
  assert.equal(shoeSug.suggestedSize, '42');
  assert.equal(shoeSug.source, 'category_default');

  // Search matching with "addidas" typo against an "Adidas" garment
  const adidasItem = SEED_WARDROBE_GARMENTS.find((g) => g.brand === 'Adidas');
  assert.ok(adidasItem, 'Seed should contain an Adidas garment');
  assert.equal(matchesGarmentSearch(adidasItem!, 'addidas'), true);
  assert.equal(matchesGarmentSearch(adidasItem!, 'nike'), false);

  // Concise outfit title without verbose concatenations
  const sampleTop = SEED_WARDROBE_GARMENTS.find((g) => g.category === 'mid_layer')!;
  const sampleBottom = SEED_WARDROBE_GARMENTS.find((g) => g.category === 'bottom')!;
  const title = getShortOutfitTitle([sampleTop, sampleBottom]);
  assert.ok(title.includes('&'), `Expected concise title with '&', got "${title}"`);
  assert.ok(title.length < 40, `Expected short outfit title < 40 chars, got "${title}"`);
});

test('wearTracking: sorts garments accurately by wear count and last worn timestamp', () => {
  const g1 = { ...SEED_WARDROBE_GARMENTS[0], id: 't1', wearCount: 15, lastWornDate: '2026-11-01T12:00:00Z' };
  const g2 = { ...SEED_WARDROBE_GARMENTS[1], id: 't2', wearCount: 0, lastWornDate: undefined };
  const g3 = { ...SEED_WARDROBE_GARMENTS[2], id: 't3', wearCount: 7, lastWornDate: '2026-11-02T08:00:00Z' };

  // Sort wear_desc (most worn first)
  const byWearDesc = [g1, g2, g3].sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0));
  assert.deepEqual(byWearDesc.map((g) => g.id), ['t1', 't3', 't2']);

  // Sort wear_asc (rarely/never worn first - Schrankhüter)
  const byWearAsc = [g1, g2, g3].sort((a, b) => (a.wearCount || 0) - (b.wearCount || 0));
  assert.deepEqual(byWearAsc.map((g) => g.id), ['t2', 't3', 't1']);

  // Sort last_worn_desc (most recently worn first)
  const byLastWorn = [g1, g2, g3].sort((a, b) => {
    const dateA = a.lastWornDate ? new Date(a.lastWornDate).getTime() : 0;
    const dateB = b.lastWornDate ? new Date(b.lastWornDate).getTime() : 0;
    return dateB - dateA;
  });
  assert.deepEqual(byLastWorn.map((g) => g.id), ['t3', 't1', 't2']);
});

test('multiScope: derives scopes and quickItems accurately for single, paired, and all 3 categories', () => {
  // Single scope
  assert.equal(deriveScopeFromTargets(['womenswear']), 'womenswear');
  assert.equal(deriveScopeFromTargets(['menswear']), 'menswear');
  assert.equal(deriveScopeFromTargets(['unisex']), 'unisex');

  // Pair: womenswear + unisex => womenswear (includes unisex basics)
  assert.equal(deriveScopeFromTargets(['womenswear', 'unisex']), 'womenswear');

  // Pair: menswear + unisex => menswear (includes unisex basics)
  assert.equal(deriveScopeFromTargets(['menswear', 'unisex']), 'menswear');

  // Both / All three: womenswear + menswear + unisex => all
  assert.equal(deriveScopeFromTargets(['womenswear', 'menswear', 'unisex']), 'all');
  assert.equal(deriveScopeFromTargets(['womenswear', 'menswear']), 'all');

  // Quick items for single vs multi-selection
  const womenItems = getQuickItemsForScopes(['womenswear']);
  assert.ok(womenItems.includes('blouse'));
  assert.ok(womenItems.includes('midi_skirt'));
  assert.ok(!womenItems.includes('button_down_shirt'));

  const womenAndUnisex = getQuickItemsForScopes(['womenswear', 'unisex']);
  assert.ok(womenAndUnisex.includes('blouse'));
  assert.ok(womenAndUnisex.includes('hoodie')); // from unisex
  assert.ok(womenAndUnisex.includes('denim')); // from unisex

  const allThree = getQuickItemsForScopes(['womenswear', 'menswear', 'unisex']);
  assert.ok(allThree.includes('blouse')); // womenswear
  assert.ok(allThree.includes('button_down_shirt')); // menswear
  assert.ok(allThree.includes('hoodie')); // unisex

  // Subcategory filtering allows chosen scopes
  assert.equal(isSubcategoryAllowedForScope('blouse', ['womenswear']), true);
  assert.equal(isSubcategoryAllowedForScope('blouse', ['menswear']), false);
  assert.equal(isSubcategoryAllowedForScope('blouse', ['menswear', 'womenswear']), true);
  assert.equal(isSubcategoryAllowedForScope('hoodie', ['menswear']), true);
  assert.equal(isSubcategoryAllowedForScope('hoodie', ['womenswear']), true);
});

test('userExactProfile & accessories: handles copper hair, warm undertone, blue-gray eyes and accessory imports', () => {
  const userProfile = {
    ...DEFAULT_BIOMETRIC_PROFILE,
    undertone: 'warm' as const,
    skinHex: '#D4A38B',
    hairColorName: 'Kupferblond / Goldbraun',
    hairHex: '#8C6244',
    eyeColorName: 'Blau-Grau',
    eyeHex: '#526878',
    contrastLevel: 'medium' as const,
    chromaLevel: 'moderate' as const,
    haircutStyle: 'medium_textured_flow' as const,
    wardrobeScopes: ['menswear' as const, 'unisex' as const],
    styleVibe: 'minimal_capsule' as const,
    reasoningDe:
      'Der warme, leicht pfirsichfarbene Hautunterton und die gold-kupfernen Reflexe im lockigen Haar bilden einen harmonischen, mittleren Kontrast zu den kühleren blau-grauen Augen. Warme, mittelkräftige Naturtöne wie Off-White, Salbei, Camel und Marineblau unterstreichen diese natürliche Ausstrahlung optimal, ohne den Teint zu überstrahlen.',
  };

  // Derive palette
  const palette = deriveSeasonPalette(userProfile);
  assert.ok(palette.seasonName.includes('Spring') || palette.seasonName.includes('Autumn'));
  assert.ok(palette.powerColors.length >= 6);

  // Test wardrobe import with accessories (watch, sunglasses, bracelet, belt)
  const sampleImportJson = JSON.stringify([
    {
      name: 'Kupferfarbene Chronograph-Uhr',
      category: 'accessory',
      subcategory: 'watch',
      colorName: 'Kupfer',
      colorHex: '#8C6244',
      brand: 'Seiko',
      size: '40 mm',
      formality: 3,
    },
    {
      name: 'Schwarze Wayfarer Sonnenbrille',
      category: 'accessory',
      subcategory: 'sunglasses',
      colorName: 'Schwarz',
      colorHex: '#141414',
      brand: 'Ray-Ban',
      size: 'OneSize',
      formality: 2,
    },
    {
      name: 'Dunkelbraunes Lederarmband',
      category: 'accessory',
      subcategory: 'bracelet',
      colorName: 'Espresso',
      colorHex: '#3B2F2F',
      brand: 'Fossil',
      size: 'M',
      formality: 2,
    },
    {
      name: 'Off-White Heavyweight T-Shirt',
      category: 'base_top',
      subcategory: 'heavyweight_tee',
      colorName: 'Off-White',
      colorHex: '#F4F1EA',
      brand: 'Uniqlo',
      size: 'M',
      formality: 2,
    },
    {
      name: 'Dunkelblaue Raw Denim Jeans',
      category: 'bottom',
      subcategory: 'denim',
      colorName: 'Raw Indigo',
      colorHex: '#24344D',
      brand: "Levi's",
      size: 'W32/L32',
      formality: 2,
    },
    {
      name: 'Weiße Sneaker',
      category: 'footwear',
      subcategory: 'sneaker_clean',
      colorName: 'Off-White',
      colorHex: '#F4F1EA',
      brand: 'Adidas',
      size: '42',
      formality: 2,
    },
  ]);

  const importResult = parseAndNormalizeWardrobeImport(sampleImportJson);
  assert.equal(importResult.ok, true);
  assert.equal(importResult.garments.length, 6);

  const importedAccessories = importResult.garments.filter((g) => g.category === 'accessory');
  assert.equal(importedAccessories.length, 3);
  assert.ok(importedAccessories.some((a) => a.subcategory === 'watch'));
  assert.ok(importedAccessories.some((a) => a.subcategory === 'sunglasses'));
  assert.ok(importedAccessories.some((a) => a.subcategory === 'bracelet'));

  // Generate outfit with sunny weather to verify sunglasses/watch integration
  const generatedOutfits = generateOutfitsForContext(
    importResult.garments,
    userProfile,
    {
      temperatureC: 22,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
    },
    3
  );

  assert.ok(generatedOutfits.length > 0);
  const bestOutfit = generatedOutfits[0];
  const hasAccessory = bestOutfit.items.some((g) => g.category === 'accessory');
  assert.equal(hasAccessory, true, 'Best outfit in sunny weather should include an accessory');

  // Verify configurable accessory toggles (Socken, Mütze/Cap, Armband) on SEED_WARDROBE_GARMENTS
  const defaultOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    userProfile,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
    },
    3
  );
  const topDefaultSubcats = defaultOutfits[0].items.map((i) => i.subcategory);
  assert.ok(topDefaultSubcats.includes('socks'), 'Default outfit should include socks');
  assert.ok(topDefaultSubcats.includes('cap_beanie'), 'Default outfit should include cap_beanie');
  assert.ok(topDefaultSubcats.includes('bracelet'), 'Default outfit should include bracelet');

  // Exclude cap_beanie and bracelet, keep socks enabled
  const filteredOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    userProfile,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
      excludedAccessorySubcategories: ['cap_beanie', 'bracelet'],
    },
    3
  );
  const topFilteredSubcats = filteredOutfits[0].items.map((i) => i.subcategory);
  assert.ok(topFilteredSubcats.includes('socks'), 'Filtered outfit should still include socks');
  assert.ok(!topFilteredSubcats.includes('cap_beanie'), 'Filtered outfit must NOT include excluded cap_beanie');
  assert.ok(!topFilteredSubcats.includes('bracelet'), 'Filtered outfit must NOT include excluded bracelet');

  // Master toggle includeAccessories: false disables all unlocked accessories
  const noAccOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    userProfile,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
      includeAccessories: false,
    },
    3
  );
  assert.equal(
    noAccOutfits[0].items.some((i) => i.category === 'accessory'),
    false,
    'Master toggle includeAccessories: false should exclude all accessories'
  );

  // Verify short socks ('socks_short') vs long socks ('socks') recommendations:
  // 1) No outfit ever contains both 'socks' and 'socks_short' simultaneously
  for (const outfit of defaultOutfits) {
    const sockItems = outfit.items.filter(
      (i) => i.subcategory === 'socks' || i.subcategory === 'socks_short'
    );
    assert.ok(sockItems.length <= 1, 'An outfit must never contain both short and long socks');
  }

  // 2) Warm weather (24°C) with sneakers recommends short socks ('socks_short')
  const warmSneakerOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    userProfile,
    {
      temperatureC: 24,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: ['seed_shoe_1'],
    },
    3
  );
  assert.ok(
    warmSneakerOutfits[0].items.some((i) => i.subcategory === 'socks_short'),
    'Warm weather sneaker outfit should recommend short socks (socks_short)'
  );

  // 3) Boots always get long socks ('socks'), never short socks ('socks_short')
  const bootOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    userProfile,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: ['seed_shoe_2'],
    },
    3
  );
  assert.ok(
    bootOutfits[0].items.some((i) => i.subcategory === 'socks'),
    'Boot outfit should recommend long socks (socks)'
  );
  assert.ok(
    !bootOutfits[0].items.some((i) => i.subcategory === 'socks_short'),
    'Boot outfit must not recommend short socks'
  );

  // 4) Switching styleVibe ('minimal_capsule', 'tailored_chic', 'street_relaxed', 'statement_editorial') visibly changes the recommended top outfit
  const capsuleTop = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      styleVibe: 'minimal_capsule',
      lockedGarmentIds: [],
    },
    5
  )[0];
  const tailoredTop = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      styleVibe: 'tailored_chic',
      lockedGarmentIds: [],
    },
    5
  )[0];
  const streetTop = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      styleVibe: 'street_relaxed',
      lockedGarmentIds: [],
    },
    5
  )[0];
  assert.notEqual(
    capsuleTop.id,
    tailoredTop.id,
    'Switching between minimal_capsule and tailored_chic must produce different top outfits'
  );
  assert.notEqual(
    tailoredTop.id,
    streetTop.id,
    'Switching between tailored_chic and street_relaxed must produce different top outfits'
  );
});

test('customGarmentName & shoeAccents & multiSelectRatings: preserves custom names on type change, supports shoe accent colors, and handles accessory/multi-select filters', () => {
  // 1) Default name detection vs custom name preservation
  assert.equal(
    isDefaultGarmentName('Hoodie Salbeigrün', 'hoodie', 'Salbeigrün'),
    true,
    'Auto-generated default name should be recognized as default'
  );
  assert.equal(
    isDefaultGarmentName('Sweatshirt Off-White', 'crewneck_sweater', 'Off-White'),
    true,
    'Auto-generated sweatshirt default name should be recognized as default'
  );
  assert.equal(
    isDefaultGarmentName('Mein Lieblings-College-Pulli', 'hoodie', 'Salbeigrün'),
    false,
    'Custom imported or user-defined garment name must NOT be treated as default'
  );
  assert.equal(
    buildDefaultGarmentName('sneaker_clean', 'Off-White', 'Salbeigrün'),
    'Schlichte Sneaker Off-White / Salbeigrün'
  );
  assert.equal(
    isDefaultGarmentName('Schlichte Sneaker Off-White / Salbeigrün', 'sneaker_clean', 'Off-White', 'Salbeigrün'),
    true
  );

  // 2) Shoe accent color import, search & outfit harmony bonus
  const accentedShoeJson = JSON.stringify([
    {
      id: 'shoe_accent_test',
      name: 'Adidas Samba Weiß mit Grünen Streifen',
      category: 'footwear',
      subcategory: 'sneaker_clean',
      colorName: 'Off-White',
      colorHex: '#F4F1EA',
      accentColorName: 'Salbeigrün',
      accentColorHex: '#8F9779',
      formality: 2,
      formalities: [2, 3],
      thermalRating: 2,
      thermalRatings: [1, 2, 3],
    },
  ]);
  const parsedShoe = parseAndNormalizeWardrobeImport(accentedShoeJson);
  assert.equal(parsedShoe.ok, true);
  const importedShoe = parsedShoe.garments[0];
  assert.equal(importedShoe.accentColorName, 'Salbeigrün');
  assert.equal(importedShoe.accentColorHex, '#8F9779');
  assert.deepEqual(importedShoe.formalities, [2, 3]);
  assert.deepEqual(importedShoe.thermalRatings, [1, 2, 3]);
  assert.equal(matchesGarmentSearch(importedShoe, 'salbeigrün'), true, 'Search should match shoe accentColorName');

  // 3) Multi-select formalities ([2, 3]) allows casual sneaker in smart_casual_office ([3, 4])
  const officeOutfitsWithMultiShoe = generateOutfitsForContext(
    [...SEED_WARDROBE_GARMENTS, importedShoe],
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'smart_casual_office',
      lockedGarmentIds: ['shoe_accent_test'],
    },
    3
  );
  assert.ok(
    officeOutfitsWithMultiShoe.length > 0,
    'Garment with multi-select formalities [2, 3] should pass smart_casual_office filter'
  );
  assert.ok(
    officeOutfitsWithMultiShoe.some((o) =>
      o.traces.some((t) => t.includes('Akzentfarbe der Schuhe'))
    ),
    'Should include Farb-Echo trace when shoe accent color matches an outfit piece'
  );

  // 4) Accessories ignore formality/thermal filters so socks & accessories always appear even in formal_event
  const formalOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'smart_casual_office',
      lockedGarmentIds: [],
    },
    3
  );
  assert.ok(
    formalOutfits[0].items.some(
      (i) => i.subcategory === 'socks' || i.subcategory === 'socks_short'
    ),
    'Socks should always be included regardless of occasion formality window'
  );
});
