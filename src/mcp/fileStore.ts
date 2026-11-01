import fs from 'fs/promises';
import path from 'path';
import { createDefaultWardrobeState, WardrobeStateStore } from './mcpHandler';
import { BiometricProfile, Garment } from '../types/wardrobe';

export interface PersistedWardrobeFile {
  version: number;
  updatedAt: string;
  profile: BiometricProfile;
  garments: Garment[];
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
      };
    },
    setState: async (next: { profile: BiometricProfile; garments: Garment[] }) => {
      const payload: PersistedWardrobeFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        profile: next.profile,
        garments: next.garments,
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
