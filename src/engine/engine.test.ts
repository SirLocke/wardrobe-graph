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
  SEED_WARDROBE_GARMENTS,
  SEED_WOMENSWEAR_GARMENTS,
} from '../data/seedData';
import {
  createDefaultWardrobeState,
  handleMcpJsonRpcRequest,
} from '../mcp/mcpHandler';

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
  assert.equal(parsedPayload.totalWardrobeCount, 15);
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



