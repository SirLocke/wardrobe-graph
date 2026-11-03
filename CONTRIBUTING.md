# Contributing to `thread-graph`

Vielen Dank für dein Interesse, an **`thread-graph`** mitzuwirken!

## 1. Architektur-Grundsätze
Bitte lies vor Änderungen zuerst [AGENTS.md](./AGENTS.md):
- **100 % Deterministische Engine (`src/engine/`):** Keine Cloud-KI-Abhängigkeiten für Outfit-Generierung, Farbanalyse oder Lücken-Berechnung.
- **Saubere Produkt-Texte:** Keine technischen Meta-Kommentare oder interne Hinweise in sichtbaren UI-Labels.
- **Persistenz:** Alle neuen Profil- oder Schrank-Eigenschaften müssen im `BiometricProfile` bzw. `Garment`-Modell gespeichert werden (damit Server-Sync `/api/wardrobe`, `IndexedDB` und JSON-Backup synchron bleiben).

## 2. Lokale Entwicklung & Tests

```bash
# 1. Abhängigkeiten installieren
npm install --legacy-peer-deps

# 2. Entwicklungsserver starten (Port 3000)
npm run dev

# 3. TypeScript-Prüfung & Unit-Tests ausführen
npm run lint
npm test
```

## 3. Neue Schnitte / Vektor-Grafiken ergänzen
1. Neuen Subkategorie-Schlüssel in `src/types/wardrobe.ts` (`GarmentSubcategory`) eintragen.
2. Deutsche & englische Bezeichnung in `src/data/seedData.ts` (`SUBCATEGORY_LABELS` / `SUBCATEGORY_LABELS_EN`) ergänzen.
3. SVG-Pfad (`viewBox="0 0 100 100"`) in `src/components/GarmentVector.tsx` anlegen.
4. Optional Archetyp in `src/engine/archetypes.ts` ergänzen und `npm test` ausführen.

## 4. Lizenz
Mit dem Einreichen eines Pull Requests stimmst du zu, dass dein Beitrag unter der [PolyForm Noncommercial License 1.0.0](./LICENSE) bereitgestellt wird.
