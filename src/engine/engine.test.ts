import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyColorTemp,
  deriveSeasonPalette,
  hexToHsl,
  scoreGarmentBiometrics,
} from './colorMath';
import { generateOutfitsForContext, getActiveWornOutfits } from './outfitGenerator';
import {
  appendAffiliateParam,
  buildBrandOrShopUrl,
  decodeSharedOutfit,
  encodeSharedOutfit,
  isExampleGarment,
} from './outfitShare';
import { analyzeWardrobeGaps } from './gapAnalyzer';
import { instantiateCandidateArchetypes } from './archetypes';
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
  TEXTILE_COLOR_PRESETS,
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
import { computeGapStructuralKey } from './gapCacheKey';
import {
  createTranslator,
  DE_MESSAGES,
  EN_MESSAGES,
  tCategory,
  tOccasion,
  tWeather,
} from '../i18n/messages';
import { BiometricProfile } from '../types/wardrobe';

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
  assert.ok(
    palette.seasonName.includes('Gedämpfter Herbst') ||
      palette.seasonName.includes('Soft Autumn')
  );
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
  assert.equal(parsedPayload.totalWardrobeCount, 23);
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
  assert.ok(
    palette.seasonName.includes('Frühling') ||
      palette.seasonName.includes('Herbst') ||
      palette.seasonName.includes('Spring') ||
      palette.seasonName.includes('Autumn')
  );
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

  // Verify configurable accessory toggles (Socken, Cap, Mütze, Armband) on SEED_WARDROBE_GARMENTS
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
  assert.ok(
    !topDefaultSubcats.includes('beanie'),
    'Mild 18°C outfit must NOT include a warm winter beanie'
  );

  // Exclude cap, beanie and bracelet, keep socks enabled
  const filteredOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    userProfile,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
      excludedAccessorySubcategories: ['cap', 'beanie', 'bracelet'],
    },
    3
  );
  const topFilteredSubcats = filteredOutfits[0].items.map((i) => i.subcategory);
  assert.ok(topFilteredSubcats.includes('socks'), 'Filtered outfit should still include socks');
  assert.ok(!topFilteredSubcats.includes('cap'), 'Filtered outfit must NOT include excluded cap');
  assert.ok(!topFilteredSubcats.includes('beanie'), 'Filtered outfit must NOT include excluded beanie');
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

test('backupPersistence: parseAndNormalizeWardrobeImport preserves wornHistory, wearCount, print/logo/open/weather flags, and fleece/down textures', () => {
  const backupJson = JSON.stringify({
    version: 2,
    exportedAt: '2026-11-02T08:00:00.000Z',
    profile: {
      ...DEFAULT_BIOMETRIC_PROFILE,
      isDemoMode: false,
      autoLaundrySubcategories: ['t_shirt', 'socks'],
    },
    garments: [
      {
        id: 'custom_fleece_1',
        name: 'Patagonia Fleecejacke Salbei',
        category: 'outerwear',
        subcategory: 'fleece_jacket',
        colorName: 'Salbeigrün',
        colorHex: '#8F9779',
        texture: 'fleece',
        thermalRating: 4,
        formality: 2,
        windproof: true,
        rainproof: false,
        hasLogo: true,
        wearCount: 9,
        lastWornDate: '2026-11-01T10:00:00.000Z',
      },
      {
        id: 'custom_shirt_1',
        name: 'Offenes Flanellhemd Oliv',
        category: 'mid_layer',
        subcategory: 'overshirt',
        colorName: 'Dunkel-Oliv',
        colorHex: '#556B2F',
        texture: 'flannel_wool',
        thermalRating: 3,
        formality: 2,
        wornOpen: true,
        hasPrint: true,
        wearCount: 4,
      },
    ],
    wornHistory: [
      {
        id: 'worn_test_1',
        wornDate: '2026-11-01T10:00:00.000Z',
        outfitTitle: 'Fleecejacke & Flanellhemd',
        garmentIds: ['custom_fleece_1', 'custom_shirt_1'],
        garmentSnapshots: [
          {
            id: 'custom_fleece_1',
            name: 'Patagonia Fleecejacke Salbei',
            category: 'outerwear',
            subcategory: 'fleece_jacket',
            colorHex: '#8F9779',
            colorName: 'Salbeigrün',
          },
        ],
        occasion: 'casual',
        temperatureC: 12,
        weather: 'cloudy_windy',
        totalScore: 91,
      },
    ],
  });

  const parsed = parseAndNormalizeWardrobeImport(backupJson);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.garments.length, 2);
  assert.equal(parsed.garments[0].texture, 'fleece');
  assert.equal(parsed.garments[0].windproof, true);
  assert.equal(parsed.garments[0].hasLogo, true);
  assert.equal(parsed.garments[0].wearCount, 9);
  assert.equal(parsed.garments[1].wornOpen, true);
  assert.equal(parsed.garments[1].hasPrint, true);
  assert.equal(parsed.wornHistory?.length, 1);
  assert.equal(parsed.wornHistory?.[0].id, 'worn_test_1');
});

test('laundry & winterJacket & techWaterproof & variationSeed & categoryRecommendations: verifies all new wardrobe rules', async () => {
  const { canGarmentUseLaundry, shouldAutoMarkDirtyOnWear } = await import('../data/seedData');
  const { isGarmentWaterResistant } = await import('./outfitGenerator');

  // 1) Shoes and non-sock accessories never use laundry
  assert.equal(canGarmentUseLaundry({ category: 'footwear', subcategory: 'sneaker_clean' }), false);
  assert.equal(canGarmentUseLaundry({ category: 'accessory', subcategory: 'watch' }), false);
  assert.equal(canGarmentUseLaundry({ category: 'accessory', subcategory: 'socks' }), true);
  assert.equal(canGarmentUseLaundry({ category: 'base_top', subcategory: 't_shirt' }), true);

  // 2) Auto-laundry defaults to T-Shirts/Tops & Socks, not sweaters/jeans/shoes
  assert.equal(
    shouldAutoMarkDirtyOnWear({ category: 'base_top', subcategory: 't_shirt' }, DEFAULT_BIOMETRIC_PROFILE),
    true
  );
  assert.equal(
    shouldAutoMarkDirtyOnWear({ category: 'accessory', subcategory: 'socks' }, DEFAULT_BIOMETRIC_PROFILE),
    true
  );
  assert.equal(
    shouldAutoMarkDirtyOnWear({ category: 'mid_layer', subcategory: 'hoodie' }, DEFAULT_BIOMETRIC_PROFILE),
    false
  );
  assert.equal(
    shouldAutoMarkDirtyOnWear({ category: 'footwear', subcategory: 'sneaker_clean' }, DEFAULT_BIOMETRIC_PROFILE),
    false
  );

  // 3) Jacket with texture 'tech_waterproof' or subcategory 'rain_jacket' or 'rainproof: true' counts as water-resistant in rain
  const techJacket = {
    ...SEED_WARDROBE_GARMENTS.find((g) => g.category === 'outerwear')!,
    id: 'test_tech_jacket',
    name: 'Übergangsjacke Wasserabweisend',
    subcategory: 'light_jacket' as const,
    texture: 'tech_waterproof' as const,
    waterResistant: false,
  };
  assert.equal(isGarmentWaterResistant(techJacket), true, 'tech_waterproof texture must count as water-resistant');

  const rainOutfitsWithTechJacket = generateOutfitsForContext(
    [...SEED_WARDROBE_GARMENTS, techJacket],
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 12,
      weather: 'rain_wet',
      occasion: 'casual',
      lockedGarmentIds: ['test_tech_jacket'],
    },
    3
  );
  assert.ok(
    rainOutfitsWithTechJacket.length > 0,
    'Transitional jacket with tech_waterproof texture must be valid in rain_wet'
  );

  // 4) Non-waterproof Black Winter Jacket (down_jacket, thermalRating: 5, waterResistant: false) works in dry winter and is NOT an orphan
  const blackWinterJacket = {
    ...SEED_WARDROBE_GARMENTS.find((g) => g.category === 'outerwear')!,
    id: 'test_black_winter_jacket',
    name: 'Schwarze Winterjacke',
    subcategory: 'down_jacket' as const,
    colorName: 'Tiefschwarz',
    colorHex: '#141414',
    texture: 'down_quilted' as const,
    thermalRating: 5 as const,
    thermalRatings: [4, 5] as Array<1 | 2 | 3 | 4 | 5>,
    formality: 2 as const,
    formalities: [2, 3] as Array<1 | 2 | 3 | 4 | 5>,
    waterResistant: false,
  };

  const gapReportWithWinterJacket = analyzeWardrobeGaps(
    [...SEED_WARDROBE_GARMENTS, blackWinterJacket],
    DEFAULT_BIOMETRIC_PROFILE
  );
  const winterJacketOutfitCount =
    gapReportWithWinterJacket.outfitCountsByGarmentId['test_black_winter_jacket'] || 0;
  assert.ok(
    winterJacketOutfitCount >= 3,
    `Expected Schwarze Winterjacke to have >= 3 valid outfits in dry winter, got ${winterJacketOutfitCount}`
  );
  assert.equal(
    gapReportWithWinterJacket.orphanPieces.some((o) => o.garment.id === 'test_black_winter_jacket'),
    false,
    'Non-waterproof Schwarze Winterjacke must NOT be flagged as an orphan piece'
  );

  // 5) Category-specific recommendations exist for core categories
  assert.ok(gapReportWithWinterJacket.recommendationsByCategory, 'Should include recommendationsByCategory');
  assert.ok(
    (gapReportWithWinterJacket.recommendationsByCategory?.outerwear?.length || 0) > 0,
    'Should provide category-specific tips for outerwear'
  );

  // 6) variationSeed ("Neue Outfits generieren") produces fresh outfit variations
  const seed0Outfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
      variationSeed: 0,
    },
    5
  );
  const seed1Outfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
      variationSeed: 1,
    },
    5
  );
  assert.notDeepEqual(
    seed0Outfits.map((o) => o.id),
    seed1Outfits.map((o) => o.id),
    'Incrementing variationSeed should generate a different batch of outfits'
  );
});

test('colorNaming & categorization & dynamicWornOpen & capBeanieSplit & customColors: verifies new product rules', async () => {
  const { hexToGermanColorName, inferColorFromGarmentName, translateColorName } = await import(
    './colorNaming'
  );
  const { SUBCATEGORIES_BY_CATEGORY, getAllColorPresets } = await import('../data/seedData');
  const { getFrequentAndPopularBrands } = await import('./brandSizeMatcher');

  // 1) Hex-to-Color-Name translation (DE & EN) & title color inference
  assert.equal(hexToGermanColorName('#141414', 'de').name, 'Schwarz');
  assert.equal(hexToGermanColorName('#141414', 'en').name, 'Black');
  assert.equal(hexToGermanColorName('#8F9779', 'de').name, 'Salbeigrün');
  assert.equal(hexToGermanColorName('#8F9779', 'en').name, 'Sage Green');
  assert.equal(hexToGermanColorName('#1F3A2E', 'de').name, 'Tannengrün');
  assert.equal(hexToGermanColorName('#1F3A2E', 'en').name, 'Forest Green');
  assert.equal(hexToGermanColorName('#1C2838', 'de').name, 'Marineblau');
  assert.equal(hexToGermanColorName('#1C2838', 'en').name, 'Navy Blue');
  assert.equal(hexToGermanColorName('#36393C', 'de').name, 'Anthrazit');
  assert.equal(hexToGermanColorName('#36393C', 'en').name, 'Charcoal');
  assert.equal(hexToGermanColorName('#D8C8B0', 'de').name, 'Sandbeige');
  assert.equal(hexToGermanColorName('#D8C8B0', 'en').name, 'Sand Beige');

  assert.equal(translateColorName('Tannengrün', 'en', '#1F3A2E'), 'Forest Green');
  assert.equal(translateColorName('Forest Green', 'de', '#1F3A2E'), 'Tannengrün');
  assert.equal(translateColorName('Anthrazit', 'en', '#36393C'), 'Charcoal');

  const inferredBlackDe = inferColorFromGarmentName('Schwarze Winterjacke', 'de');
  assert.ok(inferredBlackDe, 'Should infer color from "Schwarze Winterjacke"');
  assert.equal(inferredBlackDe?.hex, '#141414');
  assert.equal(inferredBlackDe?.name, 'Schwarz');

  const inferredForestEn = inferColorFromGarmentName('Forest Green Wool Coat', 'en');
  assert.ok(inferredForestEn, 'Should infer color from "Forest Green Wool Coat"');
  assert.equal(inferredForestEn?.hex, '#1F3A2E');
  assert.equal(inferredForestEn?.name, 'Forest Green');

  // 2) Categorization rules (AGENTS.md)
  assert.ok(
    SUBCATEGORIES_BY_CATEGORY.base_top.includes('button_down_shirt'),
    'button_down_shirt must be in base_top'
  );
  assert.ok(
    SUBCATEGORIES_BY_CATEGORY.base_top.includes('short_sleeve_shirt'),
    'short_sleeve_shirt must be in base_top'
  );
  assert.ok(
    !SUBCATEGORIES_BY_CATEGORY.mid_layer.includes('button_down_shirt'),
    'button_down_shirt must not be in mid_layer'
  );
  assert.ok(
    SUBCATEGORIES_BY_CATEGORY.bottom.includes('suit_trousers'),
    'suit_trousers must be in bottom'
  );
  assert.ok(
    SUBCATEGORIES_BY_CATEGORY.accessory.includes('cap') &&
      SUBCATEGORIES_BY_CATEGORY.accessory.includes('beanie'),
    'cap and beanie must be separate subcategories in accessory'
  );

  // 3) Cap vs. Beanie temperature logic (no beanie at 22°C, beanie allowed at 5°C, never both)
  const warm22Outfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 22,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: [],
    },
    3
  );
  for (const outfit of warm22Outfits) {
    assert.equal(
      outfit.items.some((i) => i.subcategory === 'beanie'),
      false,
      'Must never recommend a warm beanie at 22°C'
    );
  }

  const cold5Outfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 5,
      weather: 'cloudy_windy',
      occasion: 'casual',
      lockedGarmentIds: [],
    },
    3
  );
  assert.ok(
    cold5Outfits.some((o) => o.items.some((i) => i.subcategory === 'beanie')),
    'Should recommend a beanie in cold 5°C weather'
  );
  for (const outfit of cold5Outfits) {
    const hasCap = outfit.items.some((i) => i.subcategory === 'cap');
    const hasBeanie = outfit.items.some((i) => i.subcategory === 'beanie');
    assert.equal(hasCap && hasBeanie, false, 'An outfit must never contain both cap and beanie');
  }

  // 4) Dynamic wornOpen wearing recommendation computed by outfitGenerator
  const mildOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      lockedGarmentIds: ['seed_mid_1'], // Overshirt Dunkel-Oliv over a base_top
    },
    3
  );
  assert.ok(mildOutfits.length > 0);
  const overshirtInOutfit = mildOutfits[0].items.find((i) => i.id === 'seed_mid_1');
  assert.equal(
    overshirtInOutfit?.wornOpen,
    true,
    'Overshirt combined with a base_top at 18°C should receive dynamic wornOpen: true recommendation'
  );

  // 5) Own / frequent brands appear in ownBrands and are excluded from popularBrands duplicates
  const customBrandGarments = [
    ...SEED_WARDROBE_GARMENTS,
    {
      ...SEED_WARDROBE_GARMENTS[0],
      id: 'own_brand_1',
      brand: 'MeineLieblingsMarke',
    },
  ];
  const brandResult = getFrequentAndPopularBrands(customBrandGarments, DEFAULT_BIOMETRIC_PROFILE);
  assert.ok(
    brandResult.ownBrands.includes('MeineLieblingsMarke'),
    'User brand from garments must be included in ownBrands'
  );
  assert.ok(
    brandResult.ownBrands.length > 0 && brandResult.popularBrands.length > 0,
    'Should return both ownBrands and popularBrands'
  );

  // 6) Custom colors in BiometricProfile are merged into getAllColorPresets(profile)
  const profileWithCustomColor = {
    ...DEFAULT_BIOMETRIC_PROFILE,
    customColors: [{ name: 'Mein Ozeanblau', hex: '#1B4F72', group: 'Blue & Cool' as const }],
  };
  const allPresets = getAllColorPresets(profileWithCustomColor);
  assert.ok(
    allPresets.some((c) => c.hex === '#1B4F72' && c.name === 'Mein Ozeanblau'),
    'Profile customColors must be included in getAllColorPresets'
  );
});

test('outfitGenerator: supports expanded occasions (homeoffice_lounge, beach_vacation), customOccasions, and combinable OutfitModifiers', () => {
  // 1) Homeoffice & Lounge occasion
  const homeOfficeOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    {
      temperatureC: 20,
      weather: 'sunny_dry',
      occasion: 'homeoffice_lounge',
      lockedGarmentIds: [],
      activeModifiers: ['extra_comfort', 'clean_no_print'],
    },
    3
  );
  assert.ok(homeOfficeOutfits.length > 0, 'Should generate outfits for homeoffice_lounge');
  assert.ok(
    homeOfficeOutfits[0].traces.some((t) => t.includes('Fokus [') || t.includes('Modifier')),
    'Should include active focus/modifier trace in explanation'
  );

  // 2) Custom Occasion with custom formality and defaultModifiers
  const profileWithCustomOccasion: BiometricProfile = {
    ...DEFAULT_BIOMETRIC_PROFILE,
    customOccasions: [
      {
        id: 'custom_brunch',
        name: 'Sonntags-Brunch',
        formalities: [2, 3],
        defaultModifiers: ['layered_open', 'monochrome_calm'],
      },
    ],
  };

  const customOccOutfits = generateOutfitsForContext(
    SEED_WARDROBE_GARMENTS,
    profileWithCustomOccasion,
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      customOccasionId: 'custom_brunch',
      lockedGarmentIds: [],
    },
    3
  );
  assert.ok(customOccOutfits.length > 0, 'Should generate outfits for custom occasion');
  assert.ok(
    customOccOutfits[0].traces.some((t) => t.includes('Sonntags-Brunch')),
    'Should mention custom occasion name in trace'
  );

  // 3) Outfit Share encoding/decoding & shop search URL
  const encoded = encodeSharedOutfit(
    customOccOutfits[0],
    'Mein Sonntags-Look',
    {
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      customOccasionId: 'custom_brunch',
      lockedGarmentIds: [],
    },
    'Sonntags-Brunch'
  );
  const decoded = decodeSharedOutfit(encoded);
  assert.ok(decoded !== null, 'Should decode shared outfit payload');
  assert.equal(decoded?.title, 'Mein Sonntags-Look');
  assert.equal(decoded?.customOccasionName, 'Sonntags-Brunch');
  assert.equal(decoded?.garments.length, customOccOutfits[0].items.length);

  const shopUrl = buildBrandOrShopUrl(decoded!.garments[0]);
  assert.ok(shopUrl.startsWith('https://'), 'Should generate valid https shop URL');
});

test('outfitShare & shopAffiliate: buildBrandOrShopUrl, appendAffiliateParam, and isExampleGarment', () => {
  // 1) isExampleGarment
  assert.equal(isExampleGarment({ id: 'seed_top_1' }), true, 'seed_ is example');
  assert.equal(isExampleGarment({ id: 'fem_top_1' }), true, 'fem_ is example');
  assert.equal(isExampleGarment({ id: 'uni_top_1' }), true, 'uni_ is example');
  assert.equal(isExampleGarment({ id: 'arch_navy_blazer' }), true, 'arch_ is example');
  assert.equal(isExampleGarment({ id: 'custom_user_piece_123' }), false, 'custom user piece is NOT example');
  assert.equal(
    isExampleGarment({ id: 'custom_user_piece_123', buyUrl: 'https://shop.com/shirt' }),
    true,
    'custom piece with buyUrl is considered linkable'
  );

  // 2) appendAffiliateParam (including shorthand Amazon PartnerNet tag without "tag=")
  assert.equal(
    appendAffiliateParam('https://www.amazon.de/s?k=test', 'tag=partner-21'),
    'https://www.amazon.de/s?k=test&tag=partner-21'
  );
  assert.equal(
    appendAffiliateParam('https://www.amazon.de/s?k=test', 'partner-21'),
    'https://www.amazon.de/s?k=test&tag=partner-21',
    'Shorthand partner tag without "tag=" should automatically normalize to tag=partner-21'
  );
  assert.equal(
    appendAffiliateParam('https://amazon.de/dp/B123', 'tag=partner-21'),
    'https://amazon.de/dp/B123?tag=partner-21'
  );
  assert.equal(
    appendAffiliateParam('https://amazon.de/dp/B123?tag=partner-21', 'tag=partner-21'),
    'https://amazon.de/dp/B123?tag=partner-21',
    'Should not duplicate existing tag'
  );
  assert.equal(
    appendAffiliateParam('https://amazon.de/dp/B123', '?tag=partner-21'),
    'https://amazon.de/dp/B123?tag=partner-21',
    'Should trim leading ?'
  );

  // 3) buildBrandOrShopUrl defaults to Amazon.de and combines Brand + Type + Color + Fit + Texture + Herren/Damen
  const mensGarment = {
    id: 'seed_bot_2',
    name: 'Jeans Raw Indigo',
    brand: "Levi's",
    colorName: 'Raw Indigo',
    category: 'bottom' as const,
    subcategory: 'denim' as const,
    fit: 'slim' as const,
    texture: 'denim' as const,
  };

  const amazonMensUrl = buildBrandOrShopUrl(mensGarment, {
    affiliateParam: 'mypartner-21',
  });
  assert.ok(
    amazonMensUrl.startsWith('https://www.amazon.de/s?k='),
    'Should default to Amazon.de search URL'
  );
  assert.ok(amazonMensUrl.includes('tag=mypartner-21'), 'Should contain normalized affiliate tag');
  assert.ok(amazonMensUrl.includes(encodeURIComponent("Levi's")), 'Should include brand');
  assert.ok(amazonMensUrl.includes('Jeans'), 'Should include subcategory');
  assert.ok(amazonMensUrl.includes('Slim'), 'Should include fit');
  assert.ok(amazonMensUrl.includes('Herren'), 'Should include Herren for menswear seed item');

  // 4) Womenswear detection (via fem_ prefix or womenswear subcategory)
  const womensGarment = {
    id: 'fem_out_1',
    name: 'Trenchcoat Beige',
    brand: 'Mango',
    colorName: 'Sand / Beige',
    category: 'outerwear' as const,
    subcategory: 'trenchcoat' as const,
    texture: 'tech_waterproof' as const,
  };
  const amazonWomensUrl = buildBrandOrShopUrl(womensGarment, {
    affiliateParam: 'tag=mypartner-21',
  });
  assert.ok(amazonWomensUrl.includes('Mango'), 'Should include brand Mango');
  assert.ok(amazonWomensUrl.includes('Trenchcoat'), 'Should include Trenchcoat');
  assert.ok(amazonWomensUrl.includes('Damen'), 'Should include Damen for womenswear item');

  // 5) buildBrandOrShopUrl with direct buyUrl override
  const directGarment = {
    name: 'Chino Hose',
    colorName: 'Beige',
    subcategory: 'chino' as const,
    texture: 'twill_chino' as const,
    buyUrl: 'https://www.amazon.de/dp/B08XYZ1234',
  };
  const directAmazonUrl = buildBrandOrShopUrl(directGarment, {
    affiliateParam: 'mypartner-21',
  });
  assert.equal(directAmazonUrl, 'https://www.amazon.de/dp/B08XYZ1234?tag=mypartner-21');
  // 6) Archetype color consistency: Dunkelblaue Jeans is never Sand/Beige, Weiße Sneaker is always white/off-white, Dunkle Chino is always dark
  for (const undertone of ['neutral', 'warm', 'olive', 'cool'] as const) {
    for (const chromaLevel of ['muted', 'moderate', 'bright'] as const) {
      const candidates = instantiateCandidateArchetypes({
        ...DEFAULT_BIOMETRIC_PROFILE,
        undertone,
        chromaLevel,
      });
      const darkJeans = candidates.find((c) => c.archetypeId === 'arch_denim_dark_neutral_3');
      assert.ok(darkJeans, 'arch_denim_dark_neutral_3 should exist');
      assert.ok(
        darkJeans.garment.hsl.l <= 25 && !/sand|beige/i.test(darkJeans.garment.colorName),
        `Dunkelblaue Jeans should always be dark navy (${darkJeans.garment.colorName}, l=${darkJeans.garment.hsl.l})`
      );

      const whiteSneaker = candidates.find((c) => c.archetypeId === 'arch_sneaker_clean_neutral_0');
      assert.ok(whiteSneaker, 'arch_sneaker_clean_neutral_0 should exist');
      assert.ok(
        whiteSneaker.garment.hsl.l >= 85,
        `Schlichte Weiße Leder-Sneaker should always be light white/off-white (${whiteSneaker.garment.colorName}, l=${whiteSneaker.garment.hsl.l})`
      );

      const darkChino = candidates.find((c) => c.archetypeId === 'arch_chino_dark_neutral_2');
      assert.ok(darkChino, 'arch_chino_dark_neutral_2 should exist');
      assert.ok(
        darkChino.garment.hsl.l <= 30,
        `Dunkle Chino-Hose should always be a dark neutral (${darkChino.garment.colorName}, l=${darkChino.garment.hsl.l})`
      );
    }
  }

  // 7) Sandbox / virtual garments are recognized as example garments for shop links
  assert.equal(isExampleGarment({ id: 'sandbox_arch_denim_dark_neutral_3' }), true);
  assert.equal(isExampleGarment({ id: 'custom_123', isWishlistSandbox: true }), true);
  assert.equal(isExampleGarment({ id: 'custom_123', isWishlistSandbox: false }), false);

  // 8) No color preset has meta "(Test)" suffix in its display name
  for (const preset of TEXTILE_COLOR_PRESETS) {
    assert.ok(
      !preset.name.includes('(Test)'),
      `Color preset "${preset.name}" should not contain "(Test)"`
    );
  }
});

test('i18n & gapCacheKey: central dictionary parity, parameter interpolation, and structural fingerprint stability', () => {
  // 1) Every DE message key exists in EN and is non-empty
  const deKeys = Object.keys(DE_MESSAGES);
  const enKeys = Object.keys(EN_MESSAGES);
  assert.deepEqual(deKeys, enKeys, 'DE and EN message dictionaries must have identical keys');

  for (const key of deKeys as Array<keyof typeof DE_MESSAGES>) {
    assert.ok(DE_MESSAGES[key].trim().length > 0, `DE message "${key}" must not be empty`);
    assert.ok(EN_MESSAGES[key].trim().length > 0, `EN message "${key}" must not be empty`);
  }

  // 2) Translator interpolates {count} properly in both locales
  const tDe = createTranslator('de');
  const tEn = createTranslator('en');
  assert.equal(tDe('nav.closet', { count: 14 }), 'Kleiderschrank (14)');
  assert.equal(tEn('nav.closet', { count: 14 }), 'My Closet (14)');
  assert.equal(tCategory('de', 'base_top'), 'T-Shirts, Hemden & Tops');
  assert.equal(tCategory('en', 'base_top'), 'T-Shirts, Shirts & Tops');
  assert.equal(tOccasion('en', 'smart_casual_office'), 'Office & Smart Casual');
  assert.equal(tWeather('de', 'rain_wet'), 'Regen / Nass');

  // 3) Structural gap key ignores wearCount, lastWornDate, isClean, favoriteOutfits, customOutfitNames
  const baseKey = computeGapStructuralKey(SEED_WARDROBE_GARMENTS, DEFAULT_BIOMETRIC_PROFILE);
  const wornAndDirtyGarments = SEED_WARDROBE_GARMENTS.map((g, idx) =>
    idx === 0
      ? {
          ...g,
          wearCount: (g.wearCount || 0) + 5,
          lastWornDate: '2026-11-04T10:00:00.000Z',
          isClean: false,
        }
      : g
  );
  const profileWithFavorites: BiometricProfile = {
    ...DEFAULT_BIOMETRIC_PROFILE,
    customOutfitNames: { sig_1: 'Lieblings-Büro-Look' },
    favoriteOutfits: [
      {
        id: 'fav_1',
        title: 'Lieblings-Büro-Look',
        garmentIds: [SEED_WARDROBE_GARMENTS[0].id],
        garments: [SEED_WARDROBE_GARMENTS[0]],
        savedAt: '2026-11-04T10:00:00.000Z',
      },
    ],
  };
  const afterWearKey = computeGapStructuralKey(wornAndDirtyGarments, profileWithFavorites);
  assert.equal(
    baseKey,
    afterWearKey,
    'Wear count, laundry status, and favorite outfit changes must not invalidate the gap analysis structural cache key'
  );

  // 4) Structural gap key changes when a garment color or biometric undertone changes
  const recoloredGarments = SEED_WARDROBE_GARMENTS.map((g, idx) =>
    idx === 0 ? { ...g, colorHex: '#112233' } : g
  );
  assert.notEqual(
    baseKey,
    computeGapStructuralKey(recoloredGarments, DEFAULT_BIOMETRIC_PROFILE),
    'Changing garment colorHex must invalidate the structural cache key'
  );
  assert.notEqual(
    baseKey,
    computeGapStructuralKey(SEED_WARDROBE_GARMENTS, {
      ...DEFAULT_BIOMETRIC_PROFILE,
      undertone: 'cool',
    }),
    'Changing biometric undertone must invalidate the structural cache key'
  );
});

test('getActiveWornOutfits: pins chosen outfits across weather/context changes for 24h default, configurable hours, or until dismissed', () => {
  const nowMs = new Date('2026-11-04T12:00:00.000Z').getTime();
  const sampleItems = SEED_WARDROBE_GARMENTS.slice(0, 3);
  const recentRecord = {
    id: 'worn_recent_2h',
    wornDate: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
    outfitTitle: 'Mein Tages-Look',
    garmentIds: sampleItems.map((g) => g.id),
    dirtyMarkedGarmentIds: [sampleItems[0].id],
    garments: sampleItems,
  };
  const olderRecord30h = {
    id: 'worn_older_30h',
    wornDate: new Date(nowMs - 30 * 3600 * 1000).toISOString(),
    outfitTitle: 'Gestriger Look',
    garmentIds: SEED_WARDROBE_GARMENTS.slice(1, 4).map((g) => g.id),
    garments: SEED_WARDROBE_GARMENTS.slice(1, 4),
  };

  const context = {
    temperatureC: 18,
    weather: 'sunny_dry' as const,
    occasion: 'casual' as const,
    lockedGarmentIds: [],
  };

  // 1) Default 24h retention keeps 2h-old record and filters out 30h-old record
  const defaultActive = getActiveWornOutfits(
    [recentRecord, olderRecord30h],
    SEED_WARDROBE_GARMENTS,
    DEFAULT_BIOMETRIC_PROFILE,
    context,
    nowMs
  );
  assert.equal(defaultActive.length, 1);
  assert.equal(defaultActive[0].recordId, 'worn_recent_2h');
  assert.equal(defaultActive[0].remainingHours, 22);

  // 2) Configurable 48h retention includes both 2h and 30h records
  const active48h = getActiveWornOutfits(
    [recentRecord, olderRecord30h],
    SEED_WARDROBE_GARMENTS,
    { ...DEFAULT_BIOMETRIC_PROFILE, wornOutfitRetentionHours: 48 },
    context,
    nowMs
  );
  assert.equal(active48h.length, 2);

  // 3) Configurable 0h ("Until dismissed") keeps records regardless of age
  const activeUntilDismissed = getActiveWornOutfits(
    [olderRecord30h],
    SEED_WARDROBE_GARMENTS,
    { ...DEFAULT_BIOMETRIC_PROFILE, wornOutfitRetentionHours: 0 },
    context,
    nowMs
  );
  assert.equal(activeUntilDismissed.length, 1);
  assert.equal(activeUntilDismissed[0].remainingHours, undefined);

  // 4) Dismissing a record removes it from pinned active outfits
  const afterDismiss = getActiveWornOutfits(
    [recentRecord, olderRecord30h],
    SEED_WARDROBE_GARMENTS,
    {
      ...DEFAULT_BIOMETRIC_PROFILE,
      wornOutfitRetentionHours: 48,
      dismissedWornRecordIds: ['worn_recent_2h'],
    },
    context,
    nowMs
  );
  assert.equal(afterDismiss.length, 1);
  assert.equal(afterDismiss[0].recordId, 'worn_older_30h');
});

test('travelPacker: generates 7-day travel capsule with 2 bottoms and 7 cross-compatible daily outfits across luggage space & trip types', async () => {
  const { computeTravelCategoryTargets, generateTravelCapsule } = await import(
    './travelPacker'
  );

  // 1) Verify 7-day targets in minimal (Handgepäck) and balanced (Normaler Koffer) use 2 bottoms & 2 shoes
  const minimal7 = computeTravelCategoryTargets(7, 'minimal', 20, 'sunny_dry');
  assert.equal(minimal7.bottoms, 2, '7-day Handgepäck should target 2 bottoms');
  assert.equal(minimal7.footwear, 2, '7-day Handgepäck should target 2 shoes');

  const balanced7 = computeTravelCategoryTargets(7, 'balanced', 20, 'sunny_dry');
  assert.equal(balanced7.bottoms, 2, '7-day Normaler Koffer should target 2 bottoms');
  assert.equal(balanced7.footwear, 2, '7-day Normaler Koffer should target 2 shoes');

  const spacious7 = computeTravelCategoryTargets(7, 'spacious', 20, 'sunny_dry');
  assert.ok(spacious7.bottoms >= 3, '7-day Viel Platz should allow >= 3 bottoms');
  assert.ok(spacious7.baseTops > minimal7.baseTops, 'Spacious should pack more tops than minimal');

  // 2) Generate 7-day city trip capsule with balanced luggage + evening look
  const plan7 = generateTravelCapsule(SEED_WARDROBE_GARMENTS, DEFAULT_BIOMETRIC_PROFILE, {
    days: 7,
    luggageSpace: 'balanced',
    tripType: 'city_trip',
    temperatureC: 18,
    weather: 'sunny_dry',
    includeEveningLook: true,
    lockedGarmentIds: [],
  });

  assert.equal(plan7.dailyOutfits.length, 7, 'Should generate 7 daily outfits for a 7-day trip');
  assert.equal(plan7.packedByCategory.bottom.length, 2, '7-day balanced capsule should pack 2 bottoms');

  // Verify every daily outfit only uses items from packedGarments
  const packedIdSet = new Set(plan7.packedGarments.map((g) => g.id));
  for (const dayPlan of plan7.dailyOutfits) {
    assert.ok(dayPlan.outfit.items.length >= 3, `Day ${dayPlan.dayNumber} must have a complete outfit`);
    for (const item of dayPlan.outfit.items) {
      assert.ok(
        packedIdSet.has(item.id),
        `Day ${dayPlan.dayNumber} item ${item.name} must be included in the suitcase packing list`
      );
    }
  }

  // Verify bottom rotation: consecutive days should rotate between the 2 packed bottoms
  const day1BottomId = plan7.dailyOutfits[0].outfit.items.find((i) => i.category === 'bottom')?.id;
  const day2BottomId = plan7.dailyOutfits[1].outfit.items.find((i) => i.category === 'bottom')?.id;
  assert.notEqual(day1BottomId, day2BottomId, 'Day 1 and Day 2 should rotate between the 2 packed bottoms');

  // Verify evening highlight look is scheduled on Day 3
  assert.equal(plan7.dailyOutfits[2].occasion, 'date_night');

  // 3) Business trip vs Beach vacation produce distinct capsules
  const businessPlan = generateTravelCapsule(SEED_WARDROBE_GARMENTS, DEFAULT_BIOMETRIC_PROFILE, {
    days: 5,
    luggageSpace: 'minimal',
    tripType: 'business_trip',
    temperatureC: 18,
    weather: 'sunny_dry',
    includeEveningLook: false,
    lockedGarmentIds: [],
  });
  const beachPlan = generateTravelCapsule(SEED_WARDROBE_GARMENTS, DEFAULT_BIOMETRIC_PROFILE, {
    days: 5,
    luggageSpace: 'minimal',
    tripType: 'beach_sun',
    temperatureC: 26,
    weather: 'sunny_dry',
    includeEveningLook: false,
    lockedGarmentIds: [],
  });
  assert.equal(businessPlan.dailyOutfits.length, 5);
  assert.equal(beachPlan.dailyOutfits.length, 5);
  assert.notDeepEqual(
    businessPlan.packedGarments.map((g) => g.id),
    beachPlan.packedGarments.map((g) => g.id),
    'Business trip and beach vacation should pack different capsules'
  );
});

test('upperLayerToggle: resolves Komplett, Ohne Jacke, Drunter (underneath) and Offen/Geschlossen states accurately', async () => {
  const {
    computeHiddenIdsForPreset,
    getOutfitUpperLayers,
    isGarmentOpenable,
    resolveUpperLayerState,
  } = await import('../components/OutfitLayerStack');

  const baseTop = SEED_WARDROBE_GARMENTS.find((g) => g.id === 'seed_top_1')!; // T-Shirt Salbeigrün
  const midLayer = SEED_WARDROBE_GARMENTS.find((g) => g.id === 'seed_mid_1')!; // Hemdjacke Olivgrün (overshirt)
  const outerwear = SEED_WARDROBE_GARMENTS.find((g) => g.category === 'outerwear')!;
  const bottom = SEED_WARDROBE_GARMENTS.find((g) => g.category === 'bottom')!;
  const shoe = SEED_WARDROBE_GARMENTS.find((g) => g.category === 'footwear')!;

  const sampleItems = [baseTop, midLayer, outerwear, bottom, shoe];

  // 1) Breakdown detects all 3 upper layers
  const breakdown = getOutfitUpperLayers(sampleItems);
  assert.equal(breakdown.hasMultipleUpperLayers, true);
  assert.equal(breakdown.upperLayers.length, 3);
  assert.equal(isGarmentOpenable(midLayer), true, 'Overshirt must be openable');
  assert.equal(isGarmentOpenable(outerwear), true, 'Outerwear must be openable');
  assert.equal(isGarmentOpenable(baseTop), false, 'Heavyweight tee is not openable');

  // 2) Default state ('all' / Komplett): all 3 upper layers visible
  const stateAll = resolveUpperLayerState(sampleItems, [], {});
  assert.equal(stateAll.activePreset, 'all');
  assert.equal(stateAll.showBaseTop, true);
  assert.equal(stateAll.showMidLayer, true);
  assert.equal(stateAll.showOuterwear, true);
  assert.equal(stateAll.topmostVisibleLayer?.id, outerwear.id);

  // 3) 'no_outerwear' (Ohne Jacke): hides jacket, reveals midLayer over baseTop
  const noJacketIds = computeHiddenIdsForPreset(sampleItems, 'no_outerwear');
  const stateNoJacket = resolveUpperLayerState(sampleItems, noJacketIds, {});
  assert.equal(stateNoJacket.activePreset, 'no_outerwear');
  assert.equal(stateNoJacket.showOuterwear, false);
  assert.equal(stateNoJacket.showMidLayer, true);
  assert.equal(stateNoJacket.showBaseTop, true);
  assert.equal(stateNoJacket.topmostVisibleLayer?.id, midLayer.id);
  assert.equal(stateNoJacket.underneathLayer?.id, baseTop.id);

  // 4) 'base_only' (Drunter): hides outerwear & midLayer so only baseTop is shown with bottom & shoes
  const baseOnlyIds = computeHiddenIdsForPreset(sampleItems, 'base_only');
  const stateBaseOnly = resolveUpperLayerState(sampleItems, baseOnlyIds, {});
  assert.equal(stateBaseOnly.activePreset, 'base_only');
  assert.equal(stateBaseOnly.showOuterwear, false);
  assert.equal(stateBaseOnly.showMidLayer, false);
  assert.equal(stateBaseOnly.showBaseTop, true);
  assert.equal(stateBaseOnly.topmostVisibleLayer?.id, baseTop.id);

  // 5) Open/Closed override toggles midLayer between open and closed
  const stateMidClosed = resolveUpperLayerState(sampleItems, noJacketIds, {
    [midLayer.id]: false,
  });
  assert.equal(stateMidClosed.isMidLayerOpen, false);
  const stateMidOpen = resolveUpperLayerState(sampleItems, noJacketIds, {
    [midLayer.id]: true,
  });
  assert.equal(stateMidOpen.isMidLayerOpen, true);
});

test('variationSeed: produces high outfit variance across consecutive shuffle clicks even within strict occasions', () => {
  const occasions = ['casual', 'smart_casual_office', 'city_cafe', 'date_night'] as const;

  for (const occasion of occasions) {
    const batch0 = generateOutfitsForContext(
      SEED_WARDROBE_GARMENTS,
      DEFAULT_BIOMETRIC_PROFILE,
      {
        temperatureC: 18,
        weather: 'sunny_dry',
        occasion,
        lockedGarmentIds: [],
        variationSeed: 0,
      },
      3
    );
    const batch1 = generateOutfitsForContext(
      SEED_WARDROBE_GARMENTS,
      DEFAULT_BIOMETRIC_PROFILE,
      {
        temperatureC: 18,
        weather: 'sunny_dry',
        occasion,
        lockedGarmentIds: [],
        variationSeed: 1,
      },
      3
    );
    const batch2 = generateOutfitsForContext(
      SEED_WARDROBE_GARMENTS,
      DEFAULT_BIOMETRIC_PROFILE,
      {
        temperatureC: 18,
        weather: 'sunny_dry',
        occasion,
        lockedGarmentIds: [],
        variationSeed: 2,
      },
      3
    );

    assert.equal(batch0.length, 3, `Occasion ${occasion} batch0 should have 3 outfits`);
    assert.equal(batch1.length, 3, `Occasion ${occasion} batch1 should have 3 outfits`);
    assert.equal(batch2.length, 3, `Occasion ${occasion} batch2 should have 3 outfits`);

    // Ensure the lead outfit changes on each click of "Neue Outfits"
    assert.notEqual(
      batch0[0].id,
      batch1[0].id,
      `Lead outfit for ${occasion} must change between seed 0 and seed 1`
    );
    assert.notEqual(
      batch1[0].id,
      batch2[0].id,
      `Lead outfit for ${occasion} must change between seed 1 and seed 2`
    );

    // Ensure at least 5 distinct outfits across the 3 batches of 3 (9 slots total)
    const uniqueOutfitIds = new Set([
      ...batch0.map((o) => o.id),
      ...batch1.map((o) => o.id),
      ...batch2.map((o) => o.id),
    ]);
    assert.ok(
      uniqueOutfitIds.size >= 5,
      `Occasion ${occasion} should surface at least 5 distinct outfits across 3 shuffle steps (got ${uniqueOutfitIds.size})`
    );
  }
});
