import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_BIOMETRIC_PROFILE,
  SEED_WARDROBE_GARMENTS,
  WARDROBE_PRESETS,
} from '../data/seedData';
import { classifyColorTemp, hexToHsl } from '../engine/colorMath';
import { BiometricProfile, Garment } from '../types/wardrobe';

const SEED_META_BY_ID = new Map(
  WARDROBE_PRESETS.combined_atelier.garments.map((g) => [g.id, { brand: g.brand, size: g.size }])
);

function backfillProfileAndGarments(
  rawProfile: BiometricProfile,
  rawGarments: Garment[]
): { profile: BiometricProfile; garments: Garment[] } {
  const profile: BiometricProfile = {
    ...DEFAULT_BIOMETRIC_PROFILE,
    ...rawProfile,
    defaultSizes: rawProfile.defaultSizes || DEFAULT_BIOMETRIC_PROFILE.defaultSizes,
    brandSizeRules:
      rawProfile.brandSizeRules && rawProfile.brandSizeRules.length > 0
        ? rawProfile.brandSizeRules
        : DEFAULT_BIOMETRIC_PROFILE.brandSizeRules,
  };

  const garments: Garment[] = rawGarments.map((g) => {
    const hsl = hexToHsl(g.colorHex || '#8F9779');
    const colorTemp = classifyColorTemp(hsl);
    const seedMeta = SEED_META_BY_ID.get(g.id);
    return {
      ...g,
      hsl,
      colorTemp,
      brand: g.brand ?? seedMeta?.brand,
      size: g.size ?? seedMeta?.size,
    };
  });

  return { profile, garments };
}

export class WardrobeDatabase extends Dexie {
  garments!: Table<Garment, string>;
  profiles!: Table<BiometricProfile, string>;

  constructor() {
    super('BiometricWardrobeDB');
    this.version(1).stores({
      garments: 'id, category, subcategory, colorTemp, isClean, isWishlistSandbox',
      profiles: 'id',
    });
  }
}

export const db = new WardrobeDatabase();

/**
 * Syncs the current browser wardrobe state to the local Express/MCP server store (/api/wardrobe)
 * so external LLMs connected via MCP always see the latest state.
 */
export async function syncStateToServer(
  profile: BiometricProfile,
  garments: Garment[]
): Promise<void> {
  try {
    await fetch('/api/wardrobe', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, garments }),
    });
  } catch {
    // Offline or standalone static mode — ignore silently
  }
}

/**
 * Pulls the latest wardrobe state from the local Express/MCP server (/api/wardrobe)
 * and updates IndexedDB so garments added via MCP immediately appear in the browser.
 */
export async function pullStateFromServer(): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
} | null> {
  try {
    const res = await fetch('/api/wardrobe');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.profile || !Array.isArray(data.garments)) return null;

    const { profile: enrichedProfile, garments: normalizedGarments } =
      backfillProfileAndGarments(data.profile, data.garments);

    try {
      await db.transaction('rw', db.garments, db.profiles, async () => {
        await db.garments.clear();
        await db.profiles.clear();
        await db.profiles.put(enrichedProfile);
        await db.garments.bulkPut(normalizedGarments);
      });
    } catch {
      // Ignore if IndexedDB restricted
    }

    return {
      profile: enrichedProfile,
      garments: normalizedGarments,
    };
  } catch {
    return null;
  }
}

/**
 * Initializes IndexedDB (and syncs from /api/wardrobe if available) with seed profile and 14-item starter wardrobe.
 */
export async function loadOrSeedWardrobeData(): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
}> {
  // First check if the local MCP server store has data
  const serverState = await pullStateFromServer();
  if (serverState && serverState.garments.length > 0) {
    return serverState;
  }

  try {
    const profileCount = await db.profiles.count();
    const garmentCount = await db.garments.count();

    if (profileCount === 0) {
      await db.profiles.put(DEFAULT_BIOMETRIC_PROFILE);
    }
    if (garmentCount === 0) {
      await db.garments.bulkPut(SEED_WARDROBE_GARMENTS);
    }

    const rawProfile = (await db.profiles.get('default_profile')) || DEFAULT_BIOMETRIC_PROFILE;
    const rawGarments = await db.garments.toArray();
    const result = backfillProfileAndGarments(
      rawProfile,
      rawGarments.length > 0 ? rawGarments : SEED_WARDROBE_GARMENTS
    );
    void syncStateToServer(result.profile, result.garments);
    return result;
  } catch {
    return {
      profile: DEFAULT_BIOMETRIC_PROFILE,
      garments: SEED_WARDROBE_GARMENTS,
    };
  }
}

export async function saveBiometricProfile(profile: BiometricProfile): Promise<void> {
  try {
    await db.profiles.put({ ...profile, id: 'default_profile' });
    const allGarments = await db.garments.toArray();
    void syncStateToServer(profile, allGarments);
  } catch {
    // Fallback silent if IndexedDB restricted
  }
}

export async function saveGarmentToDb(garment: Garment): Promise<Garment> {
  const hsl = hexToHsl(garment.colorHex);
  const colorTemp = classifyColorTemp(hsl);
  const enriched: Garment = {
    ...garment,
    hsl,
    colorTemp,
  };
  try {
    await db.garments.put(enriched);
    const profile = (await db.profiles.get('default_profile')) || DEFAULT_BIOMETRIC_PROFILE;
    const allGarments = await db.garments.toArray();
    void syncStateToServer(profile, allGarments);
  } catch {
    // Fallback silent
  }
  return enriched;
}

export async function bulkUpsertGarmentsToDb(garmentsToSave: Garment[]): Promise<Garment[]> {
  const enrichedList: Garment[] = garmentsToSave.map((g) => {
    const hsl = hexToHsl(g.colorHex);
    const colorTemp = classifyColorTemp(hsl);
    return {
      ...g,
      hsl,
      colorTemp,
    };
  });
  try {
    await db.garments.bulkPut(enrichedList);
    const profile = (await db.profiles.get('default_profile')) || DEFAULT_BIOMETRIC_PROFILE;
    const allGarments = await db.garments.toArray();
    void syncStateToServer(profile, allGarments);
  } catch {
    // Fallback silent
  }
  return enrichedList;
}

export async function deleteGarmentFromDb(id: string): Promise<void> {
  try {
    await db.garments.delete(id);
    const profile = (await db.profiles.get('default_profile')) || DEFAULT_BIOMETRIC_PROFILE;
    const allGarments = await db.garments.toArray();
    void syncStateToServer(profile, allGarments);
  } catch {
    // Fallback silent
  }
}

export async function updateGarmentsCleanStatus(ids: string[], isClean: boolean): Promise<void> {
  try {
    await db.transaction('rw', db.garments, async () => {
      for (const id of ids) {
        await db.garments.update(id, { isClean });
      }
    });
    const profile = (await db.profiles.get('default_profile')) || DEFAULT_BIOMETRIC_PROFILE;
    const allGarments = await db.garments.toArray();
    void syncStateToServer(profile, allGarments);
  } catch {
    // Fallback silent
  }
}

export async function resetDatabaseToSeed(): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
}> {
  try {
    await db.transaction('rw', db.garments, db.profiles, async () => {
      await db.garments.clear();
      await db.profiles.clear();
      await db.profiles.put(DEFAULT_BIOMETRIC_PROFILE);
      await db.garments.bulkPut(SEED_WARDROBE_GARMENTS);
    });
  } catch {
    // Ignore
  }
  void syncStateToServer(DEFAULT_BIOMETRIC_PROFILE, SEED_WARDROBE_GARMENTS);
  return {
    profile: DEFAULT_BIOMETRIC_PROFILE,
    garments: SEED_WARDROBE_GARMENTS,
  };
}

export interface WardrobeBackupPayload {
  version: number;
  exportedAt: string;
  profile: BiometricProfile;
  garments: Garment[];
}

export async function importWardrobeBackup(payload: WardrobeBackupPayload): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
}> {
  const normalizedProfile: BiometricProfile = {
    ...DEFAULT_BIOMETRIC_PROFILE,
    ...payload.profile,
    id: 'default_profile',
  };

  const normalizedGarments: Garment[] = (payload.garments || []).map((g) => {
    const hsl = hexToHsl(g.colorHex || '#8F9779');
    const colorTemp = classifyColorTemp(hsl);
    return {
      ...g,
      hsl,
      colorTemp,
    };
  });

  try {
    await db.transaction('rw', db.garments, db.profiles, async () => {
      await db.garments.clear();
      await db.profiles.clear();
      await db.profiles.put(normalizedProfile);
      await db.garments.bulkPut(normalizedGarments);
    });
  } catch {
    // Ignore
  }

  void syncStateToServer(normalizedProfile, normalizedGarments);

  return {
    profile: normalizedProfile,
    garments: normalizedGarments,
  };
}
