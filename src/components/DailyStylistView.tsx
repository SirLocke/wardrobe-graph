import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  Edit3,
  Heart,
  History,
  Info,
  Layers,
  LayoutGrid,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Unlock,
  Wand2,
  X,
} from 'lucide-react';
import {
  canGarmentUseLaundry,
  CATEGORY_LABELS,
  CATEGORY_LABELS_EN,
  DEFAULT_AUTO_LAUNDRY_SUBCATEGORIES,
  OCCASION_LABELS,
  OCCASION_LABELS_EN,
  OUTFIT_MODIFIER_META,
  PATTERN_LABELS,
  SUBCATEGORY_LABELS,
  TEXTURE_LABELS,
} from '../data/seedData';
import { getShortOutfitTitle } from '../engine/brandSizeMatcher';
import {
  generateOutfitsForContext,
  getEffectiveModifiers,
  resolveActiveCustomOccasion,
} from '../engine/outfitGenerator';
import {
  buildBrandOrShopUrl,
  decodeSharedOutfit,
  encodeSharedOutfit,
} from '../engine/outfitShare';
import {
  AppLocale,
  BiometricProfile,
  CustomOccasion,
  FavoriteOutfitRecord,
  Garment,
  GarmentCategory,
  GarmentSubcategory,
  GeneratedOutfit,
  OccasionType,
  OutfitContext,
  OutfitModifier,
  WeatherCondition,
  WornOutfitRecord,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';
import { OutfitLayerStack } from './OutfitLayerStack';
import { buildOutfitSignature } from './WardrobeStatsView';

interface DailyStylistViewProps {
  garments: Garment[];
  profile: BiometricProfile;
  context: OutfitContext;
  locale?: AppLocale;
  wornHistory?: WornOutfitRecord[];
  onChangeContext: (next: OutfitContext) => void;
  onLogOutfitWorn: (outfit: GeneratedOutfit, title: string) => Promise<WornOutfitRecord | void>;
  onDeleteWornRecord?: (recordId: string) => Promise<void>;
  onToggleFavoriteOutfit?: (fav: FavoriteOutfitRecord) => Promise<void>;
  onOpenStatsTab?: () => void;
  onWashAllGarments: () => Promise<void>;
  onOpenAddModal: () => void;
  onEditGarment?: (garment: Garment) => void;
  onOpenSetupWizard?: () => void;
  onOpenSettings?: () => void;
  onOpenProfileTab?: () => void;
  onUpdateProfile?: (nextProfile: BiometricProfile) => Promise<void>;
}

interface SessionWornEntry {
  outfit: GeneratedOutfit;
  recordId: string;
  outfitTitle: string;
  laundryCount: number;
  slotIndex: number;
}

const AUTO_LAUNDRY_GROUPS: Array<{
  id: string;
  labelDe: string;
  labelEn: string;
  subcategories: GarmentSubcategory[];
}> = [
  {
    id: 'tops',
    labelDe: 'T-Shirts & Tops',
    labelEn: 'T-Shirts & Tops',
    subcategories: [
      't_shirt',
      'heavyweight_tee',
      'longsleeve',
      'polo',
      'tank_camisole',
      'crop_top',
      'bodysuit',
    ],
  },
  {
    id: 'socks',
    labelDe: 'Socken',
    labelEn: 'Socks',
    subcategories: ['socks', 'socks_short'],
  },
  {
    id: 'shirts',
    labelDe: 'Hemden & Blusen',
    labelEn: 'Shirts & Blouses',
    subcategories: ['button_down_shirt', 'short_sleeve_shirt', 'blouse'],
  },
  {
    id: 'midlayers',
    labelDe: 'Pullover & Hoodies',
    labelEn: 'Sweaters & Hoodies',
    subcategories: [
      'hoodie',
      'crewneck_sweater',
      'knit_sweater',
      'turtleneck',
      'cardigan',
      'overshirt',
      'fleece_jacket',
      'fleece_vest',
      'vest_gilet',
    ],
  },
  {
    id: 'bottoms',
    labelDe: 'Hosen & Röcke',
    labelEn: 'Pants & Skirts',
    subcategories: [
      'denim',
      'chino',
      'trousers',
      'suit_trousers',
      'wide_leg_trousers',
      'cargo',
      'shorts',
      'midi_skirt',
      'mini_skirt',
    ],
  },
];

const TEMP_PRESETS = [
  { labelDe: 'Kalt (<8°C)', labelEn: 'Cold (<8°C)', temp: 5 },
  { labelDe: 'Kühl (9–15°C)', labelEn: 'Cool (9–15°C)', temp: 12 },
  { labelDe: 'Mild (16–21°C)', labelEn: 'Mild (16–21°C)', temp: 18 },
  { labelDe: 'Warm (>22°C)', labelEn: 'Warm (>22°C)', temp: 24 },
];

const ACCESSORY_SUGGESTION_CHIPS: Array<{
  subcategory: GarmentSubcategory;
  labelDe: string;
  labelEn: string;
  alwaysShow?: boolean;
}> = [
  { subcategory: 'socks', labelDe: 'Lange Socken', labelEn: 'Long Socks', alwaysShow: true },
  { subcategory: 'socks_short', labelDe: 'Kurze Socken', labelEn: 'Short Socks', alwaysShow: true },
  { subcategory: 'cap', labelDe: 'Cap', labelEn: 'Cap', alwaysShow: true },
  { subcategory: 'beanie', labelDe: 'Mütze', labelEn: 'Beanie', alwaysShow: true },
  { subcategory: 'bracelet', labelDe: 'Armband', labelEn: 'Bracelet', alwaysShow: true },
  { subcategory: 'watch', labelDe: 'Uhr', labelEn: 'Watch', alwaysShow: true },
  { subcategory: 'sunglasses', labelDe: 'Sonnenbrille', labelEn: 'Sunglasses', alwaysShow: true },
  { subcategory: 'belt', labelDe: 'Gürtel', labelEn: 'Belt', alwaysShow: true },
  { subcategory: 'glasses', labelDe: 'Brille', labelEn: 'Glasses' },
  { subcategory: 'necklace', labelDe: 'Kette', labelEn: 'Necklace' },
  { subcategory: 'scarf', labelDe: 'Schal', labelEn: 'Scarf' },
  { subcategory: 'bag_backpack', labelDe: 'Tasche', labelEn: 'Bag' },
];

const ANATOMICAL_CATEGORY_ORDER: Record<GarmentCategory, number> = {
  outerwear: 1,
  mid_layer: 2,
  base_top: 3,
  bottom: 4,
  footwear: 5,
  accessory: 6,
};

const CUSTOM_OUTFIT_NAMES_KEY = 'atelier_custom_outfit_names_v1';

function loadCustomOutfitNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CUSTOM_OUTFIT_NAMES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function formatWornDate(dateIso: string, locale: AppLocale = 'de'): string {
  try {
    const d = new Date(dateIso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 20 && now.getDate() === d.getDate()) {
      return locale === 'en' ? 'Today' : 'Heute';
    }
    if (diffHours < 44 && (now.getDate() - d.getDate() === 1 || (diffHours >= 16 && diffHours < 36))) {
      return locale === 'en' ? 'Yesterday' : 'Gestern';
    }
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateIso.slice(0, 10);
  }
}

export const DailyStylistView: React.FC<DailyStylistViewProps> = ({
  garments,
  profile,
  context,
  locale = 'de',
  wornHistory = [],
  onChangeContext,
  onLogOutfitWorn,
  onDeleteWornRecord,
  onToggleFavoriteOutfit,
  onOpenStatsTab,
  onWashAllGarments,
  onOpenAddModal,
  onEditGarment,
  onOpenSetupWizard,
  onOpenSettings,
  onOpenProfileTab,
  onUpdateProfile,
}) => {
  const isEn = locale === 'en';
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);
  const [wornFeedbackId, setWornFeedbackId] = useState<string | null>(null);
  const [sessionWornById, setSessionWornById] = useState<Record<string, SessionWornEntry>>({});
  const [latestWornBanner, setLatestWornBanner] = useState<SessionWornEntry | null>(null);
  const [sharedFeedbackId, setSharedFeedbackId] = useState<string | null>(null);
  const [incomingSharedOutfit, setIncomingSharedOutfit] = useState<ReturnType<
    typeof decodeSharedOutfit
  > | null>(null);
  const [displayMode, setDisplayMode] = useState<'stacked' | 'grid'>('stacked');
  const [popupOutfit, setPopupOutfit] = useState<GeneratedOutfit | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [customOutfitNames, setCustomOutfitNames] = useState<Record<string, string>>(() =>
    loadCustomOutfitNames()
  );
  const [editingOutfitId, setEditingOutfitId] = useState<string | null>(null);
  const [editingOutfitNameDraft, setEditingOutfitNameDraft] = useState('');

  useEffect(() => {
    setSessionWornById({});
  }, [
    context.temperatureC,
    context.weather,
    context.occasion,
    context.customOccasionId,
    context.variationSeed,
  ]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('outfit');
      if (encoded) {
        const decoded = decodeSharedOutfit(encoded);
        if (decoded) {
          setIncomingSharedOutfit(decoded);
        }
      }
    } catch {
      // Ignore invalid URL query params
    }
  }, []);

  // Custom occasion creator / editor state
  const [isCustomOccasionOpen, setIsCustomOccasionOpen] = useState(false);
  const [editingCustomOccasionId, setEditingCustomOccasionId] = useState<string | null>(null);
  const [customOccasionNameDraft, setCustomOccasionNameDraft] = useState('');
  const [customOccasionFormalitiesDraft, setCustomOccasionFormalitiesDraft] = useState<
    Array<1 | 2 | 3 | 4 | 5>
  >([2, 3]);
  const [customOccasionModifiersDraft, setCustomOccasionModifiersDraft] = useState<
    OutfitModifier[]
  >([]);

  const customOccasions = useMemo<CustomOccasion[]>(
    () => (Array.isArray(profile.customOccasions) ? profile.customOccasions : []),
    [profile.customOccasions]
  );

  const favoriteSignatures = useMemo(() => {
    const set = new Set<string>();
    for (const fav of profile.favoriteOutfits || []) {
      set.add(fav.id);
      set.add(buildOutfitSignature(fav.garmentIds));
    }
    return set;
  }, [profile.favoriteOutfits]);

  const activeCustomOccasion = useMemo(
    () => resolveActiveCustomOccasion(context, profile),
    [context, profile]
  );

  const effectiveModifiers = useMemo<OutfitModifier[]>(
    () => getEffectiveModifiers(context, profile),
    [context, profile]
  );

  const toggleDailyModifier = (mod: OutfitModifier) => {
    const current = effectiveModifiers;
    const isSelected = current.includes(mod);
    let next: OutfitModifier[];
    if (isSelected) {
      next = current.filter((m) => m !== mod);
    } else {
      const cleaned =
        mod === 'monochrome_calm'
          ? current.filter((m) => m !== 'color_accent')
          : mod === 'color_accent'
          ? current.filter((m) => m !== 'monochrome_calm')
          : current;
      next = [...cleaned, mod];
    }
    onChangeContext({
      ...context,
      activeModifiers: next,
    });
  };

  const openNewCustomOccasionForm = () => {
    setEditingCustomOccasionId(null);
    setCustomOccasionNameDraft('');
    setCustomOccasionFormalitiesDraft([2, 3]);
    setCustomOccasionModifiersDraft([]);
    setIsCustomOccasionOpen(true);
  };

  const openEditCustomOccasionForm = (co: CustomOccasion) => {
    setEditingCustomOccasionId(co.id);
    setCustomOccasionNameDraft(co.name);
    setCustomOccasionFormalitiesDraft(
      co.formalities.length > 0 ? co.formalities : [2, 3]
    );
    setCustomOccasionModifiersDraft(co.defaultModifiers || []);
    setIsCustomOccasionOpen(true);
  };

  const toggleDraftFormality = (level: 1 | 2 | 3 | 4 | 5) => {
    setCustomOccasionFormalitiesDraft((prev) => {
      const exists = prev.includes(level);
      if (exists && prev.length === 1) return prev;
      return exists
        ? prev.filter((l) => l !== level)
        : ([...prev, level].sort((a, b) => a - b) as Array<1 | 2 | 3 | 4 | 5>);
    });
  };

  const toggleDraftModifier = (mod: OutfitModifier) => {
    setCustomOccasionModifiersDraft((prev) => {
      const exists = prev.includes(mod);
      if (exists) return prev.filter((m) => m !== mod);
      const cleaned =
        mod === 'monochrome_calm'
          ? prev.filter((m) => m !== 'color_accent')
          : mod === 'color_accent'
          ? prev.filter((m) => m !== 'monochrome_calm')
          : prev;
      return [...cleaned, mod];
    });
  };

  const handleSaveCustomOccasion = async () => {
    if (!onUpdateProfile) return;
    const trimmed = customOccasionNameDraft.trim();
    if (!trimmed) return;

    const id =
      editingCustomOccasionId ||
      `custom_occ_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const nextEntry: CustomOccasion = {
      id,
      name: trimmed,
      formalities:
        customOccasionFormalitiesDraft.length > 0
          ? customOccasionFormalitiesDraft
          : [2, 3],
      defaultModifiers: customOccasionModifiersDraft,
    };

    const nextList = editingCustomOccasionId
      ? customOccasions.map((co) => (co.id === editingCustomOccasionId ? nextEntry : co))
      : [...customOccasions, nextEntry];

    await onUpdateProfile({
      ...profile,
      customOccasions: nextList,
    });

    onChangeContext({
      ...context,
      customOccasionId: id,
      activeModifiers: undefined,
    });
    setIsCustomOccasionOpen(false);
    setEditingCustomOccasionId(null);
  };

  const handleDeleteCustomOccasion = async (id: string) => {
    if (!onUpdateProfile) return;
    const nextList = customOccasions.filter((co) => co.id !== id);
    await onUpdateProfile({
      ...profile,
      customOccasions: nextList,
    });
    if (context.customOccasionId === id) {
      onChangeContext({
        ...context,
        customOccasionId: undefined,
        activeModifiers: undefined,
      });
    }
    setIsCustomOccasionOpen(false);
    setEditingCustomOccasionId(null);
  };

  const generatedOutfits = useMemo(() => {
    return generateOutfitsForContext(garments, profile, context, 5);
  }, [garments, profile, context]);

  const outfits = useMemo(() => {
    const wornEntries = Object.values(sessionWornById) as SessionWornEntry[];
    if (wornEntries.length === 0) return generatedOutfits;

    const garmentById = new Map(garments.map((g) => [g.id, g]));
    const refreshedWornEntries = wornEntries
      .map((entry) => ({
        ...entry,
        outfit: {
          ...entry.outfit,
          items: entry.outfit.items.map((item) => {
            const latest = garmentById.get(item.id);
            return latest ? { ...latest, wornOpen: item.wornOpen } : item;
          }),
        },
      }))
      .sort((a, b) => a.slotIndex - b.slotIndex);

    const wornIdSet = new Set(refreshedWornEntries.map((e) => e.outfit.id));
    const remainingGenerated = generatedOutfits.filter((o) => !wornIdSet.has(o.id));

    const combined: GeneratedOutfit[] = [...remainingGenerated];
    for (const entry of refreshedWornEntries) {
      const idx = Math.min(Math.max(0, entry.slotIndex), combined.length);
      combined.splice(idx, 0, entry.outfit);
    }
    return combined.slice(0, Math.max(5, refreshedWornEntries.length));
  }, [generatedOutfits, sessionWornById, garments]);

  const dirtyCount = useMemo(
    () => garments.filter((g) => canGarmentUseLaundry(g) && !g.isClean).length,
    [garments]
  );

  const activeAutoLaundrySubs = useMemo<GarmentSubcategory[]>(() => {
    return Array.isArray(profile.autoLaundrySubcategories)
      ? profile.autoLaundrySubcategories
      : DEFAULT_AUTO_LAUNDRY_SUBCATEGORIES;
  }, [profile.autoLaundrySubcategories]);

  const toggleAutoLaundryGroup = async (groupSubs: GarmentSubcategory[]) => {
    if (!onUpdateProfile) return;
    const isAllActive = groupSubs.every((s) => activeAutoLaundrySubs.includes(s));
    const nextSubs = isAllActive
      ? activeAutoLaundrySubs.filter((s) => !groupSubs.includes(s))
      : Array.from(new Set([...activeAutoLaundrySubs, ...groupSubs]));
    await onUpdateProfile({
      ...profile,
      autoLaundrySubcategories: nextSubs,
    });
  };

  const handleGenerateNewOutfits = () => {
    onChangeContext({
      ...context,
      variationSeed: (context.variationSeed || 0) + 1,
    });
  };

  const lockedGarments = useMemo(
    () => garments.filter((g) => context.lockedGarmentIds.includes(g.id)),
    [garments, context.lockedGarmentIds]
  );

  const accessorySubcategoriesInCloset = useMemo(() => {
    const counts = new Map<GarmentSubcategory, number>();
    for (const g of garments) {
      if (g.category === 'accessory') {
        counts.set(g.subcategory, (counts.get(g.subcategory) || 0) + 1);
      }
    }
    return counts;
  }, [garments]);

  const isAccessorySubcategoryEnabled = (subcat: GarmentSubcategory): boolean => {
    if (context.includeAccessories === false) return false;
    return !(context.excludedAccessorySubcategories || []).includes(subcat);
  };

  const toggleAccessorySubcategory = (subcat: GarmentSubcategory) => {
    if (context.includeAccessories === false) {
      // Turn accessories back on with only this subcategory enabled
      const allOthers = ACCESSORY_SUGGESTION_CHIPS.map((c) => c.subcategory).filter(
        (s) => s !== subcat
      );
      onChangeContext({
        ...context,
        includeAccessories: true,
        excludedAccessorySubcategories: allOthers,
      });
      return;
    }

    const currentExcluded = context.excludedAccessorySubcategories || [];
    const isExcluded = currentExcluded.includes(subcat);
    const nextExcluded = isExcluded
      ? currentExcluded.filter((s) => s !== subcat)
      : [...currentExcluded, subcat];

    onChangeContext({
      ...context,
      includeAccessories: true,
      excludedAccessorySubcategories: nextExcluded,
    });
  };

  const toggleAllAccessories = () => {
    const allDisabled =
      context.includeAccessories === false ||
      ACCESSORY_SUGGESTION_CHIPS.every((c) =>
        (context.excludedAccessorySubcategories || []).includes(c.subcategory)
      );

    if (allDisabled) {
      onChangeContext({
        ...context,
        includeAccessories: true,
        excludedAccessorySubcategories: [],
      });
    } else {
      onChangeContext({
        ...context,
        includeAccessories: false,
      });
    }
  };

  const toggleLockGarment = (id: string) => {
    const exists = context.lockedGarmentIds.includes(id);
    let nextIds: string[];
    if (exists) {
      nextIds = context.lockedGarmentIds.filter((item) => item !== id);
    } else {
      nextIds = [...context.lockedGarmentIds.slice(-1), id];
    }
    onChangeContext({
      ...context,
      lockedGarmentIds: nextIds,
    });
  };

  const handleSaveCustomOutfitName = (outfitId: string) => {
    const trimmed = editingOutfitNameDraft.trim();
    const next = { ...customOutfitNames };
    if (trimmed) {
      next[outfitId] = trimmed;
    } else {
      delete next[outfitId];
    }
    setCustomOutfitNames(next);
    try {
      localStorage.setItem(CUSTOM_OUTFIT_NAMES_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
    setEditingOutfitId(null);
  };

  const handleMarkWorn = async (
    outfit: GeneratedOutfit,
    title: string,
    slotIndex: number
  ) => {
    const existingEntry = sessionWornById[outfit.id];
    if (existingEntry) {
      await handleUndoWornOutfit(outfit.id);
      return;
    }

    const record = await onLogOutfitWorn(outfit, title);
    const laundryCount = record?.dirtyMarkedGarmentIds
      ? record.dirtyMarkedGarmentIds.length
      : outfit.items.filter(
          (g) => canGarmentUseLaundry(g) && activeAutoLaundrySubs.includes(g.subcategory)
        ).length;

    const entry: SessionWornEntry = {
      outfit,
      recordId: record?.id || '',
      outfitTitle: title,
      laundryCount,
      slotIndex,
    };

    setSessionWornById((prev) => ({
      ...prev,
      [outfit.id]: entry,
    }));
    setLatestWornBanner(entry);
    setWornFeedbackId(outfit.id);
    setTimeout(() => {
      setWornFeedbackId((prev) => (prev === outfit.id ? null : prev));
    }, 5000);
  };

  const handleUndoWornOutfit = async (outfitId: string) => {
    const entry = sessionWornById[outfitId];
    setSessionWornById((prev) => {
      const next = { ...prev };
      delete next[outfitId];
      return next;
    });
    setLatestWornBanner((prev) => (prev?.outfit.id === outfitId ? null : prev));
    setWornFeedbackId((prev) => (prev === outfitId ? null : prev));
    if (entry?.recordId && onDeleteWornRecord) {
      await onDeleteWornRecord(entry.recordId);
    }
  };

  const handleDeleteHistoryRecord = async (recordId: string) => {
    setSessionWornById((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(next) as Array<[string, SessionWornEntry]>) {
        if (v.recordId === recordId) {
          delete next[k];
        }
      }
      return next;
    });
    setLatestWornBanner((prev) => (prev?.recordId === recordId ? null : prev));
    if (onDeleteWornRecord) {
      await onDeleteWornRecord(recordId);
    }
  };

  const scrollToWearHistory = () => {
    setIsHistoryExpanded(true);
    const el = document.getElementById('wear-history-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleShareOutfit = async (outfit: GeneratedOutfit, title: string) => {
    const encoded = encodeSharedOutfit(
      outfit,
      title,
      context,
      activeCustomOccasion?.name
    );
    const shareUrl = `${window.location.origin}${window.location.pathname}?outfit=${encoded}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${title} — Outfit`,
          text: isEn ? `Outfit: ${title}` : `Mein Outfit: ${title}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard copy if user cancels or share fails
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore clipboard permission errors
    }
    setSharedFeedbackId(outfit.id);
    setTimeout(() => {
      setSharedFeedbackId((prev) => (prev === outfit.id ? null : prev));
    }, 2500);
  };

  return (
    <div className="space-y-8">
      {/* Context Control Panel */}
      <section
        aria-label="Wetter- und Anlass-Auswahl für deine Outfits"
        className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            {isEn ? 'What should I wear today?' : 'Was ziehe ich heute an?'}
          </h1>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleGenerateNewOutfits}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>{isEn ? 'Generate New Outfits' : 'Neue Outfits generieren'}</span>
            </button>

            {onOpenSetupWizard && (
              <button
                type="button"
                onClick={onOpenSetupWizard}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-xs font-medium text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEn ? 'Start Wizard' : 'Start-Assistent'}</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-xs font-medium text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEn ? 'Settings & Sizes' : 'Einstellungen & Größen'}</span>
              </button>
            )}

            {/* Outfit Presentation Toggle: Übereinander (Stacked) vs. Einzelteile */}
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800"
              role="group"
              aria-label="Outfit-Darstellungsmodus"
            >
              <button
                type="button"
                onClick={() => setDisplayMode('stacked')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  displayMode === 'stacked'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isEn ? 'Stacked Look' : 'Übereinander'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('grid')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  displayMode === 'grid'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{isEn ? 'Single Items' : 'Einzelteile'}</span>
              </button>
            </div>

            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={onWashAllGarments}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isEn
                    ? `Wash Laundry (${dirtyCount} worn)`
                    : `Wäsche waschen (${dirtyCount} getragen)`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAnchorPicker((prev) => !prev)}
              aria-expanded={showAnchorPicker}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[42px] w-full sm:w-auto rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                lockedGarments.length > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>
                {isEn ? 'Pick a piece to wear today' : 'Ein bestimmtes Teil heute tragen'}{' '}
                {lockedGarments.length > 0
                  ? `(${lockedGarments.length} ${isEn ? 'selected' : 'ausgewählt'})`
                  : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Anchor Item Picker Drawer */}
        {showAnchorPicker && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-300">
                {isEn
                  ? 'Tap 1–2 clothes from your closet that you definitely want to wear today:'
                  : 'Tippe auf 1–2 Kleidungsstücke aus deinem Schrank, die im Outfit auf jeden Fall dabei sein sollen:'}
              </p>
              {lockedGarments.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeContext({ ...context, lockedGarmentIds: [] })}
                  className="text-xs text-amber-400 hover:underline cursor-pointer py-1 px-2"
                >
                  {isEn ? 'Clear selection' : 'Auswahl aufheben'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
              {garments.map((g) => {
                const isLocked = context.lockedGarmentIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleLockGarment(g.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      isLocked
                        ? 'bg-amber-500/15 border-amber-500/50 text-zinc-100'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <GarmentVector
                      type={g.subcategory}
                      colorHex={g.colorHex}
                      accentColorHex={g.accentColorHex}
                      pattern={g.pattern}
                      texture={g.texture}
                      neckline={g.neckline}
                      hasPrint={g.hasPrint}
                      hasLogo={g.hasLogo}
                      wornOpen={g.wornOpen}
                      className="w-8 h-8 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{g.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {g.brand ? `${g.brand} · ` : ''}
                        {SUBCATEGORY_LABELS[g.subcategory]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls Grid: Temperature & Weather */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Temperature Presets + Slider (7 cols) */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="temp-slider" className="text-xs font-medium text-zinc-300">
                {isEn ? 'Outside Temperature' : 'Wie warm ist es draußen?'}
              </label>
              <span className="text-sm font-mono font-semibold text-amber-400 tabular-nums">
                {context.temperatureC}°C
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80">
              {TEMP_PRESETS.map((preset) => {
                const isActive =
                  (preset.temp === 5 && context.temperatureC < 9) ||
                  (preset.temp === 12 && context.temperatureC >= 9 && context.temperatureC <= 15) ||
                  (preset.temp === 18 && context.temperatureC >= 16 && context.temperatureC <= 21) ||
                  (preset.temp === 24 && context.temperatureC >= 22);
                return (
                  <button
                    key={preset.temp}
                    type="button"
                    onClick={() => onChangeContext({ ...context, temperatureC: preset.temp })}
                    className={`px-2.5 py-2 min-h-[40px] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {isEn ? preset.labelEn : preset.labelDe}
                  </button>
                );
              })}
            </div>

            <input
              id="temp-slider"
              type="range"
              min={-5}
              max={32}
              value={context.temperatureC}
              onChange={(e) =>
                onChangeContext({ ...context, temperatureC: Number(e.target.value) })
              }
              className="w-full accent-amber-400 cursor-pointer h-7"
            />
          </div>

          {/* Weather Toggle (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            <span className="block text-xs font-medium text-zinc-300">
              {isEn ? 'Weather' : 'Wetter'}
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80">
              {(
                [
                  { id: 'sunny_dry', labelDe: 'Trocken', labelEn: 'Dry', icon: Sun },
                  { id: 'cloudy_windy', labelDe: 'Windig', labelEn: 'Windy', icon: Cloud },
                  { id: 'rain_wet', labelDe: 'Regen', labelEn: 'Rain', icon: CloudRain },
                ] as const
              ).map(({ id, labelDe, labelEn, icon: Icon }) => {
                const active = context.weather === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChangeContext({ ...context, weather: id as WeatherCondition })}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                      active
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{isEn ? labelEn : labelDe}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Full-Width Expanded Occasion Selector + Freely Extensible Custom Occasions */}
        <div className="pt-3 border-t border-zinc-800/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-300">
              {isEn ? 'What are your plans today?' : 'Was hast du heute vor?'}
            </span>
            {onUpdateProfile && (
              <div className="flex items-center gap-2">
                {activeCustomOccasion && (
                  <button
                    type="button"
                    onClick={() => openEditCustomOccasionForm(activeCustomOccasion)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-[11px] font-medium text-zinc-300 hover:text-zinc-100 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3 text-amber-400" />
                    <span>{isEn ? 'Edit custom occasion' : 'Anlass bearbeiten'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openNewCustomOccasionForm}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-[11px] font-medium text-amber-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>{isEn ? 'Custom Occasion' : 'Eigener Anlass'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(OCCASION_LABELS) as OccasionType[]).map((occ) => {
              const active = !activeCustomOccasion && context.occasion === occ;
              const occText = isEn ? OCCASION_LABELS_EN[occ] : OCCASION_LABELS[occ];
              return (
                <button
                  key={occ}
                  type="button"
                  onClick={() =>
                    onChangeContext({
                      ...context,
                      occasion: occ,
                      customOccasionId: undefined,
                      activeModifiers: undefined,
                    })
                  }
                  className={`py-2 px-3 min-h-[38px] rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap border touch-manipulation active:scale-95 ${
                    active
                      ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                      : 'bg-zinc-950 border-zinc-800/90 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
                  }`}
                >
                  {occText}
                </button>
              );
            })}

            {customOccasions.map((co) => {
              const active = activeCustomOccasion?.id === co.id;
              return (
                <button
                  key={co.id}
                  type="button"
                  onClick={() =>
                    onChangeContext({
                      ...context,
                      customOccasionId: co.id,
                      activeModifiers: undefined,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 py-2 px-3 min-h-[38px] rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap border touch-manipulation active:scale-95 ${
                    active
                      ? 'bg-amber-400 border-amber-400 text-zinc-950 font-semibold'
                      : 'bg-amber-500/10 border-amber-500/35 text-amber-200 hover:bg-amber-500/20'
                  }`}
                >
                  <span>{co.name}</span>
                </button>
              );
            })}
          </div>

          {/* Inline Custom Occasion Creator / Editor */}
          {isCustomOccasionOpen && onUpdateProfile && (
            <div className="rounded-xl bg-zinc-950 border border-amber-500/40 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-zinc-100">
                  {editingCustomOccasionId
                    ? isEn
                      ? 'Edit Custom Occasion'
                      : 'Eigenen Anlass bearbeiten'
                    : isEn
                    ? 'Create Custom Occasion'
                    : 'Eigenen Anlass anlegen'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomOccasionOpen(false);
                    setEditingCustomOccasionId(null);
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-300">
                    {isEn ? 'Name of Occasion' : 'Bezeichnung'}
                  </label>
                  <input
                    type="text"
                    value={customOccasionNameDraft}
                    onChange={(e) => setCustomOccasionNameDraft(e.target.value)}
                    placeholder={
                      isEn
                        ? 'e.g. Dog walk, Concert, Brunch, Travel...'
                        : 'z. B. Hundespaziergang, Konzert, Brunch, Reise...'
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-300">
                    {isEn ? 'Dress Code / Formality Level' : 'Schickheits-Grad (Mehrfachauswahl)'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { level: 1, labelDe: '1 · Sport & Lounge', labelEn: '1 · Sport & Lounge' },
                        { level: 2, labelDe: '2 · Lässig', labelEn: '2 · Casual' },
                        { level: 3, labelDe: '3 · Gepflegt', labelEn: '3 · Smart Casual' },
                        { level: 4, labelDe: '4 · Schick / Büro', labelEn: '4 · Business / Chic' },
                        { level: 5, labelDe: '5 · Festlich', labelEn: '5 · Formal' },
                      ] as const
                    ).map((item) => {
                      const active = customOccasionFormalitiesDraft.includes(item.level);
                      return (
                        <button
                          key={item.level}
                          type="button"
                          onClick={() => toggleDraftFormality(item.level)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-400/20 border-amber-400/60 text-amber-200 font-semibold'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {isEn ? item.labelEn : item.labelDe}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-300">
                  {isEn ? 'Default Modifiers for this Occasion' : 'Automatische Modifier für diesen Anlass'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(OUTFIT_MODIFIER_META) as OutfitModifier[]).map((modKey) => {
                    const meta = OUTFIT_MODIFIER_META[modKey];
                    const active = customOccasionModifiersDraft.includes(modKey);
                    return (
                      <button
                        key={modKey}
                        type="button"
                        onClick={() => toggleDraftModifier(modKey)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-400/20 border-amber-400/60 text-amber-200 font-semibold'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {isEn ? meta.labelEn : meta.labelDe}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-900">
                <div>
                  {editingCustomOccasionId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomOccasion(editingCustomOccasionId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-900/50 text-xs font-medium text-rose-300 hover:bg-rose-900/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Delete Occasion' : 'Anlass löschen'}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomOccasionOpen(false);
                      setEditingCustomOccasionId(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer"
                  >
                    {isEn ? 'Cancel' : 'Abbrechen'}
                  </button>
                  <button
                    type="button"
                    disabled={!customOccasionNameDraft.trim()}
                    onClick={handleSaveCustomOccasion}
                    className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-xs font-semibold text-zinc-950 cursor-pointer"
                  >
                    {isEn ? 'Save Occasion' : 'Anlass speichern'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Combinable Daily Modifiers Bar (Replaces redundant "Stil:" selector) */}
        <div className="pt-3 border-t border-zinc-800/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-zinc-300">
                {isEn ? 'Daily Focus & Modifiers:' : 'Tages-Fokus & Modifier:'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {context.activeModifiers !== undefined && (
                <button
                  type="button"
                  onClick={() => onChangeContext({ ...context, activeModifiers: undefined })}
                  className="text-[11px] text-zinc-400 hover:text-amber-300 cursor-pointer underline"
                >
                  {isEn ? 'Reset to default' : 'Auf Standard zurücksetzen'}
                </button>
              )}
              {onOpenProfileTab && (
                <button
                  type="button"
                  onClick={onOpenProfileTab}
                  className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  {isEn ? 'Edit defaults in Profile →' : 'Standard im Profil anpassen →'}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(OUTFIT_MODIFIER_META) as OutfitModifier[]).map((modKey) => {
              const meta = OUTFIT_MODIFIER_META[modKey];
              const isSelected = effectiveModifiers.includes(modKey);
              return (
                <button
                  key={modKey}
                  type="button"
                  onClick={() => toggleDailyModifier(modKey)}
                  title={isEn ? meta.descEn : meta.descDe}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border touch-manipulation active:scale-95 ${
                    isSelected
                      ? 'bg-amber-400/20 border-amber-400/60 text-amber-200 font-semibold'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span>{isEn ? meta.labelEn : meta.labelDe}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Configurable Accessory Suggestions Bar ("Mütze, Socke, Armband, Uhr etc. als Vorschlag") */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-zinc-300">
              {isEn ? 'Accessories in suggestions:' : 'Accessoires als Vorschlag:'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 flex-1 sm:justify-end">
            <button
              type="button"
              onClick={toggleAllAccessories}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap border ${
                context.includeAccessories !== false &&
                (!context.excludedAccessorySubcategories ||
                  context.excludedAccessorySubcategories.length === 0)
                  ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {context.includeAccessories === false
                ? isEn
                  ? 'Enable all'
                  : 'Alle einblenden'
                : isEn
                ? 'Hide all'
                : 'Alle ausblenden'}
            </button>

            {ACCESSORY_SUGGESTION_CHIPS.filter(
              (chip) =>
                chip.alwaysShow ||
                (accessorySubcategoriesInCloset.get(chip.subcategory) || 0) > 0
            ).map((chip) => {
              const isEnabled = isAccessorySubcategoryEnabled(chip.subcategory);
              const count = accessorySubcategoriesInCloset.get(chip.subcategory) || 0;
              return (
                <button
                  key={chip.subcategory}
                  type="button"
                  onClick={() => toggleAccessorySubcategory(chip.subcategory)}
                  title={
                    isEnabled
                      ? `${chip.labelDe} in Outfit-Vorschlägen aktiv (${count} im Schrank) – Klicken zum Ausblenden`
                      : `${chip.labelDe} in Outfit-Vorschlägen ausgeblendet (${count} im Schrank) – Klicken zum Einblenden`
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                    isEnabled
                      ? 'bg-amber-400/15 border-amber-400/50 text-amber-200'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <GarmentVector
                    type={chip.subcategory}
                    colorHex={isEnabled ? '#FBBF24' : '#71717A'}
                    texture="smooth_cotton"
                    className="w-3.5 h-3.5 shrink-0"
                  />
                  <span>{isEn ? chip.labelEn : chip.labelDe}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-mono ${
                        isEnabled ? 'text-amber-300/90' : 'text-zinc-600'
                      }`}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Configurable Automatic Laundry Bar ("Automatisch in die Wäsche bei 'Heute anziehen'") */}
        {onUpdateProfile && (
          <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-zinc-300">
                {isEn
                  ? 'Auto-laundry when worn:'
                  : 'Automatisch in die Wäsche (bei „Heute anziehen“):'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 flex-1 sm:justify-end">
              {AUTO_LAUNDRY_GROUPS.map((group) => {
                const isActive = group.subcategories.every((s) =>
                  activeAutoLaundrySubs.includes(s)
                );
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleAutoLaundryGroup(group.subcategories)}
                    title={
                      isActive
                        ? `${group.labelDe} landen beim Tragen automatisch im Wäschekorb (Standard: T-Shirts & Socken)`
                        : `${group.labelDe} bleiben nach 1× Tragen weiter frisch im Schrank`
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                      isActive
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-semibold'
                        : 'bg-zinc-950 border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    {isActive ? '✓ ' : ''}
                    {isEn ? group.labelEn : group.labelDe}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Generated Outfits Feed (Immediately below filter controls) */}
      {outfits.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-10 text-center space-y-4">
          <SlidersHorizontal className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-zinc-100">
              {isEn
                ? 'No complete outfit found for this weather & occasion'
                : 'Für dieses Wetter & diesen Anlass fehlt gerade ein passendes Teil'}
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isEn
                ? `For ${
                    activeCustomOccasion
                      ? activeCustomOccasion.name
                      : OCCASION_LABELS_EN[context.occasion]
                  } at ${context.temperatureC}°C, a matching garment is missing or currently in the laundry.`
                : `Für „${
                    activeCustomOccasion
                      ? activeCustomOccasion.name
                      : OCCASION_LABELS[context.occasion]
                  }“ bei ${context.temperatureC}°C (${
                    context.weather === 'rain_wet' ? 'Regenfest' : 'Trocken'
                  }) fehlt ein passendes Kleidungsstück oder deine passenden Teile sind gerade in der Wäsche.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={onWashAllGarments}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 cursor-pointer"
              >
                {isEn
                  ? 'Mark worn clothes as washed'
                  : 'Getragene Kleidung als gewaschen markieren'}
              </button>
            )}
            {context.lockedGarmentIds.length > 0 && (
              <button
                type="button"
                onClick={() => onChangeContext({ ...context, lockedGarmentIds: [] })}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 cursor-pointer"
              >
                {isEn ? 'Clear selected item' : 'Ausgewähltes Einzelteil lösen'}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 cursor-pointer touch-manipulation active:scale-95"
            >
              <span>
                <span className="inline sm:hidden">{isEn ? '+ Add Garment' : '+ Teil anlegen'}</span>
                <span className="hidden sm:inline">{isEn ? '+ Add Garment' : '+ Neues Kleidungsstück anlegen'}</span>
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs text-zinc-400">
              {isEn
                ? `${outfits.length} matching outfit suggestions`
                : `${outfits.length} passende Outfit-Vorschläge`}
              {context.variationSeed
                ? ` · ${isEn ? `Variation #${context.variationSeed + 1}` : `Variante #${context.variationSeed + 1}`}`
                : ''}
            </p>
            <button
              type="button"
              onClick={handleGenerateNewOutfits}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-amber-500/40 hover:border-amber-400 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer touch-manipulation active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>{isEn ? 'Generate New Outfits' : 'Neue Outfits generieren'}</span>
            </button>
          </div>

          {latestWornBanner && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl bg-emerald-950/35 border border-emerald-500/50 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-emerald-200 truncate">
                    {isEn
                      ? `✓ "${latestWornBanner.outfitTitle}" logged for today`
                      : `✓ „${latestWornBanner.outfitTitle}“ für heute eingetragen`}
                  </p>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    {isEn
                      ? `Wear counter (+1×) updated${
                          latestWornBanner.laundryCount > 0
                            ? ` · ${latestWornBanner.laundryCount} ${
                                latestWornBanner.laundryCount === 1 ? 'item' : 'items'
                              } placed in laundry`
                            : ''
                        }`
                      : `Trage-Zähler (+1×) aktualisiert${
                          latestWornBanner.laundryCount > 0
                            ? ` · ${latestWornBanner.laundryCount} ${
                                latestWornBanner.laundryCount === 1 ? 'Teil' : 'Teile'
                              } in die Wäsche gelegt`
                            : ''
                        }`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onOpenStatsTab && (
                  <button
                    type="button"
                    onClick={onOpenStatsTab}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-amber-400/60 text-xs font-medium text-amber-200 cursor-pointer touch-manipulation"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isEn ? 'Stats & Favorites' : 'Statistik & Favoriten'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={scrollToWearHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-medium text-zinc-200 cursor-pointer touch-manipulation"
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isEn ? 'View History ↓' : 'Zuletzt getragen ↓'}</span>
                </button>
                {onDeleteWornRecord && latestWornBanner.recordId && (
                  <button
                    type="button"
                    onClick={() => handleUndoWornOutfit(latestWornBanner.outfit.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-rose-500/60 text-xs font-medium text-zinc-300 hover:text-rose-200 cursor-pointer touch-manipulation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Undo' : 'Rückgängig'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLatestWornBanner(null)}
                  aria-label={isEn ? 'Dismiss notice' : 'Hinweis schließen'}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {outfits.map((outfit, outfitSlotIndex) => {
            const sessionWorn = sessionWornById[outfit.id];
            const isWornToday = Boolean(sessionWorn) || wornFeedbackId === outfit.id;
            const hasSandboxItem = outfit.items.some((i) => i.isWishlistSandbox);
            const sortedAnatomicalItems = [...outfit.items].sort(
              (a, b) =>
                ANATOMICAL_CATEGORY_ORDER[a.category] -
                ANATOMICAL_CATEGORY_ORDER[b.category]
            );
            const coreAnatomicalItems = sortedAnatomicalItems.filter(
              (i) => i.category !== 'accessory'
            );
            const outfitTitle =
              customOutfitNames[outfit.id] || getShortOutfitTitle(outfit.items);
            const isEditingTitle = editingOutfitId === outfit.id;
            const coreSigIds = coreAnatomicalItems.map((i) => i.id);
            const outfitSig = buildOutfitSignature(
              coreSigIds.length > 0 ? coreSigIds : outfit.items.map((i) => i.id)
            );
            const isFavoriteOutfit =
              favoriteSignatures.has(outfit.id) || favoriteSignatures.has(outfitSig);

            return (
              <article
                key={outfit.id}
                className={`rounded-2xl border p-5 sm:p-6 transition-colors space-y-4 ${
                  isWornToday
                    ? 'bg-emerald-950/15 border-emerald-500/60 shadow-lg'
                    : 'bg-zinc-900/45 border-zinc-800/90 hover:border-zinc-700/80'
                }`}
              >
                {/* Minimal, Non-Verbose Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/70">
                  <div className="flex items-center gap-2 min-w-0">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingOutfitNameDraft}
                          onChange={(e) => setEditingOutfitNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveCustomOutfitName(outfit.id);
                            if (e.key === 'Escape') setEditingOutfitId(null);
                          }}
                          placeholder="Look-Name (z.B. Büro, Liebling...)"
                          className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-amber-400/60 text-xs text-zinc-100 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCustomOutfitName(outfit.id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-100 truncate">
                          {outfitTitle}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOutfitId(outfit.id);
                            setEditingOutfitNameDraft(customOutfitNames[outfit.id] || outfitTitle);
                          }}
                          title={isEn ? 'Rename outfit' : 'Eigenen Namen vergeben'}
                          aria-label={isEn ? 'Rename outfit' : 'Outfit umbenennen'}
                          className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isWornToday && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/45 text-[11px] text-emerald-300 font-semibold">
                            <Check className="w-3 h-3" />
                            <span>{isEn ? 'Selected for today' : 'Heute ausgewählt'}</span>
                          </span>
                        )}
                        {hasSandboxItem && (
                          <span className="text-xs text-sky-300 font-medium">
                            · {isEn ? 'Test Item' : 'Mit Test-Stück'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                    {onToggleFavoriteOutfit && (
                      <button
                        type="button"
                        onClick={() =>
                          onToggleFavoriteOutfit({
                            id: outfitSig,
                            title: outfitTitle,
                            garmentIds: outfit.items.map((i) => i.id),
                            garments: outfit.items,
                            savedAt: new Date().toISOString(),
                            totalScore: outfit.totalScore,
                            occasion: context.occasion,
                            temperatureC: context.temperatureC,
                          })
                        }
                        title={
                          isFavoriteOutfit
                            ? isEn
                              ? 'Remove from Favorite Outfits'
                              : 'Aus Lieblings-Outfits entfernen'
                            : isEn
                            ? 'Save as Favorite Outfit'
                            : 'Als Lieblings-Outfit speichern'
                        }
                        className={`inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                          isFavoriteOutfit
                            ? 'bg-rose-500/15 border-rose-500/50 text-rose-200 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-rose-200'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isFavoriteOutfit
                              ? 'fill-rose-400 text-rose-400'
                              : 'text-rose-400'
                          }`}
                        />
                        <span>{isFavoriteOutfit ? (isEn ? 'Saved' : 'Favorit') : (isEn ? 'Favorite' : 'Merken')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleShareOutfit(outfit, outfitTitle)}
                      className={`inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                        sharedFeedbackId === outfit.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100'
                      }`}
                    >
                      {sharedFeedbackId === outfit.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isEn ? 'Link copied' : 'Link kopiert'}</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isEn ? 'Share' : 'Teilen'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPopupOutfit(outfit)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
                    >
                      <Info className="w-4 h-4 text-amber-400" />
                      <span>{isEn ? 'Why it works' : 'Warum passt’s?'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkWorn(outfit, outfitTitle, outfitSlotIndex)}
                      className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                        isWornToday
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold'
                          : 'bg-zinc-100 text-zinc-950 hover:bg-white font-semibold'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isWornToday
                          ? isEn
                            ? 'Worn Today'
                            : 'Heute angezogen'
                          : isEn
                          ? 'Wear Today'
                          : 'Heute anziehen'}
                      </span>
                    </button>

                    {isWornToday && sessionWorn?.recordId && onDeleteWornRecord && (
                      <button
                        type="button"
                        onClick={() => handleUndoWornOutfit(outfit.id)}
                        title={isEn ? 'Undo wear selection' : 'Auswahl rückgängig machen'}
                        className="inline-flex items-center justify-center gap-1 min-h-[42px] px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-rose-500/60 text-xs font-medium text-zinc-300 hover:text-rose-200 transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Undo' : 'Rückgängig'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Outfit Display: Stacked ("Übereinander") or Grid */}
                {displayMode === 'stacked' ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                    {/* Visual Vertical Outfit Stack ("Übereinander") */}
                    <div className="md:col-span-5">
                      <OutfitLayerStack
                        items={outfit.items}
                        profile={profile}
                        lockedGarmentIds={context.lockedGarmentIds}
                        onToggleLock={toggleLockGarment}
                        onEditGarment={onEditGarment}
                      />
                    </div>

                    {/* Head-to-Toe Vertical Layer Breakdown ("Von Kopf bis Fuß") */}
                    <div className="md:col-span-7 flex flex-col justify-between gap-2.5">
                      <div className="space-y-2.5">
                        {coreAnatomicalItems.map((item, layerIdx) => {
                          const isLocked = context.lockedGarmentIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              className="group relative rounded-xl bg-zinc-950/90 border border-zinc-800/80 hover:border-zinc-700/90 p-3 flex items-center gap-3.5 transition-colors"
                            >
                              {/* Layer index + Miniature Garment Vector */}
                              <div className="relative flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900/70 border border-zinc-800/60 shrink-0">
                                {item.imageDataUrl ? (
                                  <img
                                    src={item.imageDataUrl}
                                    alt={item.name}
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 object-cover rounded"
                                  />
                                ) : (
                                  <GarmentVector
                                    type={item.subcategory}
                                    colorHex={item.colorHex}
                                    accentColorHex={item.accentColorHex}
                                    pattern={item.pattern}
                                    texture={item.texture}
                                    neckline={item.neckline}
                                    hasPrint={item.hasPrint}
                                    hasLogo={item.hasLogo}
                                    wornOpen={item.wornOpen}
                                    className="w-10 h-10"
                                  />
                                )}
                                <span className="absolute -top-1 -left-1 w-4 h-4 rounded bg-zinc-900 border border-zinc-700 text-[9px] font-mono text-zinc-400 flex items-center justify-center">
                                  {layerIdx + 1}
                                </span>
                              </div>

                              {/* Item Details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                                  <span>{SUBCATEGORY_LABELS[item.subcategory]}</span>
                                  {item.brand && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-zinc-300 font-medium">{item.brand}</span>
                                    </>
                                  )}
                                  {item.size && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>Gr. {item.size}</span>
                                    </>
                                  )}
                                  {item.pattern && item.pattern !== 'solid' && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-amber-300">
                                        {PATTERN_LABELS[item.pattern].split(' (')[0]}
                                      </span>
                                    </>
                                  )}
                                  {item.hasPrint && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-purple-300">Print</span>
                                    </>
                                  )}
                                  {item.hasLogo && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-indigo-300">Logo</span>
                                    </>
                                  )}
                                  {item.wornOpen !== undefined && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-[10px] text-amber-200 font-medium">
                                      {item.wornOpen
                                        ? 'Empfehlung: Offen über T-Shirt'
                                        : 'Empfehlung: Geschlossen getragen'}
                                    </span>
                                  )}
                                  {item.isWishlistSandbox && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-sky-300">Test-Stück</span>
                                    </>
                                  )}
                                  {item.wearCount !== undefined && item.wearCount > 0 && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-amber-400 font-mono font-medium">
                                        {item.wearCount}× getragen
                                      </span>
                                    </>
                                  )}
                                  {canGarmentUseLaundry(item) && !item.isClean && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-[10px] text-emerald-300 font-medium">
                                      {isEn ? 'In Laundry' : 'Im Wäschekorb'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-zinc-100 truncate mt-0.5">
                                  {item.name}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                    style={{ backgroundColor: item.colorHex }}
                                  />
                                  <span className="truncate">{item.colorName}</span>
                                  {item.accentColorHex && (
                                    <>
                                      <span aria-hidden="true">+</span>
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                        style={{ backgroundColor: item.accentColorHex }}
                                      />
                                      <span className="truncate text-zinc-300">
                                        {item.accentColorName || 'Akzent'}
                                      </span>
                                    </>
                                  )}
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">
                                    {TEXTURE_LABELS[item.texture]}
                                  </span>
                                  {item.category === 'footwear' &&
                                    (() => {
                                      const pairedSock = outfit.items.find(
                                        (a) =>
                                          a.category === 'accessory' &&
                                          (a.subcategory === 'socks' ||
                                            a.subcategory === 'socks_short')
                                      );
                                      if (!pairedSock) return null;
                                      return (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="text-amber-300/90 font-medium truncate">
                                            mit {SUBCATEGORY_LABELS[pairedSock.subcategory]}
                                          </span>
                                        </>
                                      );
                                    })()}
                                </div>
                              </div>

                              {/* Edit & Lock Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {onEditGarment && (
                                  <button
                                    type="button"
                                    onClick={() => onEditGarment(item)}
                                    title={
                                      isEn
                                        ? `Edit ${item.name}`
                                        : `${item.name} bearbeiten`
                                    }
                                    aria-label={`${item.name} bearbeiten`}
                                    className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer touch-manipulation active:scale-95"
                                  >
                                    <Edit3 className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleLockGarment(item.id)}
                                  title={
                                    isLocked
                                      ? 'Auswahl aufheben'
                                      : 'Dieses Teil festhalten und andere Teile dazu kombinieren'
                                  }
                                  aria-label={`${item.name} ${isLocked ? 'lösen' : 'festhalten'}`}
                                  className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-900 transition-colors cursor-pointer touch-manipulation active:scale-95"
                                >
                                  {isLocked ? (
                                    <Lock className="w-4 h-4 text-amber-400" />
                                  ) : (
                                    <Unlock className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {outfit.items.map((item) => {
                      const isLocked = context.lockedGarmentIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="group relative rounded-xl bg-zinc-950/90 border border-zinc-800/80 p-3 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px] text-zinc-400 mb-2">
                            <span className="truncate">
                              {(isEn ? CATEGORY_LABELS_EN : CATEGORY_LABELS)[
                                item.category
                              ].split(',')[0]}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {onEditGarment && (
                                <button
                                  type="button"
                                  onClick={() => onEditGarment(item)}
                                  title={
                                    isEn
                                      ? `Edit ${item.name}`
                                      : `${item.name} bearbeiten`
                                  }
                                  aria-label={`${item.name} bearbeiten`}
                                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleLockGarment(item.id)}
                                title={
                                  isLocked
                                    ? 'Auswahl aufheben'
                                    : 'Dieses Teil festhalten'
                                }
                                aria-label={`${item.name} ${isLocked ? 'lösen' : 'festhalten'}`}
                                className="p-1 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-zinc-900 transition-colors cursor-pointer"
                              >
                                {isLocked ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="my-2 flex items-center justify-center h-20">
                            {item.imageDataUrl ? (
                              <img
                                src={item.imageDataUrl}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="h-20 w-20 object-cover rounded-lg"
                              />
                            ) : (
                              <GarmentVector
                                type={item.subcategory}
                                colorHex={item.colorHex}
                                accentColorHex={item.accentColorHex}
                                pattern={item.pattern}
                                texture={item.texture}
                                neckline={item.neckline}
                                hasPrint={item.hasPrint}
                                hasLogo={item.hasLogo}
                                wornOpen={item.wornOpen}
                                className="w-16 h-16"
                              />
                            )}
                          </div>

                          <div className="mt-2 pt-2 border-t border-zinc-900 space-y-1">
                            <p className="text-xs font-medium text-zinc-100 line-clamp-2 min-h-[2rem] leading-snug">
                              {item.name}
                            </p>
                            {item.wornOpen !== undefined && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-[10px] text-amber-200 font-medium">
                                {item.wornOpen ? 'Offen über T-Shirt' : 'Geschlossen getragen'}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                style={{ backgroundColor: item.colorHex }}
                              />
                              <span className="truncate">{item.colorName}</span>
                              {item.accentColorHex && (
                                <>
                                  <span aria-hidden="true">+</span>
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                    style={{ backgroundColor: item.accentColorHex }}
                                  />
                                  <span className="truncate text-zinc-300">
                                    {item.accentColorName || 'Akzent'}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {item.brand ? `${item.brand}` : SUBCATEGORY_LABELS[item.subcategory]}
                              {item.size ? ` · Gr. ${item.size}` : ''}
                              {item.wearCount !== undefined && item.wearCount > 0 ? ` · ${item.wearCount}×` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Worn Outfit History ("Zuletzt getragen" placed below the outfit recommendations) */}
      <section
        id="wear-history-section"
        aria-label={isEn ? 'Wear History' : 'Zuletzt getragene Outfits'}
        className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-4 sm:p-5 space-y-3.5 scroll-mt-20"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100 truncate">
                  {isEn ? 'Wear History' : 'Zuletzt getragen'}
                </h2>
                {wornHistory && wornHistory.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-mono">
                    {wornHistory.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {isEn
                  ? 'Track your wear habits & see which pieces you actually wear.'
                  : 'Verfolge deine Tragegewohnheiten & sieh, welche Teile du wirklich trägst.'}
              </p>
            </div>
          </div>

          {wornHistory && wornHistory.length > 2 && (
            <button
              type="button"
              onClick={() => setIsHistoryExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer touch-manipulation px-2 py-1 rounded-md hover:bg-zinc-800/50 shrink-0"
            >
              <span>
                {isHistoryExpanded
                  ? isEn
                    ? 'Show less'
                    : 'Weniger anzeigen'
                  : isEn
                  ? `Show all (${wornHistory.length})`
                  : `Alle (${wornHistory.length}) anzeigen`}
              </span>
              {isHistoryExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {!wornHistory || wornHistory.length === 0 ? (
          <div className="text-center py-4 px-3 rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800/80 space-y-1">
            <p className="text-xs text-zinc-300 font-medium">
              {isEn ? 'No outfits logged as worn yet' : 'Noch keine Outfits in der Historie'}
            </p>
            <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
              {isEn
                ? 'Tap "Wear Today" on any outfit above to record it in your history and track how often you wear your clothes.'
                : 'Klicke bei einem Outfit oben auf „Heute anziehen“, um es festzuhalten und die Tragehäufigkeit deiner Kleidung zu zählen.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(isHistoryExpanded ? wornHistory : wornHistory.slice(0, 2)).map((record) => {
              const recordDateLabel = formatWornDate(record.wornDate, locale);
              return (
                <div
                  key={record.id}
                  className="rounded-xl bg-zinc-950/70 border border-zinc-800/80 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700/80 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-amber-300 inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 opacity-80" />
                        {recordDateLabel}
                      </span>
                      {record.contextSummary?.temperatureC !== undefined && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300">
                          {record.contextSummary.temperatureC}°C
                        </span>
                      )}
                      {record.contextSummary?.occasion && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                          {isEn
                            ? OCCASION_LABELS_EN[record.contextSummary.occasion]
                            : OCCASION_LABELS[record.contextSummary.occasion]}
                        </span>
                      )}
                      {record.totalScore && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {record.totalScore}%
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium text-zinc-200 truncate">
                      {record.outfitTitle}
                    </p>

                    {/* Miniature pieces in this worn outfit */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {record.garments.map((g) => (
                        <div
                          key={g.id}
                          title={`${g.name} (${g.wearCount || 0}× getragen)`}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-[11px]"
                        >
                          <GarmentVector
                            type={g.subcategory}
                            colorHex={g.colorHex}
                            accentColorHex={g.accentColorHex}
                            texture={g.texture}
                            neckline={g.neckline}
                            className="w-5 h-5 shrink-0"
                          />
                          <span className="text-zinc-300">{g.name}</span>
                          {(g.wearCount || 0) > 0 && (
                            <span className="text-[10px] text-amber-400 font-mono font-medium">
                              {g.wearCount}×
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {onDeleteWornRecord && (
                    <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-900">
                      <button
                        type="button"
                        onClick={() => handleDeleteHistoryRecord(record.id)}
                        title={
                          isEn
                            ? 'Remove this history entry & revert wear counts'
                            : 'Eintrag aus Historie entfernen & Zähler korrigieren'
                        }
                        aria-label={isEn ? 'Remove history entry' : 'Eintrag löschen'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer touch-manipulation active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sm:hidden">{isEn ? 'Remove' : 'Eintrag löschen'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Small Closable Explanation Popup Modal (Mobile Bottom-Sheet on small screens) */}
      {popupOutfit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="outfit-explanation-popup-title"
          onClick={() => setPopupOutfit(null)}
        >
          <div
            className="w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-zinc-950 border-t sm:border border-zinc-800 shadow-2xl flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/40">
              <div>
                <h3
                  id="outfit-explanation-popup-title"
                  className="text-sm font-semibold text-zinc-100"
                >
                  {isEn ? 'Why this outfit works' : 'Warum dieses Outfit zusammenpasst'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {customOutfitNames[popupOutfit.id] || getShortOutfitTitle(popupOutfit.items)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPopupOutfit(null)}
                aria-label={isEn ? 'Close popup' : 'Popup schließen'}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 cursor-pointer touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs font-mono tabular-nums">
                <span className="text-zinc-300 font-sans font-medium">
                  {isEn ? 'Overall Harmony:' : 'Gesamt-Harmonie:'}
                </span>
                <span className="text-emerald-400 font-semibold">
                  {popupOutfit.totalScore} / 100 {isEn ? 'Points' : 'Punkte'}
                </span>
              </div>

              <ul className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
                {popupOutfit.traces.map((trace, tIdx) => (
                  <li key={tIdx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-mono select-none">→</span>
                    <span>{trace}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
                <div className="p-2 rounded-lg bg-zinc-900/60">
                  <p className="text-[10px] text-zinc-400 font-sans">
                    {isEn ? 'Colors & Type' : 'Typ & Farben'}
                  </p>
                  <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                    {popupOutfit.breakdown.biometricBase}/35
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900/60">
                  <p className="text-[10px] text-zinc-400 font-sans">
                    {isEn ? 'Color Match' : 'Farbharmonie'}
                  </p>
                  <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                    {popupOutfit.breakdown.colorHarmony}/20
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900/60">
                  <p className="text-[10px] text-zinc-400 font-sans">
                    {isEn ? 'Cut & Fabric' : 'Schnitt & Stoff'}
                  </p>
                  <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                    {popupOutfit.breakdown.silhouetteBalance + popupOutfit.breakdown.textureContrast}/25
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 px-5 py-3 bg-zinc-900/50 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPopupOutfit(null)}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold cursor-pointer touch-manipulation active:scale-95"
              >
                {isEn ? 'Close' : 'Schließen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Outfit Preview Modal (opened via ?outfit= link) */}
      {incomingSharedOutfit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setIncomingSharedOutfit(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-zinc-950 border-t sm:border border-zinc-800 shadow-2xl flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                  {isEn ? 'Shared Outfit' : 'Geteilter Look'}
                </span>
                <h3 className="text-base font-bold text-zinc-100 mt-0.5">
                  {incomingSharedOutfit.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {incomingSharedOutfit.customOccasionName ||
                    (isEn
                      ? OCCASION_LABELS_EN[incomingSharedOutfit.occasion]
                      : OCCASION_LABELS[incomingSharedOutfit.occasion])}{' '}
                  · {incomingSharedOutfit.tempC}°C · {incomingSharedOutfit.score}% Match
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIncomingSharedOutfit(null);
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
              <div className="sm:col-span-5">
                <OutfitLayerStack
                  items={incomingSharedOutfit.garments}
                  profile={profile}
                  lockedGarmentIds={[]}
                  onToggleLock={() => {}}
                />
              </div>

              <div className="sm:col-span-7 space-y-2.5">
                {incomingSharedOutfit.garments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GarmentVector
                        type={item.subcategory}
                        colorHex={item.colorHex}
                        accentColorHex={item.accentColorHex}
                        pattern={item.pattern}
                        texture={item.texture}
                        neckline={item.neckline}
                        wornOpen={item.wornOpen}
                        className="w-9 h-9 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-100 truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {item.brand ? `${item.brand} · ` : ''}
                          {item.colorName} · {SUBCATEGORY_LABELS[item.subcategory]?.split(' (')[0]}
                        </p>
                      </div>
                    </div>

                    <a
                      href={buildBrandOrShopUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 hover:border-amber-400 text-[11px] font-medium text-amber-300 hover:text-amber-200 shrink-0"
                    >
                      <span>{isEn ? 'Shop' : 'Im Shop'}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0 px-5 py-3 bg-zinc-900/50 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIncomingSharedOutfit(null);
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                {isEn ? 'Close' : 'Schließen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Confirmation Toast when an outfit was just marked as worn */}
      {wornFeedbackId && latestWornBanner && latestWornBanner.outfit.id === wornFeedbackId && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-emerald-500/60 p-3.5 shadow-2xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-200 truncate">
                {isEn
                  ? `✓ "${latestWornBanner.outfitTitle}" worn today`
                  : `✓ „${latestWornBanner.outfitTitle}“ heute angezogen`}
              </p>
              <p className="text-[11px] text-zinc-400 truncate">
                {isEn
                  ? `+1× wear count${
                      latestWornBanner.laundryCount > 0
                        ? ` · ${latestWornBanner.laundryCount} in laundry`
                        : ''
                    }`
                  : `Zähler +1×${
                      latestWornBanner.laundryCount > 0
                        ? ` · ${latestWornBanner.laundryCount} ${
                            latestWornBanner.laundryCount === 1 ? 'Teil' : 'Teile'
                          } in der Wäsche`
                        : ''
                    }`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={scrollToWearHistory}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-[11px] font-medium text-zinc-200 cursor-pointer"
            >
              {isEn ? 'History ↓' : 'Historie ↓'}
            </button>
            <button
              type="button"
              onClick={() => setWornFeedbackId(null)}
              aria-label={isEn ? 'Close' : 'Schließen'}
              className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


