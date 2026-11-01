/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Grid,
  Plus,
  Settings2,
  Shirt,
  UserCheck,
  Wand2,
} from 'lucide-react';
import { AddGarmentModal } from './components/AddGarmentModal';
import { BiometricProfileView } from './components/BiometricProfileView';
import { DailyStylistView } from './components/DailyStylistView';
import { GapAnalyzerView } from './components/GapAnalyzerView';
import {
  OfflineConnectivityBanner,
  PWAInstallButton,
} from './components/PWAInstallControl';
import { SettingsModal } from './components/SettingsModal';
import { SetupWizardModal } from './components/SetupWizardModal';
import { SmartClosetView } from './components/SmartClosetView';
import { WardrobeImportExportModal } from './components/WardrobeImportExportModal';
import {
  DEFAULT_BIOMETRIC_PROFILE,
  SEED_WARDROBE_GARMENTS,
  WARDROBE_PRESETS,
  WardrobePresetKey,
} from './data/seedData';
import {
  bulkUpsertGarmentsToDb,
  deleteGarmentFromDb,
  importWardrobeBackup,
  loadOrSeedWardrobeData,
  pullStateFromServer,
  resetDatabaseToSeed,
  saveBiometricProfile,
  saveGarmentToDb,
  updateGarmentsCleanStatus,
  WardrobeBackupPayload,
} from './db/wardrobeDb';
import { analyzeWardrobeGaps } from './engine/gapAnalyzer';
import { parseAndNormalizeWardrobeImport } from './engine/wardrobeFormatter';
import {
  AppLocale,
  BiometricProfile,
  ContextBottleneck,
  Garment,
  OutfitContext,
  StyleVibe,
} from './types/wardrobe';

export type ActiveTab = 'stylist' | 'closet' | 'gaps' | 'profile';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stylist');
  const [locale, setLocale] = useState<AppLocale>('de');
  const [profile, setProfile] = useState<BiometricProfile>(DEFAULT_BIOMETRIC_PROFILE);
  const [garments, setGarments] = useState<Garment[]>(SEED_WARDROBE_GARMENTS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [context, setContext] = useState<OutfitContext>({
    temperatureC: 18,
    weather: 'sunny_dry',
    occasion: 'casual',
    styleVibe: 'balanced',
    lockedGarmentIds: [],
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGarment, setEditingGarment] = useState<Garment | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isEn = locale === 'en';

  // Scroll to top when switching primary tabs
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  const handleRefreshFromServer = async () => {
    const latest = await pullStateFromServer();
    if (latest) {
      setProfile(latest.profile);
      setGarments(latest.garments);
    }
  };

  // Load or seed from IndexedDB / MCP Server on mount + sync on window focus
  useEffect(() => {
    let mounted = true;
    loadOrSeedWardrobeData().then((data) => {
      if (!mounted) return;
      setProfile(data.profile);
      setGarments(data.garments);
      setIsLoaded(true);
    });

    const onFocus = () => {
      void handleRefreshFromServer();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Run combinatorial graph & gap analyzer deterministically
  const gapReport = useMemo(() => {
    return analyzeWardrobeGaps(garments, profile);
  }, [garments, profile]);

  const handleSaveGarment = async (garment: Garment, keepOpenForDuplicate: boolean) => {
    const saved = await saveGarmentToDb(garment);
    setGarments((prev) => {
      const exists = prev.some((g) => g.id === saved.id);
      if (exists) {
        return prev.map((g) => (g.id === saved.id ? saved : g));
      }
      return [saved, ...prev];
    });
    if (!keepOpenForDuplicate) {
      setEditingGarment(null);
    }
  };

  const handleDeleteGarment = async (id: string) => {
    await deleteGarmentFromDb(id);
    setGarments((prev) => prev.filter((g) => g.id !== id));
    setContext((prev) => ({
      ...prev,
      lockedGarmentIds: prev.lockedGarmentIds.filter((lockedId) => lockedId !== id),
    }));
  };

  const handleToggleClean = async (id: string, nextClean: boolean) => {
    await updateGarmentsCleanStatus([id], nextClean);
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isClean: nextClean } : g))
    );
  };

  const handleMarkOutfitWorn = async (garmentIds: string[]) => {
    await updateGarmentsCleanStatus(garmentIds, false);
    const idSet = new Set(garmentIds);
    setGarments((prev) =>
      prev.map((g) => (idSet.has(g.id) ? { ...g, isClean: false } : g))
    );
  };

  const handleWashAllGarments = async () => {
    const allIds = garments.map((g) => g.id);
    await updateGarmentsCleanStatus(allIds, true);
    setGarments((prev) => prev.map((g) => ({ ...g, isClean: true })));
  };

  const handleUpdateProfile = async (nextProfile: BiometricProfile) => {
    setProfile(nextProfile);
    await saveBiometricProfile(nextProfile);
  };

  const handleToggleSandboxGarment = async (virtualGarment: Garment) => {
    const exists = garments.some((g) => g.id === virtualGarment.id);
    if (exists) {
      await handleDeleteGarment(virtualGarment.id);
    } else {
      const saved = await saveGarmentToDb({
        ...virtualGarment,
        isWishlistSandbox: true,
        isClean: true,
      });
      setGarments((prev) => [saved, ...prev]);
    }
  };

  const handleJumpToContext = (bucket: ContextBottleneck) => {
    setContext((prev) => ({
      ...prev,
      temperatureC: bucket.temperatureC,
      weather: bucket.weather,
      occasion: bucket.occasion,
      lockedGarmentIds: [],
    }));
    setActiveTab('stylist');
  };

  const handleLockItemInStylist = (garmentId: string) => {
    const target = garments.find((g) => g.id === garmentId);
    const nextTemp =
      target && target.thermalRating >= 4
        ? 8
        : target && target.thermalRating === 3
        ? 15
        : 18;
    const nextOccasion =
      target && target.formality >= 4 ? 'smart_casual_office' : context.occasion;

    setContext({
      ...context,
      temperatureC: nextTemp,
      occasion: nextOccasion,
      lockedGarmentIds: [garmentId],
    });
    setActiveTab('stylist');
  };

  const handleExportBackup = () => {
    const payload: WardrobeBackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      garments,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thread-graph-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStructuredImport = async (
    importedGarments: Garment[],
    mode: 'merge' | 'replace',
    importedProfile?: BiometricProfile
  ) => {
    const nextProfile = importedProfile || profile;
    if (importedProfile) {
      setProfile(importedProfile);
      await saveBiometricProfile(importedProfile);
    }

    if (mode === 'replace') {
      const res = await importWardrobeBackup({
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: nextProfile,
        garments: importedGarments,
      });
      setProfile(res.profile);
      setGarments(res.garments);
    } else {
      const savedList = await bulkUpsertGarmentsToDb(importedGarments);
      setGarments((prev) => {
        const byId = new Map(prev.map((g) => [g.id, g]));
        for (const item of savedList) {
          byId.set(item.id, item);
        }
        return Array.from(byId.values());
      });
    }
  };

  const handleLoadCollectionPreset = async (presetKey: WardrobePresetKey) => {
    const preset = WARDROBE_PRESETS[presetKey];
    if (!preset) return;
    const nextProfile: BiometricProfile = {
      ...profile,
      wardrobeScope: preset.scope,
    };
    await handleStructuredImport(preset.garments, 'replace', nextProfile);
    setContext((prev) => ({ ...prev, lockedGarmentIds: [] }));
  };

  const handleCompleteSetupWizard = async (payload: {
    profile: BiometricProfile;
    styleVibe: StyleVibe;
    garmentsToLoad: Garment[] | null;
  }) => {
    await handleUpdateProfile(payload.profile);
    if (payload.garmentsToLoad) {
      await handleStructuredImport(payload.garmentsToLoad, 'replace', payload.profile);
    }
    setContext((prev) => ({
      ...prev,
      styleVibe: payload.styleVibe,
      lockedGarmentIds: [],
    }));
    setActiveTab('stylist');
  };

  const handleImportBackupFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseAndNormalizeWardrobeImport(text);
      if (parsed.ok && parsed.garments.length > 0) {
        await handleStructuredImport(parsed.garments, 'replace', parsed.profile);
      }
    } catch {
      // Ignore malformed JSON
    }
  };

  const handleResetToSeed = async () => {
    const res = await resetDatabaseToSeed();
    setProfile(res.profile);
    setGarments(res.garments);
    setContext({
      temperatureC: 18,
      weather: 'sunny_dry',
      occasion: 'casual',
      styleVibe: 'balanced',
      lockedGarmentIds: [],
    });
  };

  const openAddNewGarment = () => {
    setEditingGarment(null);
    setIsModalOpen(true);
  };

  const openEditGarment = (garment: Garment) => {
    setEditingGarment(garment);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col pb-20 md:pb-12">
      {/* Top Bar Contract: Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#09090b]/95 backdrop-blur-md border-b border-zinc-800/90">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 h-14">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#stylist"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('stylist');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-zinc-100 whitespace-nowrap shrink-0"
          >
            ATELIER BIOMETRIC
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="Hauptnavigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {(
              [
                {
                  id: 'stylist',
                  label: isEn ? "Today's Outfits" : 'Outfits für heute',
                },
                {
                  id: 'closet',
                  label: isEn
                    ? `My Closet (${garments.length})`
                    : `Mein Kleiderschrank (${garments.length})`,
                },
                {
                  id: 'gaps',
                  label: isEn
                    ? `What's Missing? (${gapReport.orphanPieces.length})`
                    : `Was fehlt mir? (${gapReport.orphanPieces.length})`,
                },
                {
                  id: 'profile',
                  label: isEn ? 'My Colors & Style' : 'Mein Typ & Farben',
                },
              ] as const
            ).map((nav) => {
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveTab(nav.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-zinc-100 border-amber-400 font-semibold'
                      : 'text-zinc-400 border-transparent hover:text-zinc-100'
                  }`}
                >
                  {nav.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Settings, Language Switcher + Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title={isEn ? 'Settings, Clothing Choice & Colors' : 'Einstellungen, Kleidungs-Auswahl & Farben'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{isEn ? 'Settings' : 'Einstellungen'}</span>
            </button>

            <button
              type="button"
              onClick={() => setLocale((prev) => (prev === 'de' ? 'en' : 'de'))}
              title={isEn ? 'Switch to German (DE)' : 'Auf Englisch umschalten (EN)'}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 cursor-pointer"
            >
              {isEn ? 'EN · DE' : 'DE · EN'}
            </button>

            <button
              type="button"
              onClick={openAddNewGarment}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 rounded-lg hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? '+ Add Garment' : '+ Kleidungsstück'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {!isLoaded ? (
          <div className="space-y-4 py-8">
            <div className="h-28 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse" />
            <div className="h-64 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse" />
          </div>
        ) : (
          <>
            {activeTab === 'stylist' && (
              <DailyStylistView
                garments={garments}
                profile={profile}
                context={context}
                locale={locale}
                onChangeContext={setContext}
                onMarkOutfitWorn={handleMarkOutfitWorn}
                onWashAllGarments={handleWashAllGarments}
                onOpenAddModal={openAddNewGarment}
                onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}

            {activeTab === 'closet' && (
              <SmartClosetView
                garments={garments}
                profile={profile}
                locale={locale}
                outfitCountsByGarmentId={gapReport.outfitCountsByGarmentId}
                onOpenAddModal={openAddNewGarment}
                onOpenImportExportModal={() => setIsImportExportOpen(true)}
                onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
                onLoadCollectionPreset={handleLoadCollectionPreset}
                onEditGarment={openEditGarment}
                onDeleteGarment={handleDeleteGarment}
                onToggleClean={handleToggleClean}
                onLockAndStyle={handleLockItemInStylist}
              />
            )}

            {activeTab === 'gaps' && (
              <GapAnalyzerView
                report={gapReport}
                garments={garments}
                onToggleSandboxGarment={handleToggleSandboxGarment}
                onJumpToContext={handleJumpToContext}
                onLockOrphanInStylist={handleLockItemInStylist}
              />
            )}

            {activeTab === 'profile' && (
              <BiometricProfileView
                profile={profile}
                garments={garments}
                onUpdateProfile={handleUpdateProfile}
                onOpenImportExportModal={() => setIsImportExportOpen(true)}
                onExportBackup={handleExportBackup}
                onImportBackupFile={handleImportBackupFile}
                onResetToSeed={handleResetToSeed}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Footer with Non-Commercial Open-Source License & Quick Actions */}
      <footer className="max-w-7xl w-full mx-auto px-4 sm:px-6 mt-12 pt-6 border-t border-zinc-900 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs text-zinc-500">
        <div className="space-y-1">
          <p className="text-zinc-400 font-mono">
            thread-graph (ATELIER BIOMETRIC) · Non-Commercial Open-Source (PolyForm NC 1.0) · Free for Personal Use
          </p>
          <p className="text-[11px] text-zinc-500">
            Kostenlos für den Privatgebrauch &amp; Self-Hosting. Kommerzielle Nutzung untersagt. Offline-fähige Kleiderschrank- &amp; Outfit-App.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 cursor-pointer whitespace-nowrap"
          >
            <Settings2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEn ? 'Settings & Colors' : 'Einstellungen & Farben'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSetupWizardOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-xs text-amber-200 cursor-pointer whitespace-nowrap"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEn ? 'Setup Wizard' : 'Start-Assistent'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportExportOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 cursor-pointer whitespace-nowrap"
          >
            {isEn ? 'Backup & Export' : 'Backup & Daten'}
          </button>
          <PWAInstallButton />
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/95 backdrop-blur-md border-t border-zinc-800 grid grid-cols-4 items-center h-14"
      >
        {(
          [
            { id: 'stylist', label: 'Outfits', icon: Compass },
            { id: 'closet', label: isEn ? 'Closet' : 'Kleiderschrank', icon: Shirt },
            { id: 'gaps', label: isEn ? 'Missing' : 'Was fehlt?', icon: Grid },
            { id: 'profile', label: isEn ? 'My Colors' : 'Mein Typ', icon: UserCheck },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                isActive ? 'text-amber-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Fast Manual Entry / Edit Modal */}
      <AddGarmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGarment(null);
        }}
        profile={profile}
        onSaveGarment={handleSaveGarment}
        onUpdateProfile={handleUpdateProfile}
        initialGarment={editingGarment}
      />

      {/* 3-Step Quick Setup Wizard Modal */}
      <SetupWizardModal
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
        locale={locale}
        currentProfile={profile}
        currentStyleVibe={context.styleVibe || 'balanced'}
        onCompleteSetup={handleCompleteSetupWizard}
      />

      {/* Settings, Style Scope & Custom Color Builder Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={profile}
        locale={locale}
        onLocaleChange={setLocale}
        onSaveProfile={handleUpdateProfile}
        onLoadPreset={handleLoadCollectionPreset}
        onQuickAddGarment={(g) => handleSaveGarment(g, false)}
      />

      {/* Wardrobe Import / Export & Structured LLM Exchange Modal */}
      <WardrobeImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        profile={profile}
        garments={garments}
        gapReport={gapReport}
        onImportGarments={handleStructuredImport}
        onDownloadJsonBackup={handleExportBackup}
        onRefreshFromServer={handleRefreshFromServer}
      />

      <OfflineConnectivityBanner />
    </div>
  );
}
