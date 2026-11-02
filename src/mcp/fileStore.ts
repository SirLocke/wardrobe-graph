import fs from 'fs/promises';
import path from 'path';
import { createDefaultWardrobeState, WardrobeStateStore } from './mcpHandler';
import { BiometricProfile, Garment, WornOutfitRecord } from '../types/wardrobe';

export interface PersistedWardrobeFile {
  version: number;
  updatedAt: string;
  profile: BiometricProfile;
  garments: Garment[];
  wornHistory?: WornOutfitRecord[];
}

const DEFAULT_DATA_PATH = path.resolve(
  process.cwd(),
  process.env.WARDROBE_DATA_FILE || 'data/wardrobe-store.json'
);

export function createFileWardrobeStore(customFilePath?: string): WardrobeStateStore & {
  getFilePath: () => string;
  getFullPayload: () => Promise<PersistedWardrobeFile>;
} {
  const filePath = customFilePath || DEFAULT_DATA_PATH;

  async function ensureInitialized(): Promise<PersistedWardrobeFile> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedWardrobeFile>;
      if (parsed && parsed.profile && Array.isArray(parsed.garments)) {
        return {
          version: 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          profile: parsed.profile,
          garments: parsed.garments,
          wornHistory: Array.isArray(parsed.wornHistory) ? parsed.wornHistory : [],
        };
      }
    } catch {
      // File does not exist or is invalid; initialize with default seed
    }

    const seed = createDefaultWardrobeState();
    const initial: PersistedWardrobeFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: seed.profile,
      garments: seed.garments,
      wornHistory: [],
    };

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(initial, null, 2), 'utf-8');
    } catch {
      // Ignore write error if read-only fs
    }

    return initial;
  }

  return {
    getFilePath: () => filePath,
    getFullPayload: async () => {
      return ensureInitialized();
    },
    getState: async () => {
      const data = await ensureInitialized();
      return {
        profile: data.profile,
        garments: data.garments,
        wornHistory: data.wornHistory || [],
      };
    },
    setState: async (next: {
      profile: BiometricProfile;
      garments: Garment[];
      wornHistory?: WornOutfitRecord[];
    }) => {
      const current = await ensureInitialized();
      const payload: PersistedWardrobeFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        profile: next.profile,
        garments: next.garments,
        wornHistory:
          next.wornHistory !== undefined
            ? next.wornHistory
            : current.wornHistory || [],
      };
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      } catch {
        // Ignore if read-only fs
      }
    },
  };
}
