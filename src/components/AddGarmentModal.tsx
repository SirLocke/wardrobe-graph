import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  CopyPlus,
  Edit3,
  Palette,
  Plus,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  canGarmentUseLaundry,
  CATEGORY_LABELS,
  FIT_LABELS,
  getAllColorPresets,
  isSubcategoryAllowedForScope,
  loadCustomColors,
  NECKLINE_LABELS,
  normalizeWardrobeScopes,
  PATTERN_LABELS,
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
  getFrequentAndPopularBrands,
  isDefaultGarmentName,
  suggestSizeForGarment,
  upsertBrandSizeRule,
} from '../engine/brandSizeMatcher';
import { classifyColorTemp, hexToHsl, scoreGarmentBiometrics } from '../engine/colorMath';
import {
  classifyHexColorGroup,
  hexToGermanColorName,
  inferColorFromGarmentName,
  translateColorName,
} from '../engine/colorNaming';
import {
  AppLocale,
  BiometricProfile,
  FitType,
  Garment,
  GarmentCategory,
  GarmentPattern,
  GarmentSubcategory,
  NecklineType,
  TextureType,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface AddGarmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BiometricProfile;
  garments?: Garment[];
  locale?: AppLocale;
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
  garments,
  locale = 'de',
  onSaveGarment,
  onUpdateProfile,
  initialGarment,
}) => {
  const isEn = locale === 'en';
  const defaultColorLabel = isEn ? 'Sage Green' : 'Salbeigrün';
  const [name, setName] = useState(`T-Shirt ${defaultColorLabel}`);
  const [hasCustomNameEdit, setHasCustomNameEdit] = useState(false);
  const [category, setCategory] = useState<GarmentCategory>('base_top');
  const [subcategory, setSubcategory] = useState<GarmentSubcategory>('t_shirt');
  const [colorName, setColorName] = useState(defaultColorLabel);
  const [colorHex, setColorHex] = useState('#8F9779');
  const [accentColorName, setAccentColorName] = useState('');
  const [accentColorHex, setAccentColorHex] = useState('');
  const [pattern, setPattern] = useState<GarmentPattern>('solid');
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
  const [rainproof, setRainproof] = useState(false);
  const [windproof, setWindproof] = useState(false);
  const [hasPrint, setHasPrint] = useState(false);
  const [hasLogo, setHasLogo] = useState(false);
  const [isClean, setIsClean] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [ruleSavedNotice, setRuleSavedNotice] = useState<string | null>(null);

  // Custom colors synced with profile + localStorage
  const [customColors, setCustomColors] = useState<TextileColorPreset[]>(() =>
    loadCustomColors(profile)
  );
  const [colorPresets, setColorPresets] = useState<TextileColorPreset[]>(() =>
    getAllColorPresets(profile)
  );
  const [showNewColorCreator, setShowNewColorCreator] = useState(false);
  const [newCustomColorName, setNewCustomColorName] = useState(() =>
    hexToGermanColorName('#6B8E78', locale).name
  );
  const [newCustomColorHex, setNewCustomColorHex] = useState('#6B8E78');
  const [hasManualCustomColorName, setHasManualCustomColorName] = useState(false);
  const [editingCustomColorOriginalName, setEditingCustomColorOriginalName] = useState<string | null>(
    null
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeScopes = normalizeWardrobeScopes(profile);

  useEffect(() => {
    if (!isOpen) return;
    const loadedCustom = loadCustomColors(profile);
    setCustomColors(loadedCustom);
    setColorPresets(getAllColorPresets(profile));
    setDuplicateNotice(null);
    setRuleSavedNotice(null);
    setNameError(null);
    setShowNewColorCreator(false);
    setEditingCustomColorOriginalName(null);
    setHasManualCustomColorName(false);
    setShowAdvancedDetails(Boolean(initialGarment));

    if (!hasManualCustomColorName) {
      setNewCustomColorName(hexToGermanColorName('#6B8E78', locale).name);
    }

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
      setColorName(translateColorName(initialGarment.colorName, locale, initialGarment.colorHex));
      setColorHex(initialGarment.colorHex);
      setAccentColorName(
        initialGarment.accentColorName
          ? translateColorName(initialGarment.accentColorName, locale, initialGarment.accentColorHex)
          : ''
      );
      setAccentColorHex(initialGarment.accentColorHex || '');
      setPattern(initialGarment.pattern || 'solid');
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
      const isRainproofInit = Boolean(
        initialGarment.rainproof ||
          initialGarment.waterResistant ||
          initialGarment.texture === 'tech_waterproof' ||
          initialGarment.subcategory === 'rain_jacket'
      );
      setWaterResistant(Boolean(initialGarment.waterResistant || isRainproofInit));
      setRainproof(Boolean(initialGarment.rainproof || initialGarment.subcategory === 'rain_jacket' || initialGarment.texture === 'tech_waterproof'));
      setWindproof(Boolean(initialGarment.windproof));
      setHasPrint(Boolean(initialGarment.hasPrint));
      setHasLogo(Boolean(initialGarment.hasLogo));
      setIsClean(
        canGarmentUseLaundry(initialGarment) ? initialGarment.isClean : true
      );
      setImageDataUrl(initialGarment.imageDataUrl);
    } else {
      const defaultSub: GarmentSubcategory = 't_shirt';
      const defaults = SMART_SUBCATEGORY_DEFAULTS[defaultSub];
      const initColor = hexToGermanColorName('#8F9779', locale).name;
      setCategory(defaults.category);
      setSubcategory(defaultSub);
      setColorName(initColor);
      setColorHex('#8F9779');
      setAccentColorName('');
      setAccentColorHex('');
      setPattern('solid');
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
      setRainproof(Boolean(defaults.rainproof));
      setWindproof(Boolean(defaults.windproof));
      setHasPrint(false);
      setHasLogo(false);
      setIsClean(true);
      setImageDataUrl(undefined);
      setName(`T-Shirt ${initColor}`);
      setHasCustomNameEdit(false);
    }
  }, [isOpen, initialGarment, profile, locale]);

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

    const supportsAccent =
      defaults.category === 'footwear' || defaults.category === 'bottom';
    const nextAccentName = supportsAccent ? accentColorName : '';
    const nextAccentHex = supportsAccent ? accentColorHex : '';
    const isRain = Boolean(
      defaults.rainproof ||
        defaults.waterResistant ||
        defaults.texture === 'tech_waterproof' ||
        newSub === 'rain_jacket'
    );

    setCategory(defaults.category);
    setSubcategory(newSub);
    setFit(defaults.fit);
    setNeckline(defaults.neckline);
    setTexture(defaults.texture);
    setThermalRating(defaults.thermalRating);
    setThermalRatings([defaults.thermalRating]);
    setFormality(defaults.formality);
    setFormalities([defaults.formality]);
    setWaterResistant(isRain);
    setRainproof(Boolean(defaults.rainproof || newSub === 'rain_jacket' || defaults.texture === 'tech_waterproof'));
    setWindproof(Boolean(defaults.windproof));
    setHasPrint(false);
    setHasLogo(false);
    if (!canGarmentUseLaundry({ category: defaults.category, subcategory: newSub })) {
      setIsClean(true);
    }
    if (!supportsAccent) {
      setAccentColorName('');
      setAccentColorHex('');
    }
    if (defaults.category === 'accessory' || defaults.category === 'footwear') {
      setPattern('solid');
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
    const cleanColorName = translateColorName(presetName.replace(' (Test)', ''), locale, presetHex);
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
    const cleanAccentName = presetName
      ? translateColorName(presetName.replace(' (Test)', ''), locale, presetHex)
      : '';
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

  const syncCustomColors = async (updatedList: TextileColorPreset[]) => {
    saveCustomColors(updatedList);
    setCustomColors(updatedList);
    const nextProfile: BiometricProfile = {
      ...profile,
      customColors: updatedList,
    };
    setColorPresets(getAllColorPresets(nextProfile));
    if (onUpdateProfile) {
      await onUpdateProfile(nextProfile);
    }
  };

  const handleAddOrUpdateCustomColor = async () => {
    const autoName = hexToGermanColorName(newCustomColorHex, locale).name;
    const trimmed =
      newCustomColorName.trim() || autoName || (isEn ? 'Custom Color' : 'Wunschfarbe');
    const newPreset: TextileColorPreset = {
      name: trimmed,
      hex: newCustomColorHex.toUpperCase(),
      group: classifyHexColorGroup(newCustomColorHex),
    };
    const filtered = customColors.filter(
      (c) =>
        c.name.toLowerCase() !== trimmed.toLowerCase() &&
        (!editingCustomColorOriginalName ||
          c.name.toLowerCase() !== editingCustomColorOriginalName.toLowerCase())
    );
    const updated = [newPreset, ...filtered];
    await syncCustomColors(updated);
    handleSelectColorPreset(newPreset.name, newPreset.hex);
    setEditingCustomColorOriginalName(null);
    setHasManualCustomColorName(false);
    setNewCustomColorName(hexToGermanColorName(newCustomColorHex, locale).name);
    setShowNewColorCreator(false);
  };

  const handleStartEditCustomColor = (preset: TextileColorPreset) => {
    setEditingCustomColorOriginalName(preset.name);
    setNewCustomColorHex(preset.hex);
    setNewCustomColorName(preset.name);
    setHasManualCustomColorName(true);
    setShowNewColorCreator(true);
  };

  const handleDeleteCustomColor = async (nameToDelete: string) => {
    const updated = customColors.filter(
      (c) => c.name.toLowerCase() !== nameToDelete.toLowerCase()
    );
    await syncCustomColors(updated);
    if (editingCustomColorOriginalName === nameToDelete) {
      setEditingCustomColorOriginalName(null);
    }
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
    const translated = hexToGermanColorName(hex, locale);
    handleSelectColorPreset(translated.name, hex);
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

  const brandSuggestions = useMemo(
    () => getFrequentAndPopularBrands(garments, profile),
    [garments, profile]
  );

  if (!isOpen) return null;

  const submitForm = async (keepOpenForDuplicate: boolean) => {
    if (!name.trim()) {
      setNameError('Bitte gib eine Bezeichnung für das Kleidungsstück ein.');
      return;
    }
    setNameError(null);

    // If the user opened the custom color creator and picked a color without clicking "Farbe speichern",
    // or if they typed a color name in the title (e.g. "Schwarze Winterjacke") while leaving default Salbeigrün (#8F9779),
    // automatically apply the matching color so the garment is never saved with a mismatched color.
    let finalColorHex = colorHex;
    let finalColorName = colorName.trim() || hexToGermanColorName(colorHex, locale).name;

    if (showNewColorCreator && newCustomColorHex) {
      finalColorHex = newCustomColorHex.toUpperCase();
      finalColorName =
        newCustomColorName.trim() || hexToGermanColorName(newCustomColorHex, locale).name;
    } else if (finalColorHex.toUpperCase() === '#8F9779') {
      const inferredFromTitle = inferColorFromGarmentName(name.trim(), locale);
      if (inferredFromTitle && inferredFromTitle.hex.toUpperCase() !== '#8F9779') {
        finalColorHex = inferredFromTitle.hex;
        finalColorName = inferredFromTitle.name;
      }
    }

    const finalHsl = hexToHsl(finalColorHex);
    const finalColorTemp = classifyColorTemp(finalHsl);

    const isAccessory = category === 'accessory';
    const supportsAccent = category === 'footwear' || category === 'bottom';
    const supportsPattern =
      category === 'bottom' ||
      category === 'base_top' ||
      category === 'mid_layer' ||
      category === 'outerwear';
    const laundryAllowed = canGarmentUseLaundry({ category, subcategory });
    const effectiveWaterResistant = Boolean(
      waterResistant ||
        rainproof ||
        texture === 'tech_waterproof' ||
        subcategory === 'rain_jacket'
    );
    const effectiveRainproof = Boolean(
      rainproof || subcategory === 'rain_jacket' || texture === 'tech_waterproof'
    );

    const newGarment: Garment = {
      id:
        initialGarment && !keepOpenForDuplicate
          ? initialGarment.id
          : `garment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      category,
      subcategory,
      colorName: finalColorName,
      colorHex: finalColorHex,
      accentColorName:
        supportsAccent && accentColorHex ? accentColorName.trim() || 'Akzent' : undefined,
      accentColorHex: supportsAccent && accentColorHex ? accentColorHex : undefined,
      pattern: supportsPattern && pattern !== 'solid' ? pattern : undefined,
      hsl: finalHsl,
      colorTemp: finalColorTemp,
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
      waterResistant: effectiveWaterResistant,
      rainproof: effectiveRainproof ? true : undefined,
      windproof: windproof ? true : undefined,
      hasPrint:
        (category === 'base_top' || category === 'mid_layer') && hasPrint ? true : undefined,
      hasLogo:
        (category === 'base_top' || category === 'mid_layer') && hasLogo ? true : undefined,
      isClean: laundryAllowed ? isClean : true,
      imageDataUrl,
      brand: brand.trim() || undefined,
      size: size.trim() || undefined,
      wearCount: initialGarment && !keepOpenForDuplicate ? initialGarment.wearCount : undefined,
      lastWornDate:
        initialGarment && !keepOpenForDuplicate ? initialGarment.lastWornDate : undefined,
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
  const laundrySupported = canGarmentUseLaundry({ category, subcategory });
  const supportsAccentColor = category === 'footwear' || category === 'bottom';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto sm:overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-garment-title"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-3xl rounded-none sm:rounded-2xl bg-zinc-950 border-0 sm:border sm:border-zinc-800 shadow-2xl my-0 sm:my-8 overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="shrink-0 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 pt-[max(0.875rem,env(safe-area-inset-top,0px))] border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
          <div>
            <h2 id="modal-garment-title" className="text-base sm:text-lg font-semibold text-zinc-100">
              {initialGarment ? 'Kleidungsstück anpassen' : 'Kleidungsstück einfach hinzufügen'}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
              1. Schnitt antippen · 2. Farbe wählen · 3. Optional Eigenschaften, Marke &amp; Größe · Fertig!
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
                accentColorHex={supportsAccentColor && accentColorHex ? accentColorHex : undefined}
                pattern={pattern}
                texture={texture}
                neckline={neckline}
                hasPrint={hasPrint}
                hasLogo={hasLogo}
                className="w-20 h-20"
              />
            </div>
            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-400">
                  Bezeichnung im Kleiderschrank
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
                  if (colorHex.toUpperCase() === '#8F9779') {
                    const inferred = inferColorFromGarmentName(nextVal, locale);
                    if (inferred && inferred.hex.toUpperCase() !== '#8F9779') {
                      setColorHex(inferred.hex);
                      setColorName(inferred.name);
                    }
                  }
                }}
                placeholder={isEn ? 'e.g. Hoodie Sage Green' : 'z.B. Hoodie Salbeigrün'}
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
                1. Kategorie &amp; Schnitt
              </label>
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

          {/* STEP 2: Welche Farbe hat es? (Visual Color Swatches + Custom Color Manager) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                2.{' '}
                {category === 'footwear'
                  ? isEn
                    ? 'Primary shoe color'
                    : 'Grundfarbe des Schuhs'
                  : isEn
                  ? 'Color'
                  : 'Welche Farbe hat es?'}{' '}
                <span className="text-amber-400 ml-1">
                  ({translateColorName(colorName, locale, colorHex)})
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowNewColorCreator((v) => !v);
                  setEditingCustomColorOriginalName(null);
                  setHasManualCustomColorName(false);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-amber-300 hover:border-amber-500/50 transition-colors cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                {showNewColorCreator
                  ? isEn
                    ? 'Close'
                    : 'Schließen'
                  : isEn
                  ? '+ Custom Colors'
                  : '+ Eigene Farben verwalten'}
              </button>
            </div>

            {showNewColorCreator && (
              <div className="p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-zinc-200">
                    {editingCustomColorOriginalName
                      ? isEn
                        ? `Edit custom color "${editingCustomColorOriginalName}":`
                        : `Eigene Farbe „${editingCustomColorOriginalName}“ bearbeiten:`
                      : isEn
                      ? 'Add new color to palette:'
                      : 'Neue Farbe zur Farbpalette hinzufügen:'}
                  </p>
                  <span className="text-[11px] text-amber-300/90">
                    {isEn ? 'Detected shade:' : 'Erkannter Farbton:'}{' '}
                    <strong>{hexToGermanColorName(newCustomColorHex, locale).name}</strong>
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer shrink-0">
                    <input
                      type="color"
                      value={newCustomColorHex}
                      onChange={(e) => {
                        const nextHex = e.target.value;
                        setNewCustomColorHex(nextHex);
                        if (!hasManualCustomColorName) {
                          setNewCustomColorName(hexToGermanColorName(nextHex, locale).name);
                        }
                      }}
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-xs text-zinc-300">
                      {isEn ? 'Pick shade' : 'Farbton wählen'}
                    </span>
                  </label>
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCustomColorName}
                      onChange={(e) => {
                        setNewCustomColorName(e.target.value);
                        setHasManualCustomColorName(Boolean(e.target.value.trim()));
                      }}
                      placeholder={`${isEn ? 'e.g.' : 'z. B.'} ${
                        hexToGermanColorName(newCustomColorHex, locale).name
                      }`}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                    {hasManualCustomColorName &&
                      newCustomColorName.trim() !==
                        hexToGermanColorName(newCustomColorHex, locale).name && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewCustomColorName(
                              hexToGermanColorName(newCustomColorHex, locale).name
                            );
                            setHasManualCustomColorName(false);
                          }}
                          className="px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-amber-300 hover:border-amber-400 whitespace-nowrap cursor-pointer"
                          title={
                            isEn
                              ? 'Use detected English color name'
                              : 'Erkannten deutschen Farbnamen übernehmen'
                          }
                        >
                          {isEn ? 'Suggestion:' : 'Vorschlag:'}{' '}
                          {hexToGermanColorName(newCustomColorHex, locale).name}
                        </button>
                      )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOrUpdateCustomColor}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {editingCustomColorOriginalName
                      ? isEn
                        ? 'Save changes'
                        : 'Änderung speichern'
                      : isEn
                      ? 'Save & select color'
                      : 'Farbe speichern & wählen'}
                  </button>
                </div>

                {customColors.length > 0 && (
                  <div className="pt-2.5 border-t border-zinc-800/80 space-y-1.5">
                    <p className="text-[11px] text-zinc-400">
                      {isEn ? 'Your custom colors:' : 'Deine eigenen Farben:'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {customColors.map((cc) => (
                        <div
                          key={`${cc.name}_${cc.hex}`}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: cc.hex }}
                          />
                          <span>{cc.name}</span>
                          <button
                            type="button"
                            onClick={() => handleStartEditCustomColor(cc)}
                            className="text-zinc-400 hover:text-amber-300 cursor-pointer p-0.5"
                            title={isEn ? `Edit ${cc.name}` : `${cc.name} bearbeiten`}
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomColor(cc.name)}
                            className="text-zinc-500 hover:text-rose-400 cursor-pointer p-0.5"
                            title={isEn ? `Delete ${cc.name}` : `${cc.name} löschen`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {colorPresets.map((preset) => {
                const isSelected = colorHex.toUpperCase() === preset.hex.toUpperCase();
                const displayLabel = translateColorName(
                  preset.name.replace(' (Test)', ''),
                  locale,
                  preset.hex
                );
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
                    <span className="text-[11px] font-medium truncate">{displayLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Secondary / Accent Color Picker for Footwear AND Bottoms (Hosen / Kurze Hosen) */}
            {supportsAccentColor && (
              <div className="mt-4 pt-3.5 border-t border-zinc-800/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {category === 'footwear'
                        ? 'Farbige Akzente am Schuh (Optional – z. B. Streifen, Ferse, Logo)'
                        : 'Sekundärfarbe bei Hose / Shorts (Optional – z. B. Streifen, Karos, Waschung)'}
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
                      Sekundärfarbe entfernen (Einfarbig)
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
                    <span className="text-[11px] font-medium truncate">Keine 2. Farbe</span>
                  </button>

                  {colorPresets.map((preset) => {
                    const isSelected =
                      Boolean(accentColorHex) &&
                      accentColorHex.toUpperCase() === preset.hex.toUpperCase();
                    const displayAccentLabel = translateColorName(
                      preset.name.replace(' (Test)', ''),
                      locale,
                      preset.hex
                    );
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
                          {displayAccentLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2b: Eigenschaften, Muster (Hosen/Hemden/Oberteile), Print/Logo & Wetter-Tags */}
          {(category === 'base_top' ||
            category === 'mid_layer' ||
            category === 'outerwear' ||
            category === 'footwear' ||
            category === 'bottom') && (
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Muster &amp; Eigenschaften (Optional)
              </label>

              {/* Pattern selector for bottoms, shirts, tops, sweaters, jackets */}
              {(category === 'bottom' ||
                category === 'base_top' ||
                category === 'mid_layer' ||
                category === 'outerwear') && (
                <div className="space-y-1.5">
                  <span className="block text-xs text-zinc-400">
                    Stoffmuster (z. B. Kariert, Nadelstreifen, Gestreift):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(PATTERN_LABELS) as GarmentPattern[]).map((patKey) => {
                      const isPatSelected = pattern === patKey;
                      return (
                        <button
                          key={patKey}
                          type="button"
                          onClick={() => setPattern(patKey)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                            isPatSelected
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {isPatSelected ? '✓ ' : ''}
                          {PATTERN_LABELS[patKey]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Print & Logo options for T-Shirts, Tops, Pullovers, Hoodies, etc. */}
              {(category === 'base_top' || category === 'mid_layer') && (
                <div className="space-y-1.5">
                  <span className="block text-xs text-zinc-400">
                    Aufdruck / Logo (für T-Shirts, Hemden &amp; Pullover):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHasPrint(false);
                        setHasLogo(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        !hasPrint && !hasLogo
                          ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Ohne Aufdruck / Clean
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasPrint((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        hasPrint
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {hasPrint ? '✓ ' : ''}Mit Print / Motiv
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasLogo((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        hasLogo
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {hasLogo ? '✓ ' : ''}Mit Logo
                    </button>
                  </div>
                </div>
              )}

              {/* Weather & Protection Tags (Regenfest, Winddicht, Wasserabweisend) */}
              {(category === 'outerwear' ||
                category === 'footwear' ||
                category === 'mid_layer' ||
                category === 'bottom') && (
                <div className="space-y-1.5">
                  <span className="block text-xs text-zinc-400">
                    Wetterschutz-Tags (z. B. für Regen, Nässe oder starken Wind):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !rainproof;
                        setRainproof(next);
                        if (next) setWaterResistant(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        rainproof
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {rainproof ? '✓ ' : ''}Regenfest / Wasserdicht
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !waterResistant;
                        setWaterResistant(next);
                        if (!next) setRainproof(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        waterResistant
                          ? 'bg-sky-500/15 border-sky-500/50 text-sky-200 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {waterResistant ? '✓ ' : ''}Wasserabweisend
                    </button>
                    <button
                      type="button"
                      onClick={() => setWindproof((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        windproof
                          ? 'bg-teal-500/20 border-teal-400 text-teal-200 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {windproof ? '✓ ' : ''}Winddicht
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Marke & Größe (Optional – mit eigenen/häufigen Marken & Größen-Vorschlag) */}
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
                  Marke (eigene Marken &amp; Schnellauswahl)
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  placeholder="Marke eingeben oder unten antippen..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                {brandSuggestions.ownBrands.length > 0 && (
                  <div className="space-y-1">
                    <span className="block text-[10px] font-medium text-amber-300/90">
                      Deine häufigen Marken:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {brandSuggestions.ownBrands.slice(0, 10).map((b) => {
                        const active = brand.toLowerCase() === b.toLowerCase();
                        return (
                          <button
                            key={`own_${b}`}
                            type="button"
                            onClick={() => handleBrandChange(active ? '' : b)}
                            className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-semibold'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-200/90 hover:border-amber-400/60'
                            }`}
                          >
                            {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {brandSuggestions.popularBrands.slice(0, 9).map((b) => {
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
                  Größe
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
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Material / Oberfläche
                    </label>
                    <select
                      value={texture}
                      onChange={(e) => {
                        const nextTex = e.target.value as TextureType;
                        setTexture(nextTex);
                        if (nextTex === 'tech_waterproof') {
                          setWaterResistant(true);
                          setRainproof(true);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    >
                      {(Object.keys(TEXTURE_LABELS) as TextureType[]).map((t) => (
                        <option key={t} value={t}>
                          {TEXTURE_LABELS[t]}
                        </option>
                      ))}
                    </select>
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
                          onChange={(e) => {
                            const nextTex = e.target.value as TextureType;
                            setTexture(nextTex);
                            if (nextTex === 'tech_waterproof') {
                              setWaterResistant(true);
                              setRainproof(true);
                            }
                          }}
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
                    {category !== 'accessory' && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = !waterResistant;
                          setWaterResistant(next);
                          if (!next) setRainproof(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          waterResistant
                            ? 'bg-sky-950/50 border-sky-500/50 text-sky-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {waterResistant ? '✓ Wasserabweisend (Regenfest)' : 'Nicht wasserabweisend'}
                      </button>
                    )}

                    {laundrySupported && (
                      <button
                        type="button"
                        onClick={() => setIsClean((v) => !v)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          isClean
                            ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                            : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                        }`}
                      >
                        {isClean ? '✓ Frisch gewaschen' : 'In der Wäsche'}
                      </button>
                    )}
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
