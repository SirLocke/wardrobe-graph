import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Als App auf dem Startbildschirm speichern"
      >
        <Download className="w-3.5 h-3.5 text-amber-400" />
        <span>App installieren</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/icon.svg"
                  alt="Outfit-Planer App Icon"
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl border border-zinc-700/80 shadow-md shrink-0"
                />
                <div>
                  <h3 id="pwa-install-title" className="text-base font-semibold text-zinc-100">
                    Outfit-Planer als App speichern
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Kostenlos · Funktioniert auch komplett offline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Installationshinweis schließen"
                className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Dein Kleiderschrank und deine Farb-Einstellungen werden direkt auf deinem Gerät gespeichert und funktionieren jederzeit auch ohne Internet.
            </p>
            {isIOS ? (
              <div className="mt-4 space-y-2 text-xs text-zinc-300 bg-zinc-950 border border-zinc-800/80 rounded-lg p-3.5">
                <p>1. Tippe in Safari unten auf das <strong>Teilen-Symbol</strong>.</p>
                <p>2. Wähle <strong>Zum Home-Bildschirm</strong> hinzufügen.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-xs text-zinc-300 bg-zinc-950 border border-zinc-800/80 rounded-lg p-3.5">
                <p>1. Klicke in der Adressleiste deines Browsers auf das <strong>Installieren-Icon</strong> (rechts neben der Adresse).</p>
                <p>2. Oder öffne das Browser-Menü und wähle <strong>App installieren / Zum Startbildschirm hinzufügen</strong>.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-lg bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-white transition-colors cursor-pointer"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineConnectivityBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-lg bg-zinc-900 border border-amber-500/40 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Offline-Modus aktiv — Lokale IndexedDB-Engine läuft ohne Einschränkung</span>
    </div>
  );
};
