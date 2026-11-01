import {
  DEFAULT_BIOMETRIC_PROFILE,
  SEED_WARDROBE_GARMENTS,
} from '../data/seedData';
import {
  classifyColorTemp,
  deriveSeasonPalette,
  hexToHsl,
  scoreGarmentBiometrics,
} from '../engine/colorMath';
import { analyzeWardrobeGaps } from '../engine/gapAnalyzer';
import { generateOutfitsForContext } from '../engine/outfitGenerator';
import { parseAndNormalizeWardrobeImport } from '../engine/wardrobeFormatter';
import {
  BiometricProfile,
  Garment,
  OccasionType,
  WeatherCondition,
} from '../types/wardrobe';

export interface WardrobeStateStore {
  getState: () => Promise<{ profile: BiometricProfile; garments: Garment[] }>;
  setState: (next: { profile: BiometricProfile; garments: Garment[] }) => Promise<void>;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export const MCP_TOOLS_MANIFEST = [
  {
    name: 'list_garments',
    description:
      'Listet alle Kleidungsstücke im Schrank inkl. berechnetem Biometrie-Score, HSL-Werten, Waschstatus und Outfit-Einbindung auf.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['base_top', 'mid_layer', 'outerwear', 'bottom', 'footwear'],
          description: 'Optionaler Filter nach Kategorie',
        },
        onlyClean: {
          type: 'boolean',
          description: 'Wenn true, werden nur frisch gewaschene Teile zurückgegeben',
        },
      },
    },
  },
  {
    name: 'add_garment',
    description:
      'Legt ein neues Kleidungsstück im Kleiderschrank an. HSL-Farbraum, Farbtemperatur (warm/cool/neutral) und Biometrie-Score werden deterministisch berechnet.',
    inputSchema: {
      type: 'object',
      required: ['name', 'subcategory', 'colorName', 'colorHex'],
      properties: {
        name: { type: 'string', description: 'Bezeichnung, z.B. "Merino Pullover Salbeigrün"' },
        category: {
          type: 'string',
          enum: ['base_top', 'mid_layer', 'outerwear', 'bottom', 'footwear'],
        },
        subcategory: {
          type: 'string',
          enum: [
            't_shirt',
            'heavyweight_tee',
            'polo',
            'longsleeve',
            'overshirt',
            'button_down_shirt',
            'crewneck_sweater',
            'knit_sweater',
            'turtleneck',
            'hoodie',
            'cardigan',
            'light_jacket',
            'coat',
            'parka',
            'blouson',
            'chino',
            'denim',
            'trousers',
            'cargo',
            'shorts',
            'sneaker_clean',
            'sneaker_chunky',
            'boots',
            'loafer_derby',
            'runner',
          ],
        },
        colorName: { type: 'string', description: 'Farbname, z.B. "Salbeigrün"' },
        colorHex: { type: 'string', description: '6-stelliger Hex-Code, z.B. "#8F9779"' },
        fit: {
          type: 'string',
          enum: ['slim', 'regular', 'relaxed', 'boxy_oversized'],
          default: 'regular',
        },
        neckline: {
          type: 'string',
          enum: [
            'crewneck',
            'heavy_crewneck',
            'v_neck',
            'stand_collar',
            'shirt_collar',
            'turtleneck',
            'hooded',
            'none',
          ],
        },
        texture: {
          type: 'string',
          enum: [
            'smooth_cotton',
            'heavy_jersey',
            'twill_chino',
            'denim',
            'chunky_knit',
            'fine_knit',
            'flannel_wool',
            'linen',
            'tech_waterproof',
            'leather_suede',
          ],
          default: 'smooth_cotton',
        },
        thermalRating: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: '1 (>24°C) bis 5 (<5°C)',
        },
        formality: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: '1 (Sport) bis 5 (Formal)',
        },
        waterResistant: { type: 'boolean', default: false },
        isClean: { type: 'boolean', default: true },
        isWishlistSandbox: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'add_garments_bulk',
    description:
      'Fügt mehrere Kleidungsstücke gleichzeitig hinzu (z.B. nach Foto-Analyse oder Schrank-Inventur).',
    inputSchema: {
      type: 'object',
      required: ['garments'],
      properties: {
        garments: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array von Kleidungsstück-Objekten',
        },
        replaceExisting: {
          type: 'boolean',
          default: false,
          description: 'Wenn true, wird der bestehende Schrank ersetzt statt ergänzt',
        },
      },
    },
  },
  {
    name: 'update_garment',
    description:
      'Aktualisiert ein bestehendes Kleidungsstück anhand seiner ID (z.B. Waschstatus isClean, Farbe, Schnitt).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        colorName: { type: 'string' },
        colorHex: { type: 'string' },
        isClean: { type: 'boolean' },
        waterResistant: { type: 'boolean' },
        thermalRating: { type: 'number' },
        formality: { type: 'number' },
      },
    },
  },
  {
    name: 'delete_garment',
    description: 'Entfernt ein Kleidungsstück anhand seiner ID aus dem Kleiderschrank.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID des zu löschenden Kleidungsstücks' },
      },
    },
  },
  {
    name: 'get_biometric_profile',
    description:
      'Liest das Biometrie-Profil des Nutzers sowie den abgeleiteten 12-Jahreszeiten-Style-Passport (12 Power-Farben, 6 Core-Neutrals, 6 Avoid-Farben, Top-3-Kragenformen).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_biometric_profile',
    description:
      'Aktualisiert biometrische Parameter des Nutzers (undertone, contrastLevel, chromaLevel, valueLevel, eyeHex, hairHex, haircutStyle, facialHair).',
    inputSchema: {
      type: 'object',
      properties: {
        undertone: { type: 'string', enum: ['cool', 'warm', 'neutral', 'olive'] },
        contrastLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        chromaLevel: { type: 'string', enum: ['muted', 'moderate', 'bright'] },
        valueLevel: { type: 'string', enum: ['light', 'medium', 'dark'] },
        eyeColorName: { type: 'string' },
        eyeHex: { type: 'string' },
        hairColorName: { type: 'string' },
        hairHex: { type: 'string' },
        haircutStyle: {
          type: 'string',
          enum: [
            'short_fade_structured_top',
            'buzz_very_short',
            'medium_textured_flow',
            'long_hair',
          ],
        },
        facialHair: {
          type: 'string',
          enum: ['clean_shaven', 'stubble', 'short_beard', 'full_beard'],
        },
      },
    },
  },
  {
    name: 'generate_daily_outfits',
    description:
      'Berechnet deterministisch die Top-5-Outfits für Temperatur (°C), Wetter und Anlass inkl. deutschen Rule Traces.',
    inputSchema: {
      type: 'object',
      properties: {
        temperatureC: { type: 'number', default: 18 },
        weather: {
          type: 'string',
          enum: ['sunny_dry', 'cloudy_windy', 'rain_wet'],
          default: 'sunny_dry',
        },
        occasion: {
          type: 'string',
          enum: [
            'casual',
            'smart_casual_office',
            'active_sporty',
            'date_night',
            'formal_event',
          ],
          default: 'casual',
        },
        lockedGarmentIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optionale IDs von 1-2 Kleidungsstücken, die im Outfit vorkommen müssen',
        },
      },
    },
  },
  {
    name: 'analyze_wardrobe_gaps',
    description:
      'Führt den kombinatorischen Graphen-Algorithmus aus: Erkennt isolierte Schrankleichen (Orphan Pieces), Temperatur-/Anlass-Engpässe und berechnet die Top 5 High-ROI Shopping-Empfehlungen.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Handles any MCP JSON-RPC 2.0 request deterministically against the provided WardrobeStateStore.
 */
export async function handleMcpJsonRpcRequest(
  request: JsonRpcRequest,
  store: WardrobeStateStore
): Promise<JsonRpcResponse | null> {
  const id = request.id !== undefined ? request.id : null;

  try {
    switch (request.method) {
      case 'notifications/initialized':
      case 'initialized':
        // Notifications do not return a response in JSON-RPC
        if (request.id === undefined) return null;
        return { jsonrpc: '2.0', id, result: {} };

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
            },
            serverInfo: {
              name: 'atelier-biometric-wardrobe-mcp',
              version: '1.0.0',
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS_MANIFEST,
          },
        };

      case 'resources/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: [
              {
                uri: 'wardrobe://inventory',
                name: 'Komplettes Kleiderschrank-Inventar & Biometrie-Scores',
                mimeType: 'application/json',
              },
              {
                uri: 'wardrobe://profile-and-palette',
                name: 'Biometrisches Profil & 12-Jahreszeiten-Farbpalette',
                mimeType: 'application/json',
              },
              {
                uri: 'wardrobe://gap-report',
                name: 'Kombinatorischer Gap-Analyzer & ROI-Empfehlungen',
                mimeType: 'application/json',
              },
            ],
          },
        };

      case 'resources/read': {
        const uri = String(request.params?.uri || '');
        const state = await store.getState();
        if (uri === 'wardrobe://profile-and-palette') {
          const palette = deriveSeasonPalette(state.profile);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ profile: state.profile, palette }, null, 2),
                },
              ],
            },
          };
        }
        if (uri === 'wardrobe://gap-report') {
          const report = analyzeWardrobeGaps(state.garments, state.profile);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(report, null, 2),
                },
              ],
            },
          };
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri: 'wardrobe://inventory',
                mimeType: 'application/json',
                text: JSON.stringify(state.garments, null, 2),
              },
            ],
          },
        };
      }

      case 'tools/call': {
        const toolName = String(request.params?.name || '');
        const args = (request.params?.arguments || {}) as Record<string, unknown>;
        const state = await store.getState();

        if (toolName === 'list_garments') {
          let list = state.garments;
          if (typeof args.category === 'string') {
            list = list.filter((g) => g.category === args.category);
          }
          if (args.onlyClean === true) {
            list = list.filter((g) => g.isClean);
          }
          const enriched = list.map((g) => ({
            ...g,
            biometricMatch: scoreGarmentBiometrics(g, state.profile),
          }));
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { count: enriched.length, garments: enriched },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        if (toolName === 'add_garment') {
          const parsed = parseAndNormalizeWardrobeImport(JSON.stringify([args]));
          if (!parsed.ok || parsed.garments.length === 0) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [
                  {
                    type: 'text',
                    text: parsed.error || 'Kleidungsstück konnte nicht validiert werden.',
                  },
                ],
              },
            };
          }
          const created = parsed.garments[0];
          const bio = scoreGarmentBiometrics(created, state.profile);
          const nextGarments = [created, ...state.garments];
          await store.setState({ profile: state.profile, garments: nextGarments });

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      status: 'created',
                      garment: created,
                      biometricScore: bio.score,
                      biometricReasons: bio.reasons,
                      totalWardrobeCount: nextGarments.length,
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        if (toolName === 'add_garments_bulk') {
          const rawArray = Array.isArray(args.garments) ? args.garments : [];
          const parsed = parseAndNormalizeWardrobeImport(JSON.stringify(rawArray));
          if (!parsed.ok || parsed.garments.length === 0) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [
                  {
                    type: 'text',
                    text: parsed.error || 'Keine gültigen Kleidungsstücke übergeben.',
                  },
                ],
              },
            };
          }
          const replaceExisting = Boolean(args.replaceExisting);
          const nextGarments = replaceExisting
            ? parsed.garments
            : [...parsed.garments, ...state.garments];
          await store.setState({ profile: state.profile, garments: nextGarments });

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      status: 'imported',
                      addedCount: parsed.garments.length,
                      totalWardrobeCount: nextGarments.length,
                      addedGarments: parsed.garments,
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        if (toolName === 'update_garment') {
          const targetId = String(args.id || '');
          const existing = state.garments.find((g) => g.id === targetId);
          if (!existing) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [
                  {
                    type: 'text',
                    text: `Kleidungsstück mit ID "${targetId}" nicht gefunden.`,
                  },
                ],
              },
            };
          }

          const nextHex =
            typeof args.colorHex === 'string' ? args.colorHex : existing.colorHex;
          const hsl = hexToHsl(nextHex);
          const colorTemp = classifyColorTemp(hsl);

          const updated: Garment = {
            ...existing,
            ...(typeof args.name === 'string' ? { name: args.name } : {}),
            ...(typeof args.colorName === 'string' ? { colorName: args.colorName } : {}),
            colorHex: nextHex,
            hsl,
            colorTemp,
            ...(typeof args.isClean === 'boolean' ? { isClean: args.isClean } : {}),
            ...(typeof args.waterResistant === 'boolean'
              ? { waterResistant: args.waterResistant }
              : {}),
            ...(typeof args.thermalRating === 'number'
              ? {
                  thermalRating: Math.max(
                    1,
                    Math.min(5, Math.round(args.thermalRating))
                  ) as 1 | 2 | 3 | 4 | 5,
                }
              : {}),
            ...(typeof args.formality === 'number'
              ? {
                  formality: Math.max(
                    1,
                    Math.min(5, Math.round(args.formality))
                  ) as 1 | 2 | 3 | 4 | 5,
                }
              : {}),
          };

          const nextGarments = state.garments.map((g) =>
            g.id === targetId ? updated : g
          );
          await store.setState({ profile: state.profile, garments: nextGarments });

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ status: 'updated', garment: updated }, null, 2),
                },
              ],
            },
          };
        }

        if (toolName === 'delete_garment') {
          const targetId = String(args.id || '');
          const nextGarments = state.garments.filter((g) => g.id !== targetId);
          await store.setState({ profile: state.profile, garments: nextGarments });
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      status: 'deleted',
                      deletedId: targetId,
                      totalWardrobeCount: nextGarments.length,
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        if (toolName === 'get_biometric_profile') {
          const palette = deriveSeasonPalette(state.profile);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { profile: state.profile, seasonPalette: palette },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        if (toolName === 'update_biometric_profile') {
          const nextProfile: BiometricProfile = {
            ...DEFAULT_BIOMETRIC_PROFILE,
            ...state.profile,
            ...(args as Partial<BiometricProfile>),
            id: 'default_profile',
          };
          await store.setState({ profile: nextProfile, garments: state.garments });
          const palette = deriveSeasonPalette(nextProfile);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      status: 'updated',
                      profile: nextProfile,
                      derivedSeason: palette.seasonName,
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        if (toolName === 'generate_daily_outfits') {
          const temperatureC =
            typeof args.temperatureC === 'number' ? args.temperatureC : 18;
          const weather = (args.weather as WeatherCondition) || 'sunny_dry';
          const occasion = (args.occasion as OccasionType) || 'casual';
          const lockedGarmentIds = Array.isArray(args.lockedGarmentIds)
            ? args.lockedGarmentIds.map(String)
            : [];

          const outfits = generateOutfitsForContext(
            state.garments,
            state.profile,
            { temperatureC, weather, occasion, lockedGarmentIds },
            5
          );
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ count: outfits.length, outfits }, null, 2),
                },
              ],
            },
          };
        }

        if (toolName === 'analyze_wardrobe_gaps') {
          const report = analyzeWardrobeGaps(state.garments, state.profile);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(report, null, 2),
                },
              ],
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unbekanntes MCP-Tool: ${toolName}`,
          },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Methode nicht unterstützt: ${request.method}`,
          },
        };
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: (err as Error).message || 'Interner MCP-Fehler',
      },
    };
  }
}

export function createDefaultWardrobeState() {
  return {
    profile: DEFAULT_BIOMETRIC_PROFILE,
    garments: SEED_WARDROBE_GARMENTS,
  };
}
