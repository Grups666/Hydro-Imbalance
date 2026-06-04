# Spatial Research Foundation - Architecture Refactor

## Overview

This document describes the architectural refactoring from a hydrology-specific application to a generic "Spatial Research Foundation" with pluggable domain modules.

## What Changed

### New Directory Structure

```
public/
├── foundation/                   # Generic Foundation Layer
│   ├── core/
│   │   ├── event-bus.js          # Event system for module communication
│   │   ├── module-loader.js      # Module registration and lifecycle
│   │   └── app.js                # Application bootstrap
│   ├── map/
│   │   ├── coordinate-system.js  # Geographic coordinate utilities
│   │   ├── renderer.js           # Canvas map rendering
│   │   ├── interaction.js        # Pan/zoom/hit testing
│   │   ├── layer-manager.js      # Layer stack management
│   │   └── basemap-layer.js      # Land mass rendering
│   └── ui/
│       ├── panel-manager.js      # Panel positioning and state
│       ├── inspector.js          # Generic property inspector
│       └── utilities.js          # HTML/markdown utilities
│
├── modules/                      # Domain-Specific Modules
│   └── hydrology/                # First module: Hydrology Research
│       ├── module.json           # Module declaration
│       └── index.js              # Module entry point
│
├── index.html                    # Legacy UI (unchanged)
└── index-foundation.html         # New Foundation UI

catalog/
├── foundation/                   # Generic catalogs (datasets, models)
└── modules/                      # Module-specific catalogs
    └── hydrology/
        ├── regions/              # Basin profiles (moved)
        └── literature/           # Reference catalog (moved)

config/
└── foundation.json               # Foundation configuration
```

## Key Components

### Foundation Core

| File | Purpose |
|------|---------|
| `event-bus.js` | Generic event system with standard events (feature:click, layer:toggle, etc.) |
| `module-loader.js` | Module registration, loading, activation lifecycle |
| `app.js` | Application bootstrap and dependency injection |

### Foundation Map

| File | Purpose |
|------|---------|
| `coordinate-system.js` | Geo ↔ screen transformations, bbox utilities |
| `renderer.js` | Canvas 2D rendering, background, grid |
| `interaction.js` | Mouse events, pan/zoom, hit testing delegation |
| `layer-manager.js` | Layer registration, ordering, rendering, hit testing |

### Foundation UI

| File | Purpose |
|------|---------|
| `panel-manager.js` | Panel types, show/hide, positioning |
| `inspector.js` | Feature property display |
| `utilities.js` | HTML escape, markdown, formatting |

## Module Declaration Schema

```json
{
  "id": "hydrology",
  "name": "Hydrology Research Module",
  "version": "1.0.0",
  "provides": {
    "layers": [...],
    "panels": [...],
    "catalogs": [...]
  },
  "events": {
    "feature:click": "handleFeatureClick"
  }
}
```

## Module Class Interface

```javascript
class MyModule {
  constructor(foundation) {
    this.foundation = foundation;
    this.eventBus = foundation.eventBus;
  }

  async onLoad() { /* Initialize module */ }
  onActivate() { /* Module becomes active */ }
  onDeactivate() { /* Module becomes inactive */ }

  handleFeatureClick(payload) { /* Event handler */ }
  renderMyPanel(data) { /* Panel renderer */ }
}
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check with module list |
| `/api/modules` | GET | List available modules |
| `/api/modules/:id` | GET | Get module manifest |
| `/api/research` | POST | Research synthesis (delegates to module) |

## Migration Summary

### What Stayed in Foundation
- Canvas rendering engine
- Pan/zoom/interaction handling
- Layer management
- Panel management
- Event system
- UI utilities

### What Moved to Hydrology Module
- Mode classification logic
- Basin rendering with mode colors
- Basin profile panel
- Reference catalog integration
- Research prompt building

### What Remained Unchanged
- `public/app.js` - Legacy application (still works)
- `public/index.html` - Legacy UI entry point
- All data files in `public/assets/`
- All scripts in `scripts/`

## Usage

### Start Server
```bash
node src/server/server.js
```

### Access UIs
- **Legacy UI**: http://127.0.0.1:8791/index.html
- **Foundation UI**: http://127.0.0.1:8791/index-foundation.html

### Create a New Module

1. Create directory: `public/modules/my-module/`
2. Create `module.json` manifest
3. Create `index.js` with module class
4. Register in Foundation bootstrap

## Next Steps

1. **Phase 5**: Complete Inspector system with tabbed panels
2. **Phase 6**: Add more panel types (timeline, attribute table)
3. **Phase 7**: Add script runner for user scripts
4. **Phase 8**: Project save/load functionality
5. **Phase 9**: Create additional modules (e.g., Climate, Ecology)

## Verification

```bash
# Check server health
curl http://127.0.0.1:8791/api/health

# List modules
curl http://127.0.0.1:8791/api/modules

# Get module details
curl http://127.0.0.1:8791/api/modules/hydrology
```
