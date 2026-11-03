# Projekt-Richtlinien & Architektur-Regeln (AGENTS.md)

Diese Datei dokumentiert feste Produkt-, UI- und Architektur-Regeln für das Projekt, die bei jeder Änderung zwingend einzuhalten sind.

## 1. Keine Meta-Anweisungen oder Prompt-Zitate im UI-Text
- **Niemals** interne Anweisungen des Nutzers, Feature-Erklärungen aus dem Chat oder technische Meta-Hinweise als sichtbaren Text in die App-Oberfläche schreiben.
- **Verbotene Beispiele:**
  - *Nicht:* `(Eigener Name bleibt bei Typwechsel erhalten)`
  - *Nicht:* `(ohne Technik-Codes)` / `(ohne Hex-Codes)`
  - *Nicht:* `(wird automatisch vorgeschlagen)`
  - *Nicht:* `Für Accessoires musst du keine Wärme-Stufe einordnen...`
- **Stattdessen:** Kurze, klare, selbstverständliche Produkt-Labels (z. B. `Bezeichnung`, `Farbe`, `Marke & Größe`, `Eigene Farben`). Das gewünschte Verhalten muss im Code funktionieren, ohne sich in der Oberfläche selbst zu kommentieren.

## 2. Persistenz (Server, Datenbank & Backup statt nur Browser-LocalStorage)
- Eigene Farben (`customColors`), Marken-Größen-Regeln (`brandSizeRules`), Standardgrößen, Kleidungsstücke und Trage-Historie dürfen **nicht** ausschließlich im lokalen Browser-`localStorage` liegen.
- Sie müssen im `BiometricProfile` bzw. im zentralen Wardrobe-State (`IndexedDB` + `/api/wardrobe` Server-Speicher `data/wardrobe-state.json` + JSON-Backup-Export/Import) gespeichert werden, damit alle Daten geräteübergreifend (z. B. Desktop & iPhone Web-App) synchron bleiben.

## 3. Kategorisierung & Trageweise
- **Hemden (`button_down_shirt`) & Kurzarmhemden (`short_sleeve_shirt`):** Gehören in die Kategorie **T-Shirts, Hemden & Tops (`base_top`)** (nicht zu Pullovern).
- **Trageweise (Offen vs. Geschlossen):** Wird **nicht** beim Anlegen eines Kleidungsstücks abgefragt, sondern vom Outfit-Generator dynamisch als **Trage-Empfehlung** berechnet (z. B. *„Offen über T-Shirt“* vs. *„Geschlossen“*).
- **Anzughose (`suit_trousers`):** Eigener Schnitt-Typ unter **Hosen & Röcke (`bottom`)** neben Stoffhose (`trousers`), Chino (`chino`), Jeans (`denim`), Cargohose (`cargo`) und Shorts (`shorts`).
- **Kopfbedeckung getrennt:** **Cap / Kappe (`cap`)** und **Mütze / Beanie (`beanie`)** sind getrennte Typen mit eigenen Grafiken und unterschiedlicher Temperatur-Logik (Mütze nur bei kühlen/kalten Temperaturen, Cap bei mildem/warmem Wetter; nicht jedes Outfit erhält pauschal alle Accessoires).

## 4. iPhone / iOS Web-App (PWA Safe-Area)
- Bei `apple-mobile-web-app-status-bar-style="black-translucent"` und `viewport-fit=cover` muss die obere Leiste (`<header>`) sowie jeder Vollbild-Dialog auf Mobilgeräten `env(safe-area-inset-top)` als oberes Padding nutzen, damit die Steuerung unter der Dynamic Island / Statusleiste (z. B. iPhone 14) vollständig sichtbar und bedienbar bleibt.
