import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_BIOMETRIC_PROFILE,
  loadCustomColors,
  SAMPLE_WORN_HISTORY,
  saveCustomColors,
  SEED_WARDROBE_GARMENTS,
  WARDROBE_PRESETS,
} from '../data/seedData';
import { classifyColorTemp, hexToHsl } from '../engine/colorMath';
import { inferColorFromGarmentName, resolveGermanColorNameToHex } from '../engine/colorNaming';
import { BiometricProfile, Garment, WornOutfitRecord } from '../types/wardrobe';

const SEED_META_BY_ID = new Map(
  WARDROBE_PRESETS.combined_atelier.garments.map((g) => [
    g.id,
    { name: g.name, brand: g.brand, size: g.size },
  ])
);

function backfillProfileAndGarments(
  rawProfile: BiometricProfile,
  rawGarments: Garment[]
): { profile: BiometricProfile; garments: Garment[] } {
  const mergedCustomColors = loadCustomColors(rawProfile);
  if (mergedCustomColors.length > 0) {
    saveCustomColors(mergedCustomColors);
  }

  const profile: BiometricProfile = {
    ...DEFAULT_BIOMETRIC_PROFILE,
    ...rawProfile,
    defaultSizes: rawProfile.defaultSizes || DEFAULT_BIOMETRIC_PROFILE.defaultSizes,
    brandSizeRules:
      rawProfile.brandSizeRules && rawProfile.brandSizeRules.length > 0
        ? rawProfile.brandSizeRules
        : DEFAULT_BIOMETRIC_PROFILE.brandSizeRules,
    customColors: mergedCustomColors.length > 0 ? mergedCustomColors : rawProfile.customColors,
  };

  const garments: Garment[] = rawGarments.map((g) => {
    let category = g.category;
    let subcategory = g.subcategory;

    // Migrate button_down_shirt & short_sleeve_shirt to base_top
    if (subcategory === 'button_down_shirt' || subcategory === 'short_sleeve_shirt') {
      category = 'base_top';
    }

    // Migrate legacy cap_beanie into distinct 'cap' vs 'beanie'
    if (subcategory === 'cap_beanie') {
      const lowerName = (g.name || '').toLowerCase();
      if (lowerName.includes('cap') || lowerName.includes('kappe') || lowerName.includes('cappy') || lowerName.includes('basecap')) {
        subcategory = 'cap';
      } else {
        subcategory = 'beanie';
      }
    }

    // Repair garment color if it was saved with default Salbeigrün (#8F9779) while the garment name or colorName specifies another color
    let colorHex = g.colorHex || '#8F9779';
    let colorName = g.colorName || 'Salbeigrün';
    if (
      colorHex.toUpperCase() === '#8F9779' &&
      !g.id.startsWith('seed_') &&
      !g.id.startsWith('fem_') &&
      !g.id.startsWith('uni_')
    ) {
      const inferredFromTitle = inferColorFromGarmentName(g.name || '');
      if (inferredFromTitle && inferredFromTitle.hex.toUpperCase() !== '#8F9779') {
        colorHex = inferredFromTitle.hex;
        colorName = inferredFromTitle.name;
      } else if (colorName && colorName.toLowerCase() !== 'salbeigrün') {
        const resolved = resolveGermanColorNameToHex(colorName);
        if (resolved) {
          colorHex = resolved;
        }
      }
    }

    const hsl = hexToHsl(colorHex);
    const colorTemp = classifyColorTemp(hsl);
    const seedMeta = SEED_META_BY_ID.get(g.id);
    return {
      ...g,
      category,
      subcategory,
      colorHex,
      colorName,
      name: seedMeta && g.id.startsWith('seed_acc_') ? seedMeta.name : g.name,
      hsl,
      colorTemp,
      brand: g.brand ?? seedMeta?.brand,
      size: g.size ?? seedMeta?.size,
      wearCount: g.wearCount ?? 0,
      lastWornDate: g.lastWornDate,
    };
  });

  // Ensure existing demo wardrobes also include the new short socks ('seed_acc_7')
  const hasSeedItems = garments.some((g) => g.id.startsWith('seed_'));
  const hasShortSocks = garments.some((g) => g.subcategory === 'socks_short');
  if (hasSeedItems && !hasShortSocks) {
    const shortSocksSeed = SEED_WARDROBE_GARMENTS.find((g) => g.id === 'seed_acc_7');
    if (shortSocksSeed) {
      garments.push(shortSocksSeed);
    }
  }

  return { profile, garments };
}

export class WardrobeDatabase extends Dexie {
  garments!: Table<Garment, string>;
  profiles!: Table<BiometricProfile, string>;
  wornHistory!: Table<WornOutfitRecord, string>;

  constructor() {
    super('BiometricWardrobeDB');
    this.version(1).stores({
      garments: 'id, category, subcategory, colorTemp, isClean, isWishlistSandbox',
      profiles: 'id',
    });
    this.version(2).stores({
      garments: 'id, category, subcategory, colorTemp, isClean, isWishlistSandbox, wearCount',
      profiles: 'id',
      wornHistory: 'id, wornDate',
    });
  }
}

export const db = new WardrobeDatabase();

export function isPublicClientOnly(): boolean {
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_PUBLIC_CLIENT_ONLY === 'true'
  ) {
    return true;
  }
  return false;
}

/**
 * Helper to determine if a garment is user-created (not part of the initial seed catalog)
 */
function isUserCustomGarment(g: Garment): boolean {
  return !g.id.startsWith('seed_') && !g.id.startsWith('fem_') && !g.id.startsWith('uni_');
}

/**
 * Syncs the current browser wardrobe state to the local Express/MCP server store (/api/wardrobe)
 * so external LLMs connected via MCP always see the latest state.
 */
export async function syncStateToServer(
  profile: BiometricProfile,
  garments: Garment[],
  wornHistory?: WornOutfitRecord[]
): Promise<void> {
  if (isPublicClientOnly()) return;
  try {
    const history =
      wornHistory !== undefined
        ? wornHistory
        : await db.wornHistory.toArray().catch(() => []);
    await fetch('/api/wardrobe', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, garments, wornHistory: history }),
    });
  } catch {
    // Offline or standalone static mode — ignore silently
  }
}

/**
 * Pulls the latest wardrobe state from the local Express/MCP server (/api/wardrobe)
 * and updates IndexedDB safely without overwriting user-entered data with demo/seed data.
 */
export async function pullStateFromServer(): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
  wornHistory?: WornOutfitRecord[];
} | null> {
  if (isPublicClientOnly()) return null;
  try {
    const res = await fetch('/api/wardrobe');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.profile || !Array.isArray(data.garments)) return null;

    // Check what local IndexedDB currently has before touching anything
    let localProfile: BiometricProfile | null = null;
    let localGarments: Garment[] = [];
    let localWornHistory: WornOutfitRecord[] = [];

    try {
      localProfile = (await db.profiles.get('default_profile')) || null;
      localGarments = await db.garments.toArray();
      localWornHistory = await db.wornHistory.toArray();
    } catch {
      // IndexedDB restricted or not available
    }

    const localHasUserData =
      (localProfile && localProfile.isDemoMode === false) ||
      localGarments.some(isUserCustomGarment);

    const serverIsDemoOnly =
      data.profile.isDemoMode !== false &&
      !data.garments.some((g: Garment) => isUserCustomGarment(g));

    // GUARD: If user has real custom data in the browser and the server only has demo/seed data,
    // NEVER overwrite the user's data! Instead, push the user's real data UP to the server.
    if (localHasUserData && serverIsDemoOnly && localProfile) {
      void syncStateToServer(localProfile, localGarments, localWornHistory);
      return {
        profile: localProfile,
        garments: localGarments,
        wornHistory: localWornHistory,
      };
    }

    const { profile: enrichedProfile, garments: normalizedGarments } =
      backfillProfileAndGarments(data.profile, data.garments);

    const incomingWornHistory: WornOutfitRecord[] = Array.isArray(data.wornHistory)
      ? data.wornHistory
      : [];

    try {
      await db.transaction('rw', db.garments, db.profiles, db.wornHistory, async () => {
        await db.garments.clear();
        await db.profiles.clear();
        await db.profiles.put(enrichedProfile);
        await db.garments.bulkPut(normalizedGarments);
        if (incomingWornHistory.length > 0) {
          await db.wornHistory.clear();
          await db.wornHistory.bulkPut(incomingWornHistory);
        }
      });
    } catch {
      // Ignore if IndexedDB restricted
    }

    return {
      profile: enrichedProfile,
      garments: normalizedGarments,
      wornHistory: incomingWornHistory.length > 0 ? incomingWornHistory : localWornHistory,
    };
  } catch {
    return null;
  }
}

/**
 * Initializes IndexedDB (and syncs from /api/wardrobe if available) with seed profile and starter wardrobe.
 * Respects isDemoMode === false so a user's own wardrobe (even if temporarily empty) is never overwritten by demo items.
 */
export async function loadOrSeedWardrobeData(): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
}> {
  // First check if IndexedDB already has real user data
  try {
    const rawProfile = await db.profiles.get('default_profile');
    const rawGarments = await db.garments.toArray();
    const hasLocalUserData =
      (rawProfile && rawProfile.isDemoMode === false) ||
      rawGarments.some(isUserCustomGarment);

    if (hasLocalUserData && rawProfile) {
      const migrated = backfillProfileAndGarments(rawProfile, rawGarments);
      await db.profiles.put(migrated.profile);
      await db.garments.bulkPut(migrated.garments);
      void syncStateToServer(migrated.profile, migrated.garments);
      return migrated;
    }
  } catch {
    // IndexedDB access issue, proceed to server
  }

  // Next check if the local MCP server store has data
  const serverState = await pullStateFromServer();
  if (
    serverState &&
    (serverState.garments.length > 0 || serverState.profile.isDemoMode === false)
  ) {
    return serverState;
  }

  try {
    const profileCount = await db.profiles.count();
    const garmentCount = await db.garments.count();

    if (profileCount === 0) {
      await db.profiles.put(DEFAULT_BIOMETRIC_PROFILE);
      if (garmentCount === 0) {
        await db.garments.bulkPut(SEED_WARDROBE_GARMENTS);
        try {
          const historyCount = await db.wornHistory.count();
          if (historyCount === 0) {
            await db.wornHistory.bulkPut(SAMPLE_WORN_HISTORY);
          }
        } catch {
          // ignore
        }
      }
    }

    const rawProfile = (await db.profiles.get('default_profile')) || DEFAULT_BIOMETRIC_PROFILE;
    const rawGarments = await db.garments.toArray();
    const shouldUseSeedFallback =
      rawGarments.length === 0 && rawProfile.isDemoMode !== false;

    const result = backfillProfileAndGarments(
      rawProfile,
      shouldUseSeedFallback ? SEED_WARDROBE_GARMENTS : rawGarments
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

export function enrichGarmentColor(garment: Garment): Garment {
  const hsl = hexToHsl(garment.colorHex);
  const colorTemp = classifyColorTemp(hsl);
  return {
    ...garment,
    hsl,
    colorTemp,
  };
}

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBackgroundServerSync(delayMs = 350): void {
  if (isPublicClientOnly()) return;
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    void (async () => {
      try {
        const profile = (await db.profiles.get('default_profile')) || DEFAULT_BIOMETRIC_PROFILE;
        const allGarments = await db.garments.toArray();
        const history = await db.wornHistory.orderBy('wornDate').reverse().toArray().catch(() => []);
        await syncStateToServer(profile, allGarments, history);
      } catch {
        // Ignore offline/restricted errors
      }
    })();
  }, delayMs);
}

export async function saveBiometricProfile(profile: BiometricProfile): Promise<void> {
  setTimeout(() => {
    void (async () => {
      try {
        await db.profiles.put({ ...profile, id: 'default_profile' });
        scheduleBackgroundServerSync();
      } catch {
        // Fallback silent if IndexedDB restricted
      }
    })();
  }, 16);
}

export async function saveGarmentToDb(garment: Garment): Promise<Garment> {
  const enriched = enrichGarmentColor(garment);
  setTimeout(() => {
    void (async () => {
      try {
        await db.garments.put(enriched);
        scheduleBackgroundServerSync();
      } catch {
        // Fallback silent
      }
    })();
  }, 16);
  return enriched;
}

export async function bulkUpsertGarmentsToDb(garmentsToSave: Garment[]): Promise<Garment[]> {
  const enrichedList: Garment[] = garmentsToSave.map((g) => enrichGarmentColor(g));
  setTimeout(() => {
    void (async () => {
      try {
        await db.garments.bulkPut(enrichedList);
        scheduleBackgroundServerSync();
      } catch {
        // Fallback silent
      }
    })();
  }, 16);
  return enrichedList;
}

export async function deleteGarmentFromDb(id: string): Promise<void> {
  setTimeout(() => {
    void (async () => {
      try {
        await db.garments.delete(id);
        scheduleBackgroundServerSync();
      } catch {
        // Fallback silent
      }
    })();
  }, 16);
}

export async function updateGarmentsCleanStatus(ids: string[], isClean: boolean): Promise<void> {
  setTimeout(() => {
    void (async () => {
      try {
        await db.transaction('rw', db.garments, async () => {
          for (const id of ids) {
            await db.garments.update(id, { isClean });
          }
        });
        scheduleBackgroundServerSync();
      } catch {
        // Fallback silent
      }
    })();
  }, 16);
}

export async function getWornHistoryFromDb(): Promise<WornOutfitRecord[]> {
  try {
    const list = await db.wornHistory.orderBy('wornDate').reverse().toArray();
    return list;
  } catch {
    return [];
  }
}

export async function logOutfitAsWornInDb(
  record: WornOutfitRecord,
  updatedGarments: Garment[]
): Promise<void> {
  setTimeout(() => {
    void (async () => {
      try {
        await db.transaction('rw', db.wornHistory, db.garments, async () => {
          await db.wornHistory.put(record);
          await db.garments.bulkPut(updatedGarments);
        });
        scheduleBackgroundServerSync();
      } catch {
        // Fallback silent
      }
    })();
  }, 16);
}

export async function deleteWornOutfitRecordFromDb(
  recordId: string,
  updatedGarments: Garment[]
): Promise<void> {
  setTimeout(() => {
    void (async () => {
      try {
        await db.transaction('rw', db.wornHistory, db.garments, async () => {
          await db.wornHistory.delete(recordId);
          await db.garments.bulkPut(updatedGarments);
        });
        scheduleBackgroundServerSync();
      } catch {
        // Fallback silent
      }
    })();
  }, 16);
}

export async function resetDatabaseToSeed(): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
  wornHistory: WornOutfitRecord[];
}> {
  try {
    await db.transaction('rw', db.garments, db.profiles, db.wornHistory, async () => {
      await db.garments.clear();
      await db.profiles.clear();
      await db.wornHistory.clear();
      await db.profiles.put(DEFAULT_BIOMETRIC_PROFILE);
      await db.garments.bulkPut(SEED_WARDROBE_GARMENTS);
      await db.wornHistory.bulkPut(SAMPLE_WORN_HISTORY);
    });
  } catch {
    // Ignore
  }
  void syncStateToServer(DEFAULT_BIOMETRIC_PROFILE, SEED_WARDROBE_GARMENTS, SAMPLE_WORN_HISTORY);
  return {
    profile: DEFAULT_BIOMETRIC_PROFILE,
    garments: SEED_WARDROBE_GARMENTS,
    wornHistory: SAMPLE_WORN_HISTORY,
  };
}

export interface WardrobeBackupPayload {
  version: number;
  exportedAt: string;
  profile: BiometricProfile;
  garments: Garment[];
  wornHistory?: WornOutfitRecord[];
}

export async function importWardrobeBackup(payload: WardrobeBackupPayload): Promise<{
  profile: BiometricProfile;
  garments: Garment[];
  wornHistory: WornOutfitRecord[];
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
      wearCount: g.wearCount ?? 0,
      lastWornDate: g.lastWornDate,
    };
  });

  const normalizedWornHistory: WornOutfitRecord[] = Array.isArray(payload.wornHistory)
    ? payload.wornHistory
    : [];

  try {
    await db.transaction('rw', db.garments, db.profiles, db.wornHistory, async () => {
      await db.garments.clear();
      await db.profiles.clear();
      await db.wornHistory.clear();
      await db.profiles.put(normalizedProfile);
      await db.garments.bulkPut(normalizedGarments);
      if (normalizedWornHistory.length > 0) {
        await db.wornHistory.bulkPut(normalizedWornHistory);
      }
    });
  } catch {
    // Ignore
  }

  void syncStateToServer(normalizedProfile, normalizedGarments, normalizedWornHistory);

  return {
    profile: normalizedProfile,
    garments: normalizedGarments,
    wornHistory: normalizedWornHistory,
  };
}
