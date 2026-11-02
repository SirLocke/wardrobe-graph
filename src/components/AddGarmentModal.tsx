import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  CopyPlus,
  Palette,
  Plus,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  FIT_LABELS,
  getAllColorPresets,
  isSubcategoryAllowedForScope,
  loadCustomColors,
  NECKLINE_LABELS,
  normalizeWardrobeScopes,
  saveCustomColors,
  SMART_SUBCATEGORY_DEFAULTS,
  SUBCATEGORIES_BY_CATEGORY,
  SUBCATEGORY_LABELS,
  TextileColorPreset,
  TEXTURE_LABELS,
} from '../data/seedData';
import {
  buildDefaultGarmentName,
  COMMON_SIZE_SUGGESTIONS,
  getCategorySizeGroup,
  isDefaultGarmentName,
  POPULAR_BRANDS,
  suggestSizeForGarment,
  upsertBrandSizeRule,
} from '../engine/brandSizeMatcher';
import { classifyColorTemp, hexToHsl, scoreGarmentBiometrics } from '../engine/colorMath';
import {
  BiometricProfile,
  FitType,
  Garment,
  GarmentCategory,
  GarmentSubcategory,
  NecklineType,
  TextureType,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface AddGarmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BiometricProfile;
  onSaveGarment: (garment: Garment, keepOpenForDuplicate: boolean) => Promise<void>;
  onUpdateProfile?: (nextProfile: BiometricProfile) => Promise<void>;
  initialGarment?: Garment | null;
}

const THERMAL_LEVEL_OPTIONS: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string; shortLabel: string }> = [
  { value: 1, label: 'Sehr leicht (Sommer)', shortLabel: 'Sommer (>24°C)' },
  { value: 2, label: 'Mild (Frühling / Spätsommer)', shortLabel: 'Mild (18–23°C)' },
  { value: 3, label: 'Übergang (Herbst / Alltag)', shortLabel: 'Übergang (12–17°C)' },
  { value: 4, label: 'Warm (Kühle Tage)', shortLabel: 'Warm (5–11°C)' },
  { value: 5, label: 'Sehr warm (Winter)', shortLabel: 'Winter (<5°C)' },
];

const FORMALITY_LEVEL_OPTIONS: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { value: 1, label: 'Sport / Zuhause' },
  { value: 2, label: 'Lässig / Alltag' },
  { value: 3, label: 'Smart Casual / Büro' },
  { value: 4, label: 'Schick / Ausgehen' },
  { value: 5, label: 'Festlich / Formell' },
];

export const AddGarmentModal: React.FC<AddGarmentModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveGarment,
  onUpdateProfile,
  initialGarment,
}) => {
  const [name, setName] = useState('Hoodie Salbeigrün');
  const [hasCustomNameEdit, setHasCustomNameEdit] = useState(false);
  const [category, setCategory] = useState<GarmentCategory>('mid_layer');
  const [subcategory, setSubcategory] = useState<GarmentSubcategory>('hoodie');
  const [colorName, setColorName] = useState('Salbeigrün');
  const [colorHex, setColorHex] = useState('#8F9779');
  const [accentColorName, setAccentColorName] = useState('');
  const [accentColorHex, setAccentColorHex] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [fit, setFit] = useState<FitType>('relaxed');
  const [neckline, setNeckline] = useState<NecklineType>('hooded');
  const [texture, setTexture] = useState<TextureType>('heavy_jersey');
  const [thermalRating, setThermalRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [thermalRatings, setThermalRatings] = useState<Array<1 | 2 | 3 | 4 | 5>>([3]);
  const [formality, setFormality] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [formalities, setFormalities] = useState<Array<1 | 2 | 3 | 4 | 5>>([2]);
  const [waterResistant, setWaterResistant] = useState(false);
  const [isClean, setIsClean] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [ruleSavedNotice, setRuleSavedNotice] = useState<string | null>(null);

  // Easy custom color creator without hex jargon
  const [colorPresets, setColorPresets] = useState<TextileColorPreset[]>(() => getAllColorPresets());
  const [showNewColorCreator, setShowNewColorCreator] = useState(false);
  const [newCustomColorName, setNewCustomColorName] = useState('');
  const [newCustomColorHex, setNewCustomColorHex] = useState('#6B8E78');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeScopes = normalizeWardrobeScopes(profile);

  useEffect(() => {
    if (!isOpen) return;
    setColorPresets(getAllColorPresets());
    setDuplicateNotice(null);
    setRuleSavedNotice(null);
    setNameError(null);
    setShowNewColorCreator(false);
    setShowAdvancedDetails(Boolean(initialGarment));

    if (initialGarment) {
      setName(initialGarment.name);
      const isDefault = isDefaultGarmentName(
        initialGarment.name,
        initialGarment.subcategory,
        initialGarment.colorName,
        initialGarment.accentColorName
      );
      setHasCustomNameEdit(!isDefault);
      setCategory(initialGarment.category);
      setSubcategory(initialGarment.subcategory);
      setColorName(initialGarment.colorName);
      setColorHex(initialGarment.colorHex);
      setAccentColorName(initialGarment.accentColorName || '');
      setAccentColorHex(initialGarment.accentColorHex || '');
      setBrand(initialGarment.brand || '');
      setSize(
        initialGarment.size ||
          suggestSizeForGarment(initialGarment.category, initialGarment.brand, profile)
            .suggestedSize
      );
      setFit(initialGarment.fit);
      setNeckline(initialGarment.neckline);
      setTexture(initialGarment.texture);
      setThermalRating(initialGarment.thermalRating);
      setThermalRatings(
        initialGarment.thermalRatings && initialGarment.thermalRatings.length > 0
          ? initialGarment.thermalRatings
          : [initialGarment.thermalRating]
      );
      setFormality(initialGarment.formality);
      setFormalities(
        initialGarment.formalities && initialGarment.formalities.length > 0
          ? initialGarment.formalities
          : [initialGarment.formality]
      );
      setWaterResistant(initialGarment.waterResistant);
      setIsClean(initialGarment.isClean);
      setImageDataUrl(initialGarment.imageDataUrl);
    } else {
      const defaultSub: GarmentSubcategory = 't_shirt';
      const defaults = SMART_SUBCATEGORY_DEFAULTS[defaultSub];
      setCategory(defaults.category);
      setSubcategory(defaultSub);
      setColorName('Salbeigrün');
      setColorHex('#8F9779');
      setAccentColorName('');
      setAccentColorHex('');
      setBrand('');
      setSize(suggestSizeForGarment(defaults.category, '', profile).suggestedSize);
      setFit(defaults.fit);
      setNeckline(defaults.neckline);
      setTexture(defaults.texture);
      setThermalRating(defaults.thermalRating);
      setThermalRatings([defaults.thermalRating]);
      setFormality(defaults.formality);
      setFormalities([defaults.formality]);
      setWaterResistant(defaults.waterResistant);
      setIsClean(true);
      setImageDataUrl(undefined);
      setName('T-Shirt Salbeigrün');
      setHasCustomNameEdit(false);
    }
  }, [isOpen, initialGarment, profile]);

  useEffect(() => {
    if (!imageDataUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxDim = 220;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const applySubcategoryDefaults = (newSub: GarmentSubcategory, currentColorName: string) => {
    const defaults = SMART_SUBCATEGORY_DEFAULTS[newSub];
    const shouldAutoUpdateName =
      !hasCustomNameEdit &&
      isDefaultGarmentName(name, subcategory, colorName, accentColorName);

    const nextAccentName = defaults.category === 'footwear' ? accentColorName : '';
    const nextAccentHex = defaults.category === 'footwear' ? accentColorHex : '';

    setCategory(defaults.category);
    setSubcategory(newSub);
    setFit(defaults.fit);
    setNeckline(defaults.neckline);
    setTexture(defaults.texture);
    setThermalRating(defaults.thermalRating);
    setThermalRatings([defaults.thermalRating]);
    setFormality(defaults.formality);
    setFormalities([defaults.formality]);
    setWaterResistant(defaults.waterResistant);
    if (defaults.category !== 'footwear') {
      setAccentColorName('');
      setAccentColorHex('');
    }
    const suggestion = suggestSizeForGarment(defaults.category, brand, profile);
    if (suggestion.suggestedSize) {
      setSize(suggestion.suggestedSize);
    }
    if (shouldAutoUpdateName) {
      setName(
        buildDefaultGarmentName(newSub, currentColorName, nextAccentHex ? nextAccentName : undefined)
      );
    }
  };

  const handleCategoryChange = (newCat: GarmentCategory) => {
    setCategory(newCat);
    const allowedSubs = SUBCATEGORIES_BY_CATEGORY[newCat].filter((sub) =>
      isSubcategoryAllowedForScope(sub, activeScopes)
    );
    const defaultSub = allowedSubs[0] || SUBCATEGORIES_BY_CATEGORY[newCat][0];
    applySubcategoryDefaults(defaultSub, colorName);
  };

  const handleSubcategoryChange = (newSub: GarmentSubcategory) => {
    applySubcategoryDefaults(newSub, colorName);
  };

  const handleBrandChange = (nextBrand: string) => {
    setBrand(nextBrand);
    setRuleSavedNotice(null);
    const suggestion = suggestSizeForGarment(category, nextBrand, profile);
    if (suggestion.suggestedSize) {
      setSize(suggestion.suggestedSize);
    }
  };

  const handleRememberBrandSizeRule = async () => {
    if (!brand.trim() || !size.trim() || !onUpdateProfile) return;
    const nextRules = upsertBrandSizeRule(profile.brandSizeRules, {
      brand: brand.trim(),
      size: size.trim(),
      categoryGroup: 'all',
    });
    await onUpdateProfile({
      ...profile,
      brandSizeRules: nextRules,
    });
    setRuleSavedNotice(`Gemerkte Regel: Bei ${brand.trim()} immer Größe ${size.trim()}`);
  };

  const handleSelectColorPreset = (presetName: string, presetHex: string) => {
    const cleanColorName = presetName.replace(' (Test)', '');
    const shouldAutoUpdateName =
      !hasCustomNameEdit &&
      isDefaultGarmentName(name, subcategory, colorName, accentColorName);
    setColorName(cleanColorName);
    setColorHex(presetHex);
    if (shouldAutoUpdateName) {
      setName(
        buildDefaultGarmentName(
          subcategory,
          cleanColorName,
          accentColorHex ? accentColorName : undefined
        )
      );
    }
  };

  const handleSelectAccentColorPreset = (presetName: string, presetHex: string) => {
    const cleanAccentName = presetName ? presetName.replace(' (Test)', '') : '';
    const shouldAutoUpdateName =
      !hasCustomNameEdit &&
      isDefaultGarmentName(name, subcategory, colorName, accentColorName);
    setAccentColorName(cleanAccentName);
    setAccentColorHex(presetHex);
    if (shouldAutoUpdateName) {
      setName(
        buildDefaultGarmentName(
          subcategory,
          colorName,
          presetHex ? cleanAccentName : undefined
        )
      );
    }
  };

  const toggleThermalRatingOption = (val: 1 | 2 | 3 | 4 | 5) => {
    setThermalRatings((prev) => {
      const exists = prev.includes(val);
      const next = exists
        ? prev.length > 1
          ? prev.filter((item) => item !== val)
          : prev
        : [...prev, val].sort((a, b) => a - b);
      setThermalRating(next[0]);
      return next;
    });
  };

  const toggleFormalityOption = (val: 1 | 2 | 3 | 4 | 5) => {
    setFormalities((prev) => {
      const exists = prev.includes(val);
      const next = exists
        ? prev.length > 1
          ? prev.filter((item) => item !== val)
          : prev
        : [...prev, val].sort((a, b) => a - b);
      setFormality(next[0]);
      return next;
    });
  };

  const handleAddCustomColor = () => {
    const trimmed = newCustomColorName.trim() || 'Meine Wunschfarbe';
    const customList = loadCustomColors();
    const newPreset: TextileColorPreset = {
      name: trimmed,
      hex: newCustomColorHex.toUpperCase(),
      group: 'Accent',
    };
    const updated = [newPreset, ...customList.filter((c) => c.name !== trimmed)];
    saveCustomColors(updated);
    setColorPresets(getAllColorPresets());
    handleSelectColorPreset(newPreset.name, newPreset.hex);
    setNewCustomColorName('');
    setShowNewColorCreator(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex =
      '#' +
      [pixel[0], pixel[1], pixel[2]]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    setColorHex(hex);
    setColorName('Farbe aus Foto');
  };

  const liveComputation = useMemo(() => {
    const hsl = hexToHsl(colorHex);
    const colorTemp = classifyColorTemp(hsl);
    const bio = scoreGarmentBiometrics(
      {
        category,
        colorName,
        colorHex,
        hsl,
        colorTemp,
        neckline,
        texture,
      },
      profile
    );
    return { hsl, colorTemp, bio };
  }, [category, colorName, colorHex, neckline, texture, profile]);

  const sizeSuggestionInfo = useMemo(() => {
    return suggestSizeForGarment(category, brand, profile);
  }, [category, brand, profile]);

  const availableSubcategories = useMemo(() => {
    const filtered = SUBCATEGORIES_BY_CATEGORY[category].filter((sub) =>
      isSubcategoryAllowedForScope(sub, activeScopes)
    );
    return filtered.length > 0 ? filtered : SUBCATEGORIES_BY_CATEGORY[category];
  }, [category, activeScopes]);

  if (!isOpen) return null;

  const submitForm = async (keepOpenForDuplicate: boolean) => {
    if (!name.trim()) {
      setNameError('Bitte gib eine Bezeichnung für das Kleidungsstück ein.');
      return;
    }
    setNameError(null);

    const isAccessory = category === 'accessory';
    const isFootwear = category === 'footwear';

    const newGarment: Garment = {
      id:
        initialGarment && !keepOpenForDuplicate
          ? initialGarment.id
          : `garment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      category,
      subcategory,
      colorName: colorName.trim() || 'Wunschfarbe',
      colorHex,
      accentColorName:
        isFootwear && accentColorHex ? accentColorName.trim() || 'Akzent' : undefined,
      accentColorHex: isFootwear && accentColorHex ? accentColorHex : undefined,
      hsl: liveComputation.hsl,
      colorTemp: liveComputation.colorTemp,
      fit: isAccessory ? 'regular' : fit,
      neckline:
        category === 'bottom' || category === 'footwear' || category === 'accessory'
          ? 'none'
          : neckline,
      texture,
      thermalRating: isAccessory ? 3 : thermalRatings[0] || thermalRating,
      thermalRatings: isAccessory ? undefined : thermalRatings,
      formality: isAccessory ? 3 : formalities[0] || formality,
      formalities: isAccessory ? undefined : formalities,
      waterResistant,
      isClean,
      imageDataUrl,
      brand: brand.trim() || undefined,
      size: size.trim() || undefined,
    };

    await onSaveGarment(newGarment, keepOpenForDuplicate);

    if (keepOpenForDuplicate) {
      setDuplicateNotice(
        `"${newGarment.name}" wurde gespeichert! Tippe einfach auf die nächste Farbe für ein weiteres Teil.`
      );
    } else {
      onClose();
    }
  };

  const fitVerdictText =
    liveComputation.bio.score >= 82
      ? 'Super Match für deinen Farbtyp'
      : liveComputation.bio.score >= 65
      ? 'Gute Kombi-Farbe'
      : 'Starker Kontrast zu deinem Typ';

  const scoreToneClass =
    liveComputation.bio.score >= 82
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
      : liveComputation.bio.score >= 65
      ? 'text-amber-300 border-amber-500/30 bg-amber-950/20'
      : 'text-rose-400 border-rose-500/30 bg-rose-950/20';

  const sizePills = COMMON_SIZE_SUGGESTIONS[getCategorySizeGroup(category)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto sm:overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-garment-title"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-3xl rounded-none sm:rounded-2xl bg-zinc-950 border-0 sm:border sm:border-zinc-800 shadow-2xl my-0 sm:my-8 overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="shrink-0 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
          <div>
            <h2 id="modal-garment-title" className="text-base sm:text-lg font-semibold text-zinc-100">
              {initialGarment ? 'Kleidungsstück anpassen' : 'Kleidungsstück einfach hinzufügen'}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
              1. Schnitt antippen · 2. Farbe wählen · 3. Optional Marke &amp; Größe · Fertig!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Modal schließen"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors touch-manipulation cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {duplicateNotice && (
          <div className="mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between">
            <span>{duplicateNotice}</span>
            <button
              type="button"
              onClick={() => setDuplicateNotice(null)}
              className="text-emerald-400 hover:text-emerald-200 ml-3 py-1 px-2"
            >
              OK
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top Preview Row */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="w-24 h-24 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-center shrink-0">
              <GarmentVector
                type={subcategory}
                colorHex={colorHex}
                accentColorHex={category === 'footwear' && accentColorHex ? accentColorHex : undefined}
                texture={texture}
                className="w-20 h-20"
              />
            </div>
            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-400">
                  Bezeichnung im Kleiderschrank
                  {hasCustomNameEdit && (
                    <span className="ml-2 text-[10px] text-amber-400/90 font-normal">
                      (Eigener Name bleibt bei Typwechsel erhalten)
                    </span>
                  )}
                </span>
                <span className={`px-2.5 py-0.5 rounded-md border text-[11px] font-medium ${scoreToneClass}`}>
                  {fitVerdictText} ({liveComputation.bio.score}%)
                </span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setName(nextVal);
                  setHasCustomNameEdit(
                    !isDefaultGarmentName(nextVal, subcategory, colorName, accentColorName)
                  );
                }}
                placeholder="z.B. Hoodie Salbeigrün"
                className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              {nameError && <p className="text-xs text-rose-400">{nameError}</p>}
              {liveComputation.bio.reasons?.[0] && (
                <p className="text-xs text-zinc-400">{liveComputation.bio.reasons[0]}</p>
              )}
            </div>
          </div>

          {/* STEP 1: Was ist es? (Category + Visual Silhouette Grid) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                1. Was möchtest du hinzufügen?
              </label>
              <span className="text-[11px] text-zinc-500">
                {category === 'accessory'
                  ? 'Accessoires passen flexibel zu jedem Anlass'
                  : 'Wärme, Stoff & Anlass werden automatisch passend vorbelegt'}
              </span>
            </div>

            {/* Category Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
              {(Object.keys(CATEGORY_LABELS) as GarmentCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    category === cat
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat].split(' (')[0]}
                </button>
              ))}
            </div>

            {/* Visual Subcategory Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {availableSubcategories.map((sub) => {
                const isSelected = subcategory === sub;
                const cleanLabel = SUBCATEGORY_LABELS[sub].split(' (')[0];
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleSubcategoryChange(sub)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 text-zinc-100 ring-1 ring-amber-500/30'
                        : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-center shrink-0">
                      <GarmentVector
                        type={sub}
                        colorHex={isSelected ? colorHex : '#A1A1AA'}
                        accentColorHex={
                          isSelected && category === 'footwear' && accentColorHex
                            ? accentColorHex
                            : undefined
                        }
                        texture={SMART_SUBCATEGORY_DEFAULTS[sub].texture}
                        className="w-8 h-8"
                      />
                    </div>
                    <span className="text-xs font-medium leading-tight line-clamp-2">
                      {cleanLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Welche Farbe hat es? (Visual Color Swatches + Easy Custom Color Creator) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                2. {category === 'footwear' ? 'Grundfarbe des Schuhs' : 'Welche Farbe hat es?'}{' '}
                <span className="text-amber-400 ml-1">({colorName})</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNewColorCreator((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-amber-300 hover:border-amber-500/50 transition-colors cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                {showNewColorCreator ? 'Schließen' : '+ Eigene Farbe mischen'}
              </button>
            </div>

            {showNewColorCreator && (
              <div className="p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 space-y-3">
                <p className="text-xs font-medium text-zinc-200">
                  Neue Wunschfarbe zur Farbpalette hinzufügen (ohne Technik-Codes):
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer shrink-0">
                    <input
                      type="color"
                      value={newCustomColorHex}
                      onChange={(e) => setNewCustomColorHex(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-xs text-zinc-300">Farbton antippen</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomColorName}
                    onChange={(e) => setNewCustomColorName(e.target.value)}
                    placeholder="Farbname (z.B. Eisblau, Senfgelb, Flieder...)"
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomColor}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Farbe speichern &amp; wählen
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {colorPresets.map((preset) => {
                const isSelected = colorHex.toUpperCase() === preset.hex.toUpperCase();
                return (
                  <button
                    key={`${preset.name}_${preset.hex}`}
                    type="button"
                    onClick={() => handleSelectColorPreset(preset.name, preset.hex)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 border-amber-400 text-zinc-100 ring-1 ring-amber-400/40'
                        : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span className="text-[11px] font-medium truncate">
                      {preset.name.replace(' (Test)', '')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Shoe Accent Color Picker (for white/neutral shoes with colored stripes, heel tab, logo, or gusset) */}
            {category === 'footwear' && (
              <div className="mt-4 pt-3.5 border-t border-zinc-800/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      Farbige Akzente am Schuh (Optional – z. B. Streifen, Ferse, Logo)
                    </span>
                    {accentColorHex && (
                      <span className="text-amber-400">({accentColorName})</span>
                    )}
                  </label>
                  {accentColorHex && (
                    <button
                      type="button"
                      onClick={() => handleSelectAccentColorPreset('', '')}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                    >
                      Akzent entfernen (Einfarbig)
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectAccentColorPreset('', '')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                      !accentColorHex
                        ? 'bg-zinc-800 border-amber-400 text-zinc-100 ring-1 ring-amber-400/40'
                        : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-dashed border-zinc-500 shrink-0" />
                    <span className="text-[11px] font-medium truncate">Einfarbig</span>
                  </button>

                  {colorPresets.map((preset) => {
                    const isSelected =
                      Boolean(accentColorHex) &&
                      accentColorHex.toUpperCase() === preset.hex.toUpperCase();
                    return (
                      <button
                        key={`accent_${preset.name}_${preset.hex}`}
                        type="button"
                        onClick={() => handleSelectAccentColorPreset(preset.name, preset.hex)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800 border-amber-400 text-zinc-100 ring-1 ring-amber-400/40'
                            : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="text-[11px] font-medium truncate">
                          {preset.name.replace(' (Test)', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: Marke & Größe (Optional – mit automatischem Größen-Vorschlag) */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                3. Marke &amp; Größe (Optional)
              </label>
              {sizeSuggestionInfo.reasonDe && (
                <span className="text-[11px] text-amber-300 font-medium">
                  {sizeSuggestionInfo.reasonDe}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Brand Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">
                  Marke (z.B. Nike, Adidas, Levi&apos;s, Zara)
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  placeholder="Marke eingeben oder unten antippen..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_BRANDS.slice(0, 9).map((b) => {
                    const active = brand.toLowerCase() === b.toLowerCase();
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => handleBrandChange(active ? '' : b)}
                        className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400 flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5 text-zinc-500" />
                  Größe (wird automatisch vorgeschlagen)
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => {
                    setSize(e.target.value);
                    setRuleSavedNotice(null);
                  }}
                  placeholder="z.B. M, L, 38, 42, W32/L32..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {sizePills.map((s) => {
                    const active = size.toUpperCase() === s.toUpperCase();
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {brand.trim() && size.trim() && onUpdateProfile && (
              <div className="pt-2 border-t border-zinc-800/70 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleRememberBrandSizeRule}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>
                    Merken: „Bei {brand.trim()} habe ich immer Größe {size.trim()}“
                  </span>
                </button>
                {ruleSavedNotice && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    ✓ {ruleSavedNotice}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* STEP 4 (OPTIONAL): Erweiterte Details (Schnitt, Stoff, Dicke, Foto) */}
          <div className="border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvancedDetails((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                {category === 'accessory'
                  ? 'Details feinjustieren (Material & Foto) – Optional'
                  : 'Details feinjustieren (Passform, Stoff, Wetter, Anlass & Foto) – Optional'}
              </span>
              {showAdvancedDetails ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {showAdvancedDetails && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60 space-y-4">
                {category === 'accessory' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Material / Oberfläche
                      </label>
                      <select
                        value={texture}
                        onChange={(e) => setTexture(e.target.value as TextureType)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                      >
                        {(Object.keys(TEXTURE_LABELS) as TextureType[]).map((t) => (
                          <option key={t} value={t}>
                            {TEXTURE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-zinc-400 bg-zinc-950/60 border border-zinc-800/70 rounded-lg px-3 py-2.5">
                      Für Accessoires musst du keine Wärme-Stufe und keinen Stil-Anlass einordnen – sie werden automatisch flexibel zu deinen Outfits kombiniert.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Passform (Schnitt)
                        </label>
                        <select
                          value={fit}
                          onChange={(e) => setFit(e.target.value as FitType)}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        >
                          {(Object.keys(FIT_LABELS) as FitType[]).map((f) => (
                            <option key={f} value={f}>
                              {FIT_LABELS[f]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {category !== 'bottom' && category !== 'footwear' && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Kragen / Ausschnitt
                          </label>
                          <select
                            value={neckline}
                            onChange={(e) => setNeckline(e.target.value as NecklineType)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                          >
                            {(Object.keys(NECKLINE_LABELS) as NecklineType[])
                              .filter((n) => n !== 'none')
                              .map((n) => (
                                <option key={n} value={n}>
                                  {NECKLINE_LABELS[n]}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Material / Oberfläche
                        </label>
                        <select
                          value={texture}
                          onChange={(e) => setTexture(e.target.value as TextureType)}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        >
                          {(Object.keys(TEXTURE_LABELS) as TextureType[]).map((t) => (
                            <option key={t} value={t}>
                              {TEXTURE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Multi-select Thermal Rating */}
                      <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300 font-medium">
                            Wärme-Stufe <span className="text-zinc-500 font-normal">(Mehrfachauswahl möglich)</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {THERMAL_LEVEL_OPTIONS.map((opt) => {
                            const active = thermalRatings.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleThermalRatingOption(opt.value)}
                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {active ? '✓ ' : ''}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Multi-select Formality */}
                      <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300 font-medium">
                            Stil-Anlass <span className="text-zinc-500 font-normal">(Mehrfachauswahl möglich)</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FORMALITY_LEVEL_OPTIONS.map((opt) => {
                            const active = formalities.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleFormalityOption(opt.value)}
                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {active ? '✓ ' : ''}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setWaterResistant((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        waterResistant
                          ? 'bg-sky-950/50 border-sky-500/50 text-sky-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {waterResistant ? '✓ Wasserabweisend (Regenfest)' : 'Nicht wasserabweisend'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsClean((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        isClean
                          ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                          : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                      }`}
                    >
                      {isClean ? '✓ Frisch gewaschen' : 'In der Wäsche'}
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-300 hover:border-zinc-600 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Foto hochladen (Farbe antippen)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {imageDataUrl && (
                  <div className="flex items-center gap-4 pt-2">
                    <canvas
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      className="rounded-lg border border-zinc-700 cursor-crosshair max-h-36"
                      title="Klicke auf eine Stelle im Foto, um die Farbe zu übernehmen"
                    />
                    <div className="text-xs text-zinc-400 space-y-1">
                      <p className="text-zinc-200 font-medium">Foto-Farbwähler aktiv</p>
                      <p>Tippe direkt ins Foto, um die genaue Kleidungsfarbe zu übernehmen.</p>
                      <button
                        type="button"
                        onClick={() => setImageDataUrl(undefined)}
                        className="text-rose-400 hover:text-rose-300 underline"
                      >
                        Foto entfernen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Sticky Bottom Action Bar (Thumb Zone) */}
        <div className="shrink-0 sticky bottom-0 z-10 px-4 sm:px-6 py-3.5 sm:py-4 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[42px] rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors text-center cursor-pointer touch-manipulation"
          >
            Abbrechen
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {!initialGarment && (
              <button
                type="button"
                onClick={() => submitForm(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:border-amber-500/60 hover:text-amber-300 transition-colors cursor-pointer touch-manipulation active:scale-95"
              >
                <CopyPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Speichern &amp; noch eine Farbe</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => submitForm(false)}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 text-zinc-950 text-xs font-semibold hover:bg-white transition-colors cursor-pointer touch-manipulation active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{initialGarment ? 'Änderungen speichern' : 'In den Kleiderschrank legen'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
