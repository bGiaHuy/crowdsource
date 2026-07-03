# FPTU Student Guide — System Context (Source of Truth)

> **Generated**: 2026-07-04 | **Codebase Commit Scope**: Full static analysis of `frontend/`, `backend/`, `scripts/`, `data/`, `docs/`
> **Live**: [fptu-studentguild.vercel.app](https://fptu-studentguild.vercel.app/)

---

## 1. System Architecture & Tech Stack

### Pattern
- **Monorepo, 2-Tier Client-Server** — React SPA ↔ FastAPI REST API
- **Offline-first pathfinding**: Navigation grid (`delta_nav_grid.json`) is bundled as a static asset in `frontend/public/data/` and computed entirely client-side in a **Web Worker** (zero backend dependency for routing).
- **RAG-based AI Chat**: Backend performs vector similarity search (pgvector) → injects context → calls Groq LLM → returns structured JSON.

### Frontend
| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19.x |
| Build | Vite | 8.x |
| State | Zustand (persisted) | 5.x |
| Routing | react-router-dom | 7.x |
| Animation | framer-motion | 12.x |
| Icons | lucide-react | 1.x |
| HTTP | axios | 1.x |
| Auth Client | @supabase/supabase-js | 2.x |
| Map (unused legacy) | leaflet / react-leaflet / react-konva | — |
| Linter | oxlint | 1.x |

### Backend
| Layer | Technology | Version |
|---|---|---|
| Framework | FastAPI | 0.115.x |
| ORM | SQLAlchemy (async) | 2.x |
| DB Driver | asyncpg | 0.30 |
| Database | PostgreSQL 16 + PostGIS 3.4 | via Docker |
| Vector Search | pgvector | 0.3.6 |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`) | optional import |
| LLM | Groq SDK (async) | 0.15 — model: `llama-3.1-8b-instant` |
| Auth | PyJWT (Supabase JWT verification) | 2.x |
| Config | pydantic-settings | 2.x |

### Infrastructure / Deployment
| Component | Target |
|---|---|
| Frontend | **Vercel** (SPA rewrite → `index.html`) |
| Backend | **Render** (free plan, `uvicorn main:app`) |
| Database (prod) | **Supabase** PostgreSQL (pgvector extension) |
| Database (local) | Docker `postgis/postgis:16-3.4` |
| Auth | **Supabase Auth** (Google OAuth / Email+Password) |

---

## 2. Project Structure & Dependency Map

```
FPTU-STUDENT-GUILD/
├── backend/
│   ├── main.py                  # FastAPI app, CORS (allow_origins=["*"]), middleware mount
│   ├── config/
│   │   └── settings.py          # Pydantic BaseSettings, lru_cached singleton
│   ├── database/
│   │   ├── connection.py        # Async engine, session factory, pgvector type registration
│   │   ├── models.py            # 10 SQLAlchemy ORM models (Campus→Building→Floor→Room/Node/Edge + Chat + Knowledge)
│   │   └── seed.py              # Reads frontend/public/data/delta_draft.json → seeds rooms to DB
│   ├── middlewares/
│   │   └── auth_middleware.py   # SupabaseAuthMiddleware — JWT decode on /api/chat only, non-blocking
│   ├── routers/
│   │   ├── map_router.py        # /api/map/* — campuses, floors, map-items, full-graph, metadata
│   │   ├── chat_router.py       # /api/chat — POST, rate limiter (DISABLED), Groq AI
│   │   └── search_router.py     # /api/search — ILIKE search on Room.room_code / Room.name
│   ├── schemas/
│   │   ├── map_schemas.py       # Pydantic response models (Campus/Building/Floor/Node/Edge/Room/FullGraph/RoomMetadata)
│   │   └── chat_schemas.py      # ChatMessage, ChatRequest, ChatResponse
│   ├── services/
│   │   ├── groq_service.py      # RAG pipeline: embed query → vector search 3 tables → build context → Groq completion
│   │   └── rate_limiter.py      # Daily rate limit per user_id (currently disabled in router)
│   └── requirements.txt
│
├── frontend/
│   ├── index.html               # SPA shell, <title>frontend</title> ← DEBT
│   ├── vite.config.js           # Minimal config: react plugin only
│   ├── vercel.json              # SPA rewrite rule
│   ├── package.json
│   ├── public/
│   │   ├── data/
│   │   │   ├── delta_draft.json       # Floor plans: items, bboxes, metadata (4 floors, Delta building)
│   │   │   ├── delta_nav_grid.json    # RLE-compressed walkability grids + access_points per floor
│   │   │   ├── delta_route_graph.json # Legacy node-edge graph (unused by active pathfinder)
│   │   │   └── geo.json               # GeoJSON outlines (unused)
│   │   └── assets/, mapping/
│   └── src/
│       ├── main.jsx              # ReactDOM.createRoot, StrictMode
│       ├── App.jsx               # BrowserRouter, auth-gated routes, Supabase session listener
│       ├── App.css / index.css   # Design system: CSS variables, glass-panel, animations
│       ├── stores/
│       │   └── useAppStore.js    # Single Zustand store: user, map, routing, chat state (persists chatMessages + campus to localStorage)
│       ├── services/
│       │   ├── api.js            # Axios instance, named exports: getCampuses, getFloors, getFullGraph, getMapItems, searchRooms, sendChatMessage
│       │   └── supabase.js       # Supabase client init (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
│       ├── workers/
│       │   └── pathfinder.worker.v2.js  # Theta* on RLE grid, multi-floor hierarchical routing, MinHeap, Supercover LOS
│       ├── utils/
│       │   └── pathfinding.js    # Legacy Dijkstra on node-edge graph (not active — guarded by "DO NOT wire" comment)
│       ├── components/
│       │   ├── layout/
│       │   │   └── Layout.jsx    # Header (desktop pill nav), main <Outlet/>, mobile bottom nav
│       │   ├── map/
│       │   │   ├── DraftImageMap.jsx     # PRIMARY map renderer — SVG bbox rects, pan/zoom/rotate/3D, route polyline
│       │   │   ├── MapContainer.jsx      # LEGACY SVG polygon renderer (non-draft mode only)
│       │   │   ├── SearchBar.jsx         # Client-side fuzzy search across all floor items, accent-stripped
│       │   │   ├── PathfindingPanel.jsx  # Start/End input + map-click selection + route results display
│       │   │   ├── FloorSelector.jsx     # Horizontal floor tabs
│       │   │   ├── FloorPlanView.jsx/css # Unused / superseded
│       │   │   ├── RoomDetailPanel.jsx   # Room info popup (metadata fetch)
│       │   │   ├── DigitizedMap.jsx      # Unused alternate renderer
│       │   │   ├── GeoJsonMap.jsx        # Leaflet-based GeoJSON renderer (unused)
│       │   │   └── PathfindingDisabledChip.jsx
│       │   └── chat/
│       │       └── ChatPanel.jsx  # Full chat UI: sidebar, messages, suggested prompts, Groq interaction
│       ├── pages/
│       │   ├── HomePage.jsx       # Hero section, 3 feature cards (Map/Portal/AI)
│       │   ├── MapPage.jsx        # Orchestrator: fetches data, manages Web Worker lifecycle, wires routing
│       │   ├── ChatPage.jsx       # Thin wrapper → <ChatPanel />
│       │   ├── PortalPage.jsx     # Static academic info portal (FAP, FLM, CMS guides)
│       │   ├── ProfilePage.jsx    # User profile display
│       │   ├── AuthPage.jsx       # Login/Register with Google OAuth + email/password
│       │   ├── AuthCallbackPage.jsx # OAuth redirect handler
│       │   └── ResetPasswordPage.jsx
│       └── tools/
│           └── DeltaMapAnnotationTool.jsx  # DEV-only: visual bbox annotation tool (lazy-loaded)
│
├── scripts/                    # 33 Python utility scripts for data pipeline (OCR, Excel→JSON, graph building, validation)
├── data/                       # Raw content, map drafts, map sources
├── docs/                       # supabase_schema_setup.sql, content guidelines
├── docker-compose.yml          # PostGIS 16-3.4 on port 5432
├── render.yaml                 # Backend deployment manifest
└── start.bat                   # Local dev launcher
```

### Module Responsibility Summary

| Module | Responsibility |
|---|---|
| `stores/useAppStore.js` | **SOLE state owner**. All cross-component data flows through this Zustand store. |
| `workers/pathfinder.worker.v2.js` | **ACTIVE pathfinder**. Theta* grid search, multi-floor routing via stairs/elevator. Runs off-main-thread. |
| `utils/pathfinding.js` | **DEAD CODE**. Legacy Dijkstra on node-edge graph. Explicitly flagged "DO NOT wire to public UI". |
| `components/map/DraftImageMap.jsx` | **PRIMARY map view** (1331 lines). SVG rendering of bbox-based floor plans with pan/zoom/rotate/3D mode. |
| `components/map/MapContainer.jsx` | **SECONDARY map view**. SVG polygon renderer. Only activates when `isDeltaDraftMode === false`. |
| `services/groq_service.py` | **RAG pipeline**. Embeds user query → cosine search 3 knowledge tables → injects context → Groq JSON completion. |
| `scripts/` | **Offline data pipeline**. Excel → JSON conversion, OCR coordinate extraction, graph building, DB seeding, validation. NOT part of runtime. |

---

## 3. Core Data Flow & State Management

### 3.1 Zustand Store Shape (`useAppStore.js`)

```
{
  // ── Auth ──
  user: User | null,

  // ── Map Navigation ──
  currentCampus: string,          // default: "HN"
  currentBuilding: string,        // default: "DELTA"
  currentFloorId: number | null,  // floor.id or floor.floor (int)
  floors: Floor[],
  mapItems: Room[],               // items for current floor (non-draft mode)
  mapError: string | null,

  // ── Draft Delta Mode ──
  isDeltaDraftMode: boolean,      // true when building === "DELTA"
  draftDeltaData: DeltaDraftJSON, // loaded from /data/delta_draft.json
  navGridData: NavGridJSON,       // loaded from /data/delta_nav_grid.json
  graphData: FullGraphResponse,   // from API /api/map/buildings/:id/full-graph (non-draft)

  // ── Room Selection ──
  selectedRoom: Room | null,
  selectedMapItem: Item | null,   // currently selected bbox item
  highlightedRoomCode: string,    // room_code to visually highlight

  // ── Routing ──
  routeStart: RoutePoint | null,  // { type, roomCode, itemId, bboxCenter: {x,y,floor}, label }
  routeEnd: RoutePoint | null,
  routePath: PathNode[],          // [{x, y, floor, type?}, ...]
  routeMetadata: { distance, floors_traversed, estimated_time_seconds, instructions },
  routeError: string | null,
  isCalculatingRoute: boolean,
  routingSelectionMode: 'start' | 'end' | null,
  routeTriggerKey: number,        // incremented to force worker recalculation
  preferElevator: boolean,

  // ── Chat ──
  chatMessages: ChatMessage[],    // persisted to localStorage
  isChatOpen: boolean,
}
```

**Persistence**: Only `chatMessages` and `currentCampus` are persisted to `localStorage` via Zustand `persist` middleware (key: `fptu-student-guide-storage`).

### 3.2 Entity-Relationship Diagram

```
┌──────────┐    1:N    ┌──────────┐    1:N    ┌──────────┐
│  Campus  │──────────▶│ Building │──────────▶│  Floor   │
│ (HN,HCM) │          │(DELTA,..)│          │(1,2,3,4) │
└──────────┘          └──────────┘          └────┬─────┘
                                                  │ 1:N
                                   ┌──────────────┼──────────────┐
                                   ▼              ▼              ▼
                              ┌────────┐    ┌────────┐    ┌──────────┐
                              │  Room  │    │  Node  │    │   Edge   │
                              │(items) │    │(graph  │    │(graph    │
                              │        │    │vertex) │    │edge)     │
                              └────────┘    └────────┘    └──────────┘

┌──────────────────┐    ┌────────┐    ┌──────────┐    ┌──────────────┐
│ChatbotKnowledge  │    │  FAQ   │    │ Article  │    │ RoomMetadata │
│(intent, embedding│    │(Q/A,   │    │(title,   │    │(room detail  │
│ approved_answer) │    │embed.) │    │ embed.)  │    │ hours, etc.) │
└──────────────────┘    └────────┘    └──────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐
│  ChatRequest │    │   Profiles   │  ← Supabase auth.users trigger
│(rate limit)  │    │(email, role) │
└──────────────┘    └──────────────┘
```

### 3.3 Key Payload Structures

#### `delta_draft.json` (Static, per building)
```json
{
  "building": { "name": "Delta" },
  "floors": [
    {
      "floor": 1,
      "floor_name": "Tầng 1",
      "floor_number": 1,
      "image_width": 2800,
      "image_height": 1200,
      "image_min_x": 0,
      "image_min_y": 0,
      "image_path": "/mapping/...",
      "items": [
        {
          "item_id": "DE-F1-room-201",
          "room_code": "DE-201",
          "display_name": "Phòng 201",
          "item_type": "room|office|stair|elevator|toilet|lobby|...",
          "bbox": { "min_x", "min_y", "max_x", "max_y" },
          "is_clickable": true,
          "searchable": true,
          "aliases": []
        }
      ]
    }
  ]
}
```

#### `delta_nav_grid.json` (Static, per building)
```json
{
  "cell_size": 8,
  "floors": {
    "1": {
      "width": 350,
      "height": 150,
      "rle": [120, 5, 80, ...],    // Run-Length Encoded: alternating walkable/wall counts
      "access_points": {
        "DE-F1-stair-01": {
          "type": "stair",
          "center_x": 400, "center_y": 200,
          "points": [{ "x": 50, "y": 25 }]  // grid coordinates
        }
      }
    }
  }
}
```

#### RoutePoint (Zustand state)
```json
{
  "type": "room|click",
  "roomCode": "DE-201",
  "itemId": "DE-F1-room-201",
  "bboxCenter": { "x": 1400, "y": 600, "floor": 1 },
  "label": "DE-201 - Tầng 1"
}
```

#### Worker Message Protocol
```
Main → Worker:
  { type: "CALCULATE_ROUTE", payload: { gridData, startBboxCenter, endBboxCenter, startItemId, endItemId, preferElevator } }

Worker → Main:
  { type: "ROUTE_RESULT", payload: { path, distance, floors_traversed, estimated_time_seconds, instructions, compute_time_ms } }
  { type: "ROUTE_ERROR", payload: "error message string" }
```

#### Chat API Contract
```
POST /api/chat
Request:  { messages: [{role, content}], user_id: string }
Response: { answer: string, room_codes: string[], related_actions: string[] }
```

---

## 4. Key Workflows & Business Logic

### 4.1 Indoor Pathfinding (Primary Feature)

```
Step 1: MapPage.useEffect → fetch("/data/delta_draft.json") → setDraftDeltaData(data)
Step 2: MapPage.useEffect → fetch("/data/delta_nav_grid.json") → setNavGridData(gridData)
Step 3: MapPage.useEffect → new Worker("pathfinder.worker.v2.js")
Step 4: User selects start/end via:
        a) PathfindingPanel autocomplete → selectStart/selectEnd → setRoutePoints()
        b) Map click in routingSelectionMode → handleMapClick() → setRouteStart/End()
Step 5: User clicks "Tìm đường" → handleFindPath() → incrementRouteTrigger()
Step 6: MapPage.useEffect[routeTriggerKey] detects change →
        worker.postMessage({ type: "CALCULATE_ROUTE", payload: { gridData, startBboxCenter, endBboxCenter, ... } })
Step 7: Worker:
        a) loadGrid(gridData) — decompresses RLE → Uint8Array per floor, builds access_points Map
        b) findHierarchicalPath(startPt, endPt, preferElevator):
           IF same floor:
             thetaStar(sx, sy, ex, ey, floorData) — 8-way grid search with Supercover LOS optimization
           ELSE (cross-floor):
             Phase 1: For each stair/elevator on start floor → thetaStar to it → estimate total cost
             Phase 2: Select best stair/elevator (applying elevator preference penalty)
             Phase 3: thetaStar from matched stair on end floor → destination
             Intermediate floors: pass-through waypoints
        c) Convert grid coords → pixel coords (× cell_size + cell_size/2)
        d) Simplify path (remove collinear points via cross-product)
        e) Calculate distance: totalPixelDist / 32.5 PIXELS_PER_METER
        f) Estimate time: distanceInMeters / 1.2 m/s
Step 8: worker.postMessage({ type: "ROUTE_RESULT", payload: {...} })
Step 9: MapPage.onmessage → setRoutePath(), setRouteMetadata()
Step 10: DraftImageMap renders polyline over SVG
```

#### Theta* Algorithm Details
- **Grid**: `Uint8Array`, 0 = walkable, 1 = wall
- **Heuristic**: Euclidean distance
- **Optimization**: Parent-shortcutting via `supercoverLineOfSight()` — Bresenham variant that checks ALL cells the line passes through
- **Priority Queue**: Custom Binary MinHeap
- **8-directional movement**: Cardinal (cost 1.0) + Diagonal (cost 1.414)
- **Cross-floor cost**: `FLOOR_CHANGE_COST = 50` per floor difference
- **Elevator preference**: `stair penalty = 100000` when `preferElevator === true`

### 4.2 AI Chat (RAG Pipeline)

```
Step 1: ChatPanel.submitMessage(text) → addChatMessage({role:"user", content})
Step 2: sendChatMessage(messages, userId) via API:
        - Fetches Supabase access_token → Bearer header
        - POST /api/chat { messages, user_id }
Step 3: Backend chat_router:
        - (Rate limiting DISABLED)
        - generate_chat_response(messages, db)
Step 4: groq_service.search_knowledge(lastMessage, db):
        a) Embed query via sentence-transformers all-MiniLM-L6-v2 → 384-dim vector
        b) 3 parallel cosine similarity searches (pgvector `<=>` operator):
           - chatbot_knowledge (intent, approved_answer) — LIMIT 2
           - faqs (question, answer) — LIMIT 2
           - articles (title, content[:500]) — LIMIT 2
        c) Concatenate results into context string
Step 5: Inject context into SYSTEM_PROMPT template
Step 6: Groq API call:
        - Model: llama-3.1-8b-instant
        - response_format: json_object
        - temperature: 0.2
Step 7: Parse JSON response → ChatResponse { answer, room_codes[], related_actions[] }
Step 8: Frontend: addChatMessage({role:"assistant", content: answer})
Step 9: If room_codes present → setHighlightedRoomCode(room_codes[0]) (map highlight)
```

### 4.3 Authentication Flow

```
Step 1: AuthPage — Google OAuth or Email/Password via Supabase client
Step 2: Supabase redirects to /auth/callback → AuthCallbackPage handles session extraction
Step 3: App.jsx useEffect:
        - supabase.auth.getSession() → setUser(session?.user)
        - supabase.auth.onAuthStateChange() → setUser on change
Step 4: Route guard: "/" requires user → redirects to "/auth" if null
Step 5: Backend auth: SupabaseAuthMiddleware only enforces on /api/chat:
        - Extracts Bearer token → jwt.decode with SUPABASE_JWT_SECRET
        - Sets request.state.user (non-blocking — auth failure = optional debug log)
```

### 4.4 Room Search

```
Step 1: User types in SearchBar → handleSearch(val)
Step 2: Client-side filter:
        - Strips Vietnamese diacritical marks (NFD decomposition)
        - Multi-word AND matching on room_code, display_name, item_id, aliases
        - Limit 20 results
Step 3: On select → setCurrentFloorId(floor_id), setSelectedMapItem(item), setHighlightedRoomCode(code)
Step 4: If no results → "Hỏi Cóc AI" button → saves query to sessionStorage → navigate("/chat")
Step 5: ChatPanel.useEffect reads pending_ai_query → auto-submits to AI
```

### 4.5 Data Seeding Pipeline

```
Step 1: scripts/convert_delta_xlsx.py — Excel floor plans → delta_draft.json (bbox coordinates, item metadata)
Step 2: scripts/build_routing_graph.py — delta_draft.json → delta_nav_grid.json (RLE grids, access_points)
Step 3: backend/database/seed.py — delta_draft.json → PostgreSQL rooms table
        - Reads from frontend/public/data/delta_draft.json
        - Idempotent: deletes existing DELTA rooms before re-insert
        - Supports --reset-db flag for full table recreation
```

---

## 5. UI/UX Rules & Interaction Patterns

### 5.1 Layout System

| Element | Desktop | Mobile (≤768px) |
|---|---|---|
| Header | 64px, pill navigation bar with 5 items | 52px, brand only ("FPTU"), logout icon |
| Navigation | Header pill nav | Fixed bottom nav (60px + safe-area) |
| Map content | Full remaining height | Full height minus header, floor selector, bottom nav |
| Floor Selector | Static bottom bar | Fixed above bottom nav |
| PathfindingPanel | Absolute positioned left panel (360px max) | Collapses to static, auto-expands on interaction |
| SearchBar | Max-width 400px, top-left overlay | Full width |

### 5.2 Map Interaction State Machine

```
IDLE
  ├── Click room (no routingSelectionMode) → SELECT_ROOM
  │     └── setSelectedMapItem(item) → InfoCard appears at click position
  │
  ├── Click "Chọn điểm đi" button → ROUTING_SELECT_START
  │     ├── Click room → setRouteStart(point) → exit mode
  │     └── Click empty map → handleMapClick(x,y,floor) → setRouteStart(clickPoint) → exit mode
  │
  ├── Click "Chọn điểm đến" button → ROUTING_SELECT_END
  │     ├── Click room → setRouteEnd(point) → exit mode
  │     └── Click empty map → handleMapClick(x,y,floor) → setRouteEnd(clickPoint) → exit mode
  │
  └── Click "Tìm đường" (both points set) → CALCULATING
        └── Worker result → ROUTE_DISPLAY
              └── Polyline rendered on DraftImageMap, metadata in PathfindingPanel
```

### 5.3 Map Viewport Controls (DraftImageMap)

- **Pan**: Default mode — pointer drag translates position
- **Rotate**: Shift+drag OR right-click-drag OR "rotate mode" button — horizontal = Z-rotation, vertical = X-tilt (3D only)
- **Zoom**: Mouse wheel, clamped [0.1, 10]
- **3D Mode**: CSS `rotateX(tilt) rotateZ(rotation)` with `preserve-3d`, stacks all floors along Z-axis (400px gap)
- **Default orientation**: `rotation: 180°`, `tilt: 60°` — map appears inverted by default
- **Click detection**: Tracks `hasDragged.current` via pointer distance threshold (12px) to distinguish click from drag

### 5.4 DraftImageMap Room Click Logic (lines 688-717)

```javascript
// Priority: routing selection mode > room detail selection
if (routingSelectionMode) {
  // Set as route start/end → exit selection mode
} else {
  setSelectedMapItem(item);
  // Calculate click position relative to container for info card placement
}
```

### 5.5 Design Tokens

- **Primary**: `#F26D21` (FPTU Orange)
- **Glass panels**: `rgba(255,255,255,0.8)` + `blur(20px)` + 1px white border
- **Room colors**: Hardcoded per `item_type` in both `DraftImageMap.jsx` and `MapContainer.jsx`
  - room: `#FFD8B8`, office: `#BFDBFE`, library: `#BBF7D0`, toilet: `#FBCFE8`, stair: `#DDD6FE`, elevator: `#7C3AED`, lobby: `#F1F5F9`, technical: `#FEF08A`
- **Font**: Inter (Google Fonts, loaded in ChatPanel.jsx inline `<style>`)
- **Responsive breakpoint**: Single breakpoint at `768px`

---

## 6. Current Constraints & Known Debt

### Critical

| ID | Issue | Location | Impact |
|---|---|---|---|
| **D1** | **CORS `allow_origins=["*"]`** — wide open, ignores `CORS_ORIGINS` setting | `backend/main.py:18` | Security: any domain can call API |
| **D2** | **Rate limiting is DISABLED** — commented out in chat_router | `chat_router.py:21-24` | No protection against API abuse |
| **D3** | **Auth middleware is non-blocking** — auth failure is silently logged, request proceeds | `auth_middleware.py:33-34` | Unauthenticated users can use /api/chat |
| **D4** | **`PIXELS_PER_METER = 32.5` is hardcoded** — calibration constant for distance estimation | `pathfinder.worker.v2.js:534` | Distance accuracy depends on this single magic number |
| **D5** | **Duplicate `import datetime`** in models.py | `models.py:7` | Minor lint issue |
| **D6** | **Unreachable code** — `return response` after except block in chat_router | `chat_router.py:43` | Dead code after raise in except |
| **D7** | **SQL injection vector** — `emb_str` is string-interpolated into raw SQL | `groq_service.py:60-66` | pgvector embedding inserted via f-string, not parameterized |
| **D8** | **sentence-transformers is optional** — fails silently, returns zero vectors | `groq_service.py:17-22` | RAG search returns empty if not installed, AI has no context |

### Architectural

| ID | Issue | Location |
|---|---|---|
| **A1** | **Dual map renderer** — `DraftImageMap` (bbox) vs `MapContainer` (polygon) are completely separate code paths with duplicated logic | `components/map/` |
| **A2** | **Dead code accumulation** — `GeoJsonMap.jsx`, `DigitizedMap.jsx`, `FloorPlanView.jsx`, `utils/pathfinding.js`, `delta_route_graph.json` are all unused | `frontend/src/` |
| **A3** | **No API-driven pathfinding** — navigation grid is a 56KB static JSON file. Adding new buildings requires regenerating and redeploying the entire frontend | `public/data/delta_nav_grid.json` |
| **A4** | **Single building support** — code hardcodes `currentBuilding: 'DELTA'` and checks `.toUpperCase() === 'DELTA'` for draft mode | `useAppStore.js:14`, `MapPage.jsx:91` |
| **A5** | **No migration system** — `seed.py` uses `create_all()`, no Alembic migrations despite alembic being in requirements | `database/seed.py` |
| **A6** | **Monolith frontend components** — `DraftImageMap.jsx` is 1331 lines, `PathfindingPanel.jsx` is 592 lines, all with inline styles | All map components |
| **A7** | **index.html `<title>` is "frontend"** — no SEO metadata | `frontend/index.html:7` |
| **A8** | **leaflet / react-leaflet / konva in dependencies but unused** — bundle size bloat | `package.json` |
| **A9** | **Inline `<style dangerouslySetInnerHTML>` used extensively** — in Layout.jsx, MapPage.jsx, ChatPanel.jsx instead of proper CSS modules | Multiple components |
| **A10** | **No error boundary** — unhandled React errors crash the entire app | `App.jsx` |

### Hardcoded Values

| Constant | Value | File |
|---|---|---|
| Default campus | `"HN"` | `useAppStore.js:12` |
| Default building | `"DELTA"` | `useAppStore.js:14` |
| Default rotation | `180°` | `DraftImageMap.jsx:77` |
| Default tilt | `60°` | `DraftImageMap.jsx:78` |
| Cell size (nav grid) | `8` (pixels per grid cell) | `delta_nav_grid.json` |
| Pixels per meter | `32.5` | `pathfinder.worker.v2.js:534` |
| Walking speed | `1.2 m/s` | `pathfinder.worker.v2.js:536` |
| Floor change cost | `50` | `pathfinder.worker.v2.js:330` |
| Elevator preference penalty | `100000` | `pathfinder.worker.v2.js:415` |
| Stair proximity threshold | `1600` (grid units) | `pathfinder.worker.v2.js:404` |
| Max search radius | `100` cells | `pathfinder.worker.v2.js:125` |
| Groq model | `llama-3.1-8b-instant` | `settings.py:17` |
| Embedding dim | `384` (MiniLM-L6-v2) | `models.py:145` |
| RAG result limit | `2 per table` | `groq_service.py:60-66` |
| Chat input max | `3000 chars` | `settings.py:21` |
| Daily rate limit | `5 (disabled)` | `settings.py:20` |
| 3D floor Z-gap | `400px` | `DraftImageMap.jsx:603` |
