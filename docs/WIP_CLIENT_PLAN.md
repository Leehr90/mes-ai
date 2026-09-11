# WIP Client — Project Plan

A focused shop-floor client for scanning, starting, and completing WIP (lots and units),
patterned after the Run-Time client (`clients/run_time`).

---

## 1. Purpose and Scope

### 1.1 Objective

Build a new browser-based client application, **wip-client**, that gives an operator a
single-screen workflow:

1. Scan (or type) a **lot number** or **unit serial number** and press **Search**.
2. Review the WIP information and the equipment available at the current route step.
3. Record **data collection** values and **step parameter** values.
4. **Start** the WIP at the step, process it, then **Complete** it.

The client is intentionally narrow compared to the Run-Time client: no dashboard, orders,
inventory, dispatch evaluation, or event stream pages. One screen, three tabs, two actions.

### 1.2 Out of Scope (Future Enhancements)

The following rt-client capabilities are deliberately excluded from v1 and may be added later:

- Hold / Release Hold / Scrap actions
- Material consumption (BOM picking)
- WIP step-history table
- WebSocket event subscriptions
- Dashboard, orders, inventory, equipment pages
- Equipment PackML/SEMI E10 state walking ("Transition State" checkbox)

See §10 for extension notes.

---

## 2. Background — What We Reuse from rt-client

The wip-client clones the architecture of `clients/run_time`:

| Aspect                | rt-client implementation                          | Reuse in wip-client |
|-----------------------|---------------------------------------------------|---------------------|
| Stack                 | React 19 + TypeScript 5 + Vite 6 + Tailwind CSS 4 | Identical           |
| Data fetching         | TanStack Query + Axios                            | Identical           |
| Icons/styling         | Heroicons, shared `.btn-primary` / `.input-field` classes | Identical   |
| API envelope          | `{ status, data }` JSON, base URL `/api/v1`, dev-proxy via `MES_SERVER_URL` | Identical |
| Domain types          | `src/types/index.ts` mirroring server Pydantic schemas | Trimmed copy   |
| Core endpoints        | units/lots by-number lookup, step-context, start, complete, move, step-equipment, data collect-batch | Same endpoints |
| PWA                   | `vite-plugin-pwa`                                 | Kept (tablet use)   |

Key domain concepts carried over unchanged:

- **StepContext** (`GET /units/{id}/step-context`, `GET /lots/{id}/step-context`) returns
  everything the screen needs in one call: `wip_type`, `wip`, `step`,
  `step_parameters[]`, `data_definitions[]`, `dispositions[]`, `route_steps[]`,
  `outgoing_conditions[]`.
- **Equipment at step** (`GET /dispatch/step-equipment/{stepId}`) returns
  `StepEquipmentStatus[]` (code, name, dispatch category, queue depth, spare capacity,
  material setup, assigned flag).
- **Complete flow**: data points are persisted individually beforehand
  (`POST /data/collect-batch` with `upsert: true`, one item per field **Save**), then
  `POST /units/{id}|/lots/{id}/complete`, then `POST .../move` with result/disposition
  to advance the WIP along the route.

---

## 3. Functional Requirements

| #   | Requirement                                                                                                                                    |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------|
| FR1 | The client accepts two program arguments at launch: **(1)** tracking type — `lot` or `unit`; **(2)** MES **server URL**.                        |
| FR2 | Top of the page: a single edit box for scanning the lot/unit identifier plus a **Search** button. Enter key triggers search.                     |
| FR3 | Below the scan bar: a tabbed panel with three tabs — **Main**, **Data Collection**, **Step Parameters**. Tabs are disabled until a WIP is found. |
| FR4 | On successful search, the **Main** tab shows the WIP information (type, identifier, status badge, order, product, quantity/UoM, current step, assigned equipment, hold reason if any) followed by the list of equipment at the route step. |
| FR5 | The **Data Collection** tab renders one input field per data definition returned in the step context (numeric/text/boolean/enum), showing name, required marker, UoM symbol, and lower–upper limits where defined. Each field has its own **Save** button that persists that value immediately (server-side upsert); values already saved for the WIP are pre-populated on scan/relaunch. |
| FR6 | The **Step Parameters** tab renders one input field per step parameter for recording actual measured values, alongside target/lower/upper reference columns. Each row has its own **Save** button that persists that value immediately (server-side upsert); values already saved for the WIP are pre-populated on scan/relaunch. |
| FR7 | Bottom of the page: **Start** button (enabled when WIP status is `queued`) and **Complete** button (enabled when status is `in_process`).         |
| FR8 | **Start** assigns equipment (auto-dispatch by default, optional manual override from the equipment list) and moves the WIP to `in_process`.       |
| FR9 | **Complete** builds a data snapshot from the already-saved data-collection values plus recorded step-parameter values, completes the WIP with result/disposition (and qty-out/qty-scrapped for lots), then advances it via move. |
| FR10| Errors from any API call are surfaced inline; success feedback is shown after Start/Complete; the context refreshes after each action.            |
| FR11| Tracking type may be overridden at runtime via URL query parameter (`?tracking=lot|unit`); the launch argument provides the default.              |

---

## 4. Non-Functional Requirements

- NFR1 Runs as a Vite dev server (development), `vite preview` (production smoke test),
  NSSM Windows service / systemd (deployment), and static SPA behind nginx (Docker).
- NFR2 Touch/tablet friendly: large tap targets, autofocus on the scan box, keyboard-only
  operation possible (scan → Enter → Start → Complete).
- NFR3 No authentication dependency beyond what the MES server enforces on `/api/v1`.
- NFR4 All server interaction goes through the `/api` proxy — no CORS, no hardcoded hosts
  in the bundle.

---

## 5. User Interface Specification

### 5.1 Layout Mockup

```
┌────────────────────────────────────────────────────────────────────────┐
│  MES AI — WIP Processing                                               │
│                                                                        │
│  ┌──────────────────────────────────────────────┐  ┌───────────────┐   │
│  │ Scan Lot/Unit ID…                            │  │    Search     │   │
│  └──────────────────────────────────────────────┘  └───────────────┘   │
│  (error / success banner area)                                         │
│                                                                        │
│  ┌─[ Main ]─[ Data Collection ]─[ Step Parameters ]──────────────────┐  │
│  │                                                                   │  │
│  │  MAIN TAB                                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │ LOT  L-2026-0012                      [IN_PROCESS]          │ │  │
│  │  │ Order: OR-1042   Product: Tablet Blend A   Qty: 500 kg      │ │  │
│  │  │ Current Step: 30 – Granulation                              │ │  │
│  │  │ Assigned Equipment: GRAN-01                                 │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  │  Equipment at Step                                                │  │
│  │  ┌──────────┬────────────┬───────────┬───────┬───────────────┐   │  │
│  │  │ Code     │ Name       │ State     │ Queue │ Material Setup│   │  │
│  │  ├──────────┼────────────┼───────────┼───────┼───────────────┤   │  │
│  │  │ GRAN-01  │ Granulator │ Execute   │ 1/3   │ ✓             │   │  │
│  │  │ GRAN-02  │ Granulator │ Idle      │ 0/3   │ ✗             │   │  │
│  │  └──────────┴────────────┴───────────┴───────┴───────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────┐   ┌──────────────────────────────┐   │
│  │           START              │   │          COMPLETE            │   │
│  └──────────────────────────────┘   └──────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Component Behavior

**Scan bar** (always visible)
- Edit box autofocused; placeholder text reflects tracking mode
  ("Scan or type lot number…" vs "Scan or type serial number…").
- **Search** button and Enter key both trigger lookup:
  - `unit` mode → `GET /units/by-serial/{serial}` then `GET /units/{id}/step-context`
  - `lot` mode  → `GET /lots/by-number/{number}` then `GET /lots/{id}/step-context`
- Not-found / network errors render a red banner; previous context is cleared.
- After a successful find, a "New Scan" link resets the screen.

**Tab strip**
- Three tabs rendered as buttons; disabled (grayed) while `context === null`.
- Selecting a tab shows only that panel (CSS `hidden` toggling, matching rt-client).
- On successful search the **Main** tab is selected automatically.

**Main tab**
- WIP info card: type label, identifier (mono font), status badge
  (color-coded: queued=gray, in_process=blue, completed=green, scrapped=red, on_hold=yellow),
  order number, product id/name, quantity + UoM (lots), current step
  ("{sequence} – {name}"), assigned equipment code, hold reason when applicable.
- Equipment table below the info card, fed by
  `GET /dispatch/step-equipment/{step.id}?material_id=…&assigned_equipment_id=…`,
  polled every 10 s while the WIP is `queued` or `in_process`.
  Columns: Code, Name, Dispatch State, Queue Depth, Spare Capacity, Material Setup,
  Assigned. When status is `queued`, an "Equipment Override" select lets the operator
  pin Start to a specific machine (default: auto-dispatch).

**Data Collection tab**
- One row per `data_definitions[]` entry:
  - `numeric` → `<input type="number">`, placeholder shows `lower – upper` limits;
  - `boolean` → True/False/— select;
  - `enum`    → select populated from comma-separated `enum_values`;
  - otherwise → text input.
- Label shows name, red `*` when `is_required`, UoM symbol in parentheses;
  a right-aligned "Spec: lo–hi" hint when limits exist.
- Values are held in local state keyed by definition id. Each field's **Save**
  button persists that single value immediately via `collectDataBatch` with
  `upsert: true`, so re-saving (even the same value) updates the existing row
  instead of appending a new one. On scan / client relaunch, values already
  persisted for the WIP are fetched (`GET /data/points?unit_id|lot_id=…`) and
  pre-populated; the persisted value is also shown beneath the field ("Saved: …").

**Step Parameters tab**
- Two-zone layout per parameter:
  - Reference columns (read-only): Target, Lower, Upper, UoM — from `step_parameters[]`;
  - **Actual** input column where the operator records the measured value, plus a
    per-row **Save** button.
- Each row's **Save** persists that value immediately via
  `recordParameterValues` (`POST /segment-parameter-values/batch`), which upserts
  the current row for the (parameter, WIP) — re-saving (even the same value)
  updates it in place. On scan / client relaunch, saved values are fetched
  (`GET /segment-parameter-values?unit_id|lot_id=…`) and pre-populated; the
  persisted value is also shown beneath the input ("Saved: …"). Required
  parameters block Complete when empty (client-side validation with inline message).

**Action bar** (bottom, always visible once a WIP is loaded)
- **Start** — enabled iff `wip.status === "queued"` and at least one equipment row is
  eligible (or the list is empty, deferring eligibility to the server). Calls
  `POST /units/{id}/start` or `POST /lots/{id}/start` with `equipment_id` override.
- **Complete** — enabled iff `wip.status === "in_process"`. Reveals a compact options
  row above the buttons when relevant:
  - Result select (Pass/Fail/Rework) when `outgoing_conditions` includes them;
  - Disposition select when `dispositions.length > 0` (labels annotated with
    destination step);
  - Qty Out / Qty Scrapped inputs for lots.
  Sequence: `collectDataBatch` (changed values only) → `complete…` → `move…`
  → refresh context, invalidate queries, show success banner.

---

## 6. Technical Design

### 6.1 Technology Stack

Identical to rt-client: React 19, TypeScript 5.9, Vite 6, Tailwind CSS 4,
TanStack Query 5, Axios, Heroicons, `vite-plugin-pwa`. No React Router — the app is a
single screen; tab switching is local state.

### 6.2 Program Arguments

Following the established launcher pattern (`run-client.ps1 -ServerUrl` sets
`MES_SERVER_URL`, consumed by `vite.config.ts`):

| Argument       | Launcher flag  | Env var         | Consumption                                                        |
|----------------|----------------|-----------------|--------------------------------------------------------------------|
| Tracking type  | `-Tracking`    | `WIP_TRACKING`  | Read by `vite.config.ts` → injected as compile-time constant `__WIP_TRACKING__` (`"lot"` \| `"unit"`, default `"unit"`). Runtime override: `?tracking=` query param wins over the constant. |
| Server URL     | `-ServerUrl`   | `MES_SERVER_URL`| Vite dev/preview proxy target for `/api` (unchanged rt-client mechanism). |

`vite.config.ts` additions:

```ts
const WIP_TRACKING = (process.env.WIP_TRACKING ?? 'unit').toLowerCase() === 'lot' ? 'lot' : 'unit'

export default defineConfig({
  define: {
    __MES_VERSION__: …,
    __MES_RELEASE_DATE__: …,
    __WIP_TRACKING__: JSON.stringify(WIP_TRACKING),
  },
  server: { port: 5177, proxy: { '/api': { target: MES_SERVER, changeOrigin: true, ws: true } } },
})
```

`src/vite-env.d.ts` declares `declare const __WIP_TRACKING__: 'lot' | 'unit'`.

### 6.3 Port Allocation

Existing clients occupy 5173–5176 (dev) and 4173–4176 (preview). The wip-client claims:

- Dev server: **5177**
- Production preview: **4177**

### 6.4 Directory Structure

```
clients/wip_client/
├── index.html                     # title "MES WIP — Shop Floor"
├── package.json                   # name "wip_client", version 1.0.0
├── tsconfig.json                  # solution refs (copy from run_time)
├── tsconfig.app.json              # strict compiler options (copy from run_time)
├── vite.config.ts                 # ports 5177, __WIP_TRACKING__ define, PWA manifest
├── public/
│   ├── vite.svg
│   ├── icon-192x192.png           # copied from run_time assets
│   ├── icon-512x512.png
│   └── icon-512x512-maskable.png
└── src/
    ├── main.tsx                   # StrictMode + QueryClientProvider
    ├── App.tsx                    # screen composition + orchestration state
    ├── index.css                  # tailwind + .btn-primary/.input-field (+ .btn-success)
    ├── vite-env.d.ts              # __MES_*__, __WIP_TRACKING__ declarations
    ├── api/
    │   └── wip.ts                 # trimmed rt-client API surface (§6.6)
    ├── types/
    │   └── index.ts               # trimmed rt-client types (§6.5)
    ├── hooks/
    │   └── useTrackingMode.ts     # resolves ?tracking= query param vs __WIP_TRACKING__
    └── components/
        ├── ScanBar.tsx            # edit box + Search + banners + New Scan
        ├── TabStrip.tsx           # three-tab header (Main | Data Collection | Step Parameters)
        ├── MainTab.tsx            # WipInfoCard + EquipmentTable (+ override select)
        ├── WipInfoCard.tsx        # identity/status/order/product/step/equipment summary
        ├── EquipmentTable.tsx     # StepEquipmentStatus[] rendering
        ├── DataCollectionTab.tsx  # dynamic fields from data_definitions[]
        ├── StepParametersTab.tsx  # reference grid + actual-value inputs
        └── ActionBar.tsx          # Start / Complete (+ result, disposition, qty inputs)
```

### 6.5 Type Definitions (trimmed from `clients/run_time/src/types/index.ts`)

Keep verbatim: `Unit`, `Lot`, `RouteStep`, `StepParameter`, `DataDefinition`,
`Disposition`, `DispositionCatalog`, `StepContext`, `StepEquipmentStatus`,
`EquipmentCurrentState` (optional), `Product` (for product name display).
Drop everything else (genealogy, inventory, performance, materials, orders, dispatch
strategies, events) unless a future enhancement needs it.

### 6.6 API Surface (`src/api/wip.ts`)

Axios instance `baseURL: "/api/v1"` with the standard `unwrap`/`unwrapList` helpers.

| Function                  | HTTP call                                                            | Used by            |
|---------------------------|----------------------------------------------------------------------|--------------------|
| `fetchUnitBySerial`       | `GET /units/by-serial/{serial}`                                      | ScanBar (unit)     |
| `fetchLotByNumber`        | `GET /lots/by-number/{number}`                                       | ScanBar (lot)      |
| `fetchUnitStepContext`    | `GET /units/{id}/step-context`                                       | ScanBar, refreshes |
| `fetchLotStepContext`     | `GET /lots/{id}/step-context`                                        | ScanBar, refreshes |
| `fetchStepEquipment`      | `GET /dispatch/step-equipment/{stepId}?material_id&assigned_equipment_id` | MainTab       |
| `startUnit`               | `POST /units/{id}/start` `{equipment_id}`                            | ActionBar.Start    |
| `startLot`                | `POST /lots/{id}/start` `{equipment_id}`                             | ActionBar.Start    |
| `collectDataBatch`        | `POST /data/collect-batch` `{items:[{definition_id, unit_id\|lot_id, value_numeric\|value_string\|value_boolean, upsert:true}]}` | DataCollectionTab per-item Save |
| `fetchDataPoints`         | `GET /data/points?unit_id\|lot_id={id}&limit=200` | App (DC hydration)  |
| `recordParameterValues`   | `POST /segment-parameter-values/batch` `{items:[{parameter_id, unit_id\|lot_id, value_numeric\|value_string\|value_boolean}]}` | StepParametersTab per-row Save |
| `fetchParameterValues`    | `GET /segment-parameter-values?unit_id\|lot_id={id}&limit=200` | App (SP hydration) |
| `completeUnit`            | `POST /units/{id}/complete` `{result, data_snapshot, disposition}`   | ActionBar.Complete |
| `completeLot`             | `POST /lots/{id}/complete` `{quantity_out, quantity_scrapped, disposition, data_snapshot}` | ActionBar.Complete |
| `moveUnit`                | `POST /units/{id}/move` `{result, disposition}`                      | ActionBar.Complete |
| `moveLot`                 | `POST /lots/{id}/move` `{result, disposition}`                       | ActionBar.Complete |
| `fetchProducts`           | `GET /products?limit=200`                                            | WipInfoCard (name) |

Error extraction helper shared across components:

```ts
export function apiErrorMessage(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message ?? "Request failed";
}
```

### 6.7 Application State Model

All state lives in `App.tsx` (no router, no global store):

```
context: StepContext | null        // set by search, refreshed after actions
activeTab: "main" | "dc" | "sp"    // defaults to "main" on load
loading, error, successMsg         // scan/action feedback
dataValues: Record<string,string>  // Data Collection entries (definition id → raw text)
paramValues: Record<string,string> // Step Parameter actuals (parameter id → raw text)
savedValues: Record<string,string> // DC values persisted (hydrated from server; Complete snapshot source)
savedParamValues: Record<string,string> // SP actuals persisted (hydrated from server)
equipmentOverride: string          // "" = auto-dispatch
completeResult, selectedDisposition, qtyOut, qtyScrapped
```

TanStack Query keys: `["step-equipment", stepId, materialId, assignedEquipId]`
(refetchInterval 10 s), `["product", productId]`.

### 6.8 Complete Transaction Detail

`handleComplete()` executes in order, aborting on first failure:

1. DC values and step-parameter actuals need no submission here — each field's
   Save button already persisted them (server upsert); `savedValues` /
   `savedParamValues` mirror what the server holds.
2. Build `dataSnapshot`: DC codes → parsed values from `savedValues`, plus each
   non-empty step-parameter actual from `savedParamValues`/`paramValues` keyed by
   parameter name.
3. Unit: `POST /units/{id}/complete {result, data_snapshot, disposition}`;
   Lot: `POST /lots/{id}/complete {quantity_out?, quantity_scrapped?, disposition, data_snapshot}`.
4. `POST …/move {result, disposition}` to advance along the route.
5. Invalidate `["step-equipment"]`, re-fetch step context, set success banner
   ("Step completed"), clear `savedValues`/`paramValues`/`savedParamValues` for the next step.

Client-side guard before step 1: every `is_required` step parameter must have a
non-empty actual value (entered or already saved), else show "Required value(s)
missing: …" and abort.

---

## 7. Implementation Steps

Each phase ends in a verifiable state. Steps are ordered so the app boots early and
grows incrementally.

### Phase 1 — Scaffold (target: blank app renders at :5177)

1. Create `clients/wip_client/` with `package.json` copied from `clients/run_time`
   (rename to `"name": "wip_client"`, `"version": "1.0.0"`; dependencies identical).
2. Copy `tsconfig.json`, `tsconfig.app.json` verbatim from `clients/run_time`.
3. Write `vite.config.ts`: react + tailwind + PWA plugins; `define` includes
   `__WIP_TRACKING__`; dev `server.port = 5177`; `/api` proxy from `MES_SERVER_URL`;
   PWA manifest `name: "MES AI WIP Client"`, `short_name: "MES WIP"`.
4. Write `index.html` (title "MES WIP — Shop Floor") and copy the four icon/SVG assets
   from `clients/run_time/public/`.
5. Write `src/index.css` (tailwind import + `.btn-primary`, `.btn-success`,
   `.input-field` component layers), `src/vite-env.d.ts` (declare `__MES_VERSION__`,
   `__MES_RELEASE_DATE__`, `__WIP_TRACKING__`), `src/main.tsx`, placeholder `App.tsx`.
6. `npm install` inside `clients/wip_client`.
7. Verify: `.\run-client.ps1 wip-client` serves the placeholder at http://localhost:5177.

### Phase 2 — Types and API Layer

1. Create `src/types/index.ts` with the trimmed type set (§6.5).
2. Create `src/api/wip.ts` with the axios instance, unwrap helpers, error-message
   helper, and all functions from §6.6.
3. Verify: `npx tsc -b` compiles cleanly.

### Phase 3 — Shell: Scan Bar, Tabs, Empty Panels

1. Implement `hooks/useTrackingMode.ts` — parse `?tracking=` from
   `window.location.search`, fall back to `__WIP_TRACKING__`, expose
   `{ mode, isLot }`.
2. Implement `ScanBar.tsx` — controlled input (autofocus, Enter handler), Search
   button with loading state, error/success banner slots, "New Scan" reset link.
3. Implement `TabStrip.tsx` — three buttons driven by `activeTab` prop; disabled
   until context exists; aria-selected styling.
4. Wire `App.tsx`: `handleSearch` performs the by-number/by-serial lookup then the
   step-context fetch (per tracking mode), stores `context`, switches to Main tab;
   `resetScan` clears all state.
5. Render empty placeholder panels for the three tabs.
6. Verify: search a known lot/serial from a seeded database — Main placeholder
   appears; unknown id shows the red banner.

### Phase 4 — Main Tab

1. Implement `WipInfoCard.tsx` — identity line (type + mono identifier + status
   badge), detail rows (order, product name via `fetchProducts` cache, quantity+UoM
   for lots, current step "{seq} – {name}", assigned equipment, hold reason).
2. Implement `EquipmentTable.tsx` — TanStack Query against `fetchStepEquipment`
   (enabled when step exists and status ∈ {queued, in_process}, 10 s poll);
   render code/name/state/queue/capacity/material-setup/assigned; empty-state text
   "No equipment configured for this step."
3. Compose `MainTab.tsx` — info card, then equipment table; when `queued`, add the
   Equipment Override select (options = rows with `material_setup`).
4. Verify: Main tab populates for a queued lot; override select lists eligible
   machines; polling updates queue depth.

### Phase 5 — Data Collection Tab

1. Implement `DataCollectionTab.tsx` — map `data_definitions[]` to controls per
   §5.2; bind to `dataValues` via props; show required markers, UoM, spec ranges;
   one **Save** button per field calling `collectDataBatch` with `upsert: true`
   and merging into `savedValues`.
2. Verify: enter a value, press its Save, confirm the row appears via
   `GET /data/points?unit_id|lot_id=…`; re-Save (same or new value) updates the
   same row; relaunching the client and re-scanning pre-populates the field.

### Phase 6 — Step Parameters Tab

1. Implement `StepParametersTab.tsx` — table/grid: Parameter (with required marker),
   Target, Lower, Upper, UoM (read-only reference) + editable **Actual** column
   bound to `paramValues`, with a per-row **Save** button calling
   `recordParameterValues` (server upsert) and merging into `savedParamValues`.
2. Verify: enter a value, press its Save, confirm the row appears via
   `GET /segment-parameter-values?unit_id|lot_id=…`; re-Save (same or new value)
   updates the same row; relaunching the client and re-scanning pre-populates the
   actual; required-empty state is visually flagged.

### Phase 7 — Action Bar (Start / Complete)

1. Implement `ActionBar.tsx`:
   - Start button gating (`status === "queued"`); onClick → `startUnit/startLot`
     with `equipmentOverride || undefined`; success banner "Started processing";
     refresh context.
   - Complete options row (result select per `outgoing_conditions`, disposition
     select per `dispositions[]` with destination-step annotations, qty out/scrap
     for lots) shown when `status === "in_process"`.
   - Complete button executing the §6.8 transaction; required-parameter validation
     gate; success banner "Step completed".
2. Disable both buttons during in-flight actions; surface `apiErrorMessage` on failure.
3. Verify end-to-end against a seeded route: scan → Start (status flips to
   in_process, equipment assigned) → fill DC + parameter actuals → Complete
   (status advances to next step or terminal; genealogy/data points recorded).

### Phase 8 — Polish

1. Status badge color map; loading skeletons/spinners on search and polls.
2. Keyboard flow check: focus lands in scan box on mount and after New Scan.
3. ESLint clean (`npm run lint`); production build passes (`npm run build`).
4. PWA manifest sanity-check in dev (installable, icons resolve).

### Phase 9 — Launcher, Service, and Deployment Integration

1. **`run-client.ps1` / `run-client.sh`**
   - Add map entry: `"wip-client" = @{ Dir = "clients\wip_client"; DefaultPort = 5177; Label = "WIP Client" }`.
   - Add `[string]$Tracking = ""` parameter; validate ∈ {"", "lot", "unit"};
     export `WIP_TRACKING` alongside `MES_SERVER_URL`; update help text/examples.
2. **`run-client-production.ps1` / `.sh`**
   - Add map entry (DefaultPort 4177) and the same `-Tracking` handling.
3. **`run-client-service.ps1` / `.sh`**
   - Add map entry; read optional `Tracking` key from the conf file and append
     `WIP_TRACKING=<value>` to `AppEnvironmentExtra`.
4. **`wip-service.conf`** (new, modeled on `rt-service.conf`)
   - `Client = wip-client`, `ServiceName = MesAI-WipClient`,
     `ServiceDisplayName = MES AI WIP Client`, `Port = 5177`, `Tracking = unit`,
     `ServerUrl = http://localhost:8082`.
5. **`clients/nginx.conf`** — no change (config is generic per-container); document
   that the wip-client image mounts `clients/wip_client/dist` at `/usr/share/nginx/html`.
6. Update `README.md` client list and the User Guide's client table (one paragraph +
   screenshot slot).
7. Verify: `.\run-client.ps1 wip-client -Tracking lot -ServerUrl http://localhost:8082`
   starts with correct banner; `.\run-client-service.ps1 install -ConfigFile .\wip-service.conf`
   registers and serves on 5177.

### Phase 10 — Testing and Sign-off

1. Manual matrix (§8 acceptance criteria) executed against a seeded database
   (pharma tablet example route recommended — it exercises lots, DC definitions,
   and step parameters).
2. Optional SQA: extend `SQA/` Playwright suite with a `wip-client` spec covering
   scan → start → complete happy path (mirroring `SQA/tests` conventions).
3. Cross-browser smoke: Chrome, Edge; tablet viewport (1280×800 and 800×1280).

---

## 8. Acceptance Criteria

- [ ] Launching with `-Tracking lot` makes Search resolve lot numbers; `-Tracking unit`
      resolves serial numbers; `?tracking=` overrides at runtime.
- [ ] `-ServerUrl` (and service-conf `ServerUrl`) correctly proxies API traffic.
- [ ] Unknown identifier produces a clear inline error; valid identifier loads all
      three tabs (DC/SP disabled states gone).
- [ ] Main tab shows full WIP info and the equipment-at-step table, refreshing
      automatically.
- [ ] Data Collection tab renders the exact field set/types/limits defined for the
      current step; Save persists without completing.
- [ ] Step Parameters tab shows targets/limits and accepts actuals; missing required
      actuals block Complete with a named-message.
- [ ] Start transitions queued → in_process with chosen/auto equipment; button
      disables appropriately in other statuses.
- [ ] Complete persists DC batch + parameter snapshot, applies result/disposition
      (and lot quantities), advances the WIP, and refreshes the screen.
- [ ] `npm run lint`, `npm run build`, and `tsc -b` all pass.
- [ ] Dev (:5177), preview (:4177), and NSSM service deployments all serve the app.

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Step-parameter actuals needed first-class per-WIP storage | Added `segment_parameter_values` table + `/segment-parameter-values` REST (upsert) — mirrors data_points; the completion `data_snapshot` is retained for reporting. |
| Port collisions in shared dev environments | 5177/4177 verified unused; `-Port` override supported by all launchers. |
| Scanner hardware sends suffix keystrokes (Enter/Tab) | Enter triggers search natively; Tab-order tested in Phase 8. |
| Long-running step-context staleness during processing | 10 s equipment poll + post-action refetch; acceptable for v1 (rt-client parity). |
| Duplicate DC rows on repeat Save | Per-item Save sends `upsert: true`; the server updates the current (definition, WIP) row in place. |

---

## 10. Future Enhancements (Post-v1)

- Hold / Release Hold / Scrap with disposition catalogs (UI blocks already specced
  in rt-client — portable).
- Material consumption tab for BOM-bearing steps.
- Step-history table on the Main tab.
- WebSocket subscription for live status/equipment updates.
- Multi-language labels; dark theme for dim shop floors.

---

## 11. Effort Estimate

| Phase | Description                          | Est. effort |
|-------|--------------------------------------|-------------|
| 1     | Scaffold                             | 0.5 d       |
| 2     | Types + API layer                    | 0.5 d       |
| 3     | Shell: scan bar, tabs, routing-less state | 1 d    |
| 4     | Main tab (info + equipment)          | 1 d         |
| 5     | Data Collection tab                  | 0.5 d       |
| 6     | Step Parameters tab                  | 0.5 d       |
| 7     | Action bar (Start/Complete)          | 1 d         |
| 8     | Polish, lint, build                  | 0.5 d       |
| 9     | Launcher/service/deployment wiring   | 0.5 d       |
| 10    | Testing and sign-off                 | 1 d         |
| **Total** |                                  | **~7 days** |