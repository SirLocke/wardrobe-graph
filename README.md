# thread-graph (`kapsel` / Atelier Biometric)

> **A deterministic, zero-AI personal stylist & wardrobe gap analyzer. Uses CIELAB/HSL color math, biometric profiling, and graph theory to build outfits and calculate high-ROI missing pieces. Offline-first PWA.**

[![License: Non-Commercial](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-amber.svg)](./LICENSE)
[![Zero External AI](https://img.shields.io/badge/Engine-100%25_Deterministic_TypeScript-10b981.svg)](#architecture--modular-rule-engine)
[![PWA Offline-First](https://img.shields.io/badge/PWA-IndexedDB_Offline--First-38bdf8.svg)](#live-demo--github-pages-deployment)
[![MCP Ready](https://img.shields.io/badge/MCP-JSON--RPC_2.0_(HTTP_%2B_STDIO)-a855f7.svg)](#model-context-protocol-mcp-server)

---

## Why `thread-graph`?

Most "smart wardrobe" apps are thin wrappers around cloud LLM APIs that hallucinate outfits, require subscriptions, and lock your wardrobe photos inside proprietary silos.

**`thread-graph`** treats personal styling as a **deterministic constraint-satisfaction and graph-theory problem**:
1. **Biometric Color Harmony (`src/engine/colorMath.ts`)**: Converts any garment color into HSL/perceptual lightness, classifies color temperature (`warm`, `cool`, `neutral`), derives your **12-Season Color Passport**, and scores garments against your skin undertone, hair/skin contrast, eye color (hue-echo detection), and haircut/beard framing. Includes bilingual (`DE`/`EN`) automatic color naming (`src/engine/colorNaming.ts`) and custom user palettes.
2. **Anatomical Layering, Custom Occasions & Combinable Modifiers (`src/engine/outfitGenerator.ts`)**: Evaluates temperature (`-5°C` to `32°C`), weather (`sunny_dry`, `cloudy_windy`, `rain_wet`), 9 built-in occasions (`homeoffice_lounge`, `casual`, `smart_casual_office`, `city_cafe`, `outdoor_walk`, `beach_vacation`, `active_sporty`, `date_night`, `formal_event`) plus **freely extensible Custom Occasions (`+ Eigener Anlass`)**, and 7 combinable **Daily Modifiers** (`rainproof`, `windproof`, `layered_open`, `extra_comfort`, `clean_no_print`, `monochrome_calm`, `color_accent`) with dynamic open/closed layer recommendations (`wornOpen`) and Maximal Marginal Relevance (MMR) diversity.
3. **Combinatorial Graph & Gap Analyzer (`src/engine/gapAnalyzer.ts`)**: Builds a multi-layer compatibility graph across weather/occasion contexts to detect **Orphan Pieces** (items with `<= 2` valid outfit combinations) and simulates **41 classic garment archetypes** (`src/engine/archetypes.ts`) across **Womenswear, Menswear, and Unisex** scopes to rank the **Top 5 High-ROI Missing Pieces** by exact number of newly unlocked outfits (`+N new combinations`).
4. **Architectural Vector Avatars & Stacked Look-View (`src/components/GarmentVector.tsx` & `OutfitLayerStack.tsx`)**: No photo cropping required. Renders **40+ tailored garment silhouettes** (including suit trousers, chinos, shirts, hoodies, blazers, coats, caps vs. winter beanies, sneakers & boots) and stacks outfits anatomically from head to toe with iOS/iPhone PWA Safe-Area support.

---

## Self-Hosting (Docker, VPS, Coolify, Railway, Home Server)

Run the full web app + persistent server-side JSON store (`/api/wardrobe`) + Model Context Protocol (`/mcp`) server anywhere with Docker:

```bash
docker compose up -d --build
```

Or use this `docker-compose.yml` on your VPS / Coolify / Portainer / Home Server:

```yaml
services:
  thread-graph:
    container_name: thread-graph
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - WARDROBE_DATA_FILE=/app/data/wardrobe-store.json
      # Optional: Protect public internet deployments with HTTP Basic Auth
      - BASIC_AUTH_USER=
      - BASIC_AUTH_PASS=
    restart: unless-stopped
```

- **Cross-Device Sync (Desktop & iPhone PWA):** All garments, biometric settings, custom colors, brand size rules, custom occasions, and wear history are persisted in `/app/data/wardrobe-store.json` on the server AND cached locally in `IndexedDB` (`Dexie`) for offline use.
- **Optional Password Protection (`BASIC_AUTH_USER` & `BASIC_AUTH_PASS`):** If you host the container on a public URL, set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` in your environment variables to protect the Web UI, `/api/wardrobe`, and `/mcp` with HTTP Basic Auth. Healthchecks at `GET /api/health` remain accessible for reverse proxies.

---

## Local Development & Unit Tests

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Start full-stack dev server (Web UI on :3000 + MCP HTTP server on :3000/mcp)
npm run dev

# 3. Run the deterministic engine & MCP unit test suite (17 test suites)
npm test

# 4. Build static production bundle (for GitHub Pages / Cloudflare Pages)
npm run build
```

---

## Live Demo & GitHub Pages Deployment (Zero-Backend Mode)

Because **`thread-graph`** uses `Dexie.js` (`IndexedDB`) with built-in starter seed data (`src/data/seedData.ts`) and JSON Backup Import/Export, the application also runs **100% client-side as a static site** (e.g. GitHub Pages, Cloudflare Pages, Netlify, Vercel) without requiring a backend server:
- Visitors can immediately adjust temperature sliders, lock anchor garments, inspect Orphan Pieces, and test hypothetical purchases in the **Wishlist Sandbox** (`[Im Schrank testen]`).
- A ready-to-use GitHub Actions workflow is included at [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) — simply enable **Settings → Pages → Source: GitHub Actions** in your repository.

---

## Architecture & Modular Rule Engine (`src/engine/`)

The rule engine is 100% decoupled from React and DOM APIs so contributors can easily audit rules, add garment archetypes, or contribute new SVG silhouettes via Pull Requests:

```text
src/
├── types/
│   └── wardrobe.ts             # Core TypeScript interfaces & strict enums
├── engine/
│   ├── styleRules.ts           # Declarative matrices (Fit, Texture, Neckline/Haircut, Layering)
│   ├── colorMath.ts            # Hex -> HSL, Color Temp, 12-Season Palette, Biometric Scoring
│   ├── outfitGenerator.ts      # Hard weather/occasion filters & 5-pillar outfit scoring
│   ├── archetypes.ts           # 35 parameterized menswear/unisex garment archetypes
│   ├── gapAnalyzer.ts          # Combinatorial graph analyzer, Orphan detector & ROI simulator
│   ├── wardrobeFormatter.ts    # LLM Schema generator & Markdown-fenced JSON importer
│   └── engine.test.ts          # Node test runner suite (node:test)
├── mcp/
│   ├── mcpHandler.ts           # Pure JSON-RPC 2.0 Model Context Protocol implementation
│   └── fileStore.ts            # Shared JSON file persistence (/data/wardrobe-store.json)
└── components/
    ├── GarmentVector.tsx       # 25 dynamic SVG garment silhouettes + fabric texture patterns
    └── OutfitLayerStack.tsx    # Anatomical head-to-toe stacked outfit renderer
```

### How to Contribute New Silhouettes or Rules
1. **Add a new Garment Silhouette**: Add the subcategory key to `GarmentSubcategory` in `src/types/wardrobe.ts` and add its SVG `<g>` path in `src/components/GarmentVector.tsx` (`viewBox="0 0 100 100"`).
2. **Add a new Classic Archetype**: Append an archetype definition in `src/engine/archetypes.ts` so the Gap Analyzer automatically tests it during ROI simulations.
3. **Tune Styling Matrices**: Edit the declarative tables in `src/engine/styleRules.ts` and run `npx tsx --test src/engine/engine.test.ts`.

---

## Model Context Protocol (MCP) Server

`thread-graph` includes a built-in **MCP Server** supporting both **Streamable HTTP (`POST /mcp`)** and **STDIO (`npx tsx mcp-server.ts`)**. Connect Claude Desktop, Cursor, or OpenWebUI to let an external LLM catalog your clothes from photos or query your deterministic wardrobe graph.

### Available MCP Tools (9 Deterministic Tools)
| Tool Name | Description |
| :--- | :--- |
| `list_garments` | Lists all garments with calculated HSL, color temperature, and biometric score. |
| `add_garment` | Creates a single garment; auto-computes HSL, color temperature, and biometric match. |
| `add_garments_bulk` | Bulk-imports an array of garments (e.g., extracted from closet photos). |
| `update_garment` | Updates garment properties or laundry status (`isClean`). |
| `delete_garment` | Removes a garment by ID. |
| `get_biometric_profile` | Returns the user's biometric profile and 12-Season Color Passport. |
| `update_biometric_profile` | Updates skin undertone, contrast, chroma, eye/hair hex, or haircut style. |
| `generate_daily_outfits` | Computes the Top 5 outfits for a given temperature (`°C`), weather, and occasion. |
| `analyze_wardrobe_gaps` | Runs the graph analyzer to return Orphan Pieces, bottlenecks, and Top 5 ROI additions. |

### Connect Claude Desktop / Cursor (`claude_desktop_config.json`)

**Option A: Via running Docker container (`stdio`)**
```json
{
  "mcpServers": {
    "thread-graph": {
      "command": "docker",
      "args": ["exec", "-i", "atelier-biometric", "npx", "tsx", "mcp-server.ts"]
    }
  }
}
```

**Option B: Local Node.js (`stdio`)**
```json
{
  "mcpServers": {
    "thread-graph": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-server.ts"]
    }
  }
}
```

---

## License (Source-Available / Non-Commercial)

Released under the **[PolyForm Noncommercial License 1.0.0](./LICENSE)**:
- **Free for private, personal, educational, and non-commercial community use** (including self-hosting via Docker, personal forks, and pull requests).
- **Commercial use, paid SaaS hosting, or commercial redistribution is prohibited** without explicit written permission.

