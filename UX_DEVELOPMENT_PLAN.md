# Floorplan UX Development Plan

Updated: 2026-07-25 (America/Chicago)

Status: Implemented 2026-07-25. Automated engineering gates are complete; the five moderated non-CAD-user sessions remain the external validation step and are prepared in `docs/UX_RESEARCH_PROTOCOL.md`.

## Product outcome

Make Floorplan the fastest way for a desktop user who is not a CAD expert to define one room accurately, add openings and furniture, understand constraints, inspect the result in 3D, and leave with a trustworthy project file or export.

The core problem is not missing rendering capability. The current MVP already has strong geometry, measurement, persistence, export, and 3D foundations. The next stage should reduce uncertainty: what to do next, why a tool is unavailable, what is selected, whether work is saved, and how to make a precise adjustment without trial and error.

## Product guardrails

- Remain an approachable one-room planner, not a CAD/BIM system.
- Keep 2D as the authoritative editing surface and 3D as inspection and selection.
- Remain desktop-browser-first. Improve laptop usability without turning this into a mobile editor.
- Preserve backend-free operation, portable project files, plain-HTTP LAN support, and public container deployment.
- Preserve `schemaVersion: 1` for UI-only work. Store workspace preferences separately from project geometry.
- Keep existing project imports compatible. Any future project-schema change requires an explicit migration and v1 import tests.
- Preserve the Swiss drafting visual system: Inter, white and neutral surfaces, Yves Klein Blue, hairline rules, asymmetric layout, and restrained overlay elevation.
- Do not add decorative shadows, warm-paper styling, themed action labels, fabricated data, or ornamental UI copy.

## Design direction

**Anchor:** Swiss. The existing visual language fits a precision room-planning tool and is already consistently implemented.

**Signature differentiator:** Evolve the selected-wall dimension rail into a unified spatial command surface. Precise values, anchor behavior, snap state, and validation feedback should appear next to the geometry they affect, with the properties panel providing the complete form.

The interface should feel like a clear drafting sheet with progressively disclosed controls, not a three-column form surrounding a canvas.

## Current-state review

### What is already strong

- The rectangle quick-start and editable sample avoid an expert-only blank canvas.
- Feet/inches input, fractions, integer-mil geometry, and wall anchors match real room-measurement workflows.
- Canvas zoom, pan, snapping modifiers, zoom-to-fit, dimensions, undo/redo, and status feedback are implemented.
- The visual system is coherent and avoids generic dashboard styling.
- Doors, windows, furniture collisions, and advisory door-swing warnings share one validated model.
- Portable JSON, recovery snapshots, SVG/PDF/PNG export, and 3D inspection create a complete MVP loop.
- Accessibility, cross-browser smoke coverage, and deployment runtime checks provide a good regression base.

### Highest-impact friction

| Priority | Friction | Current evidence | User impact |
| --- | --- | --- | --- |
| P0 | Startup failures can become a blank page | The recent insecure-context UUID defect had no application-level recovery surface | Users cannot diagnose or recover |
| P0 | Save state is ambiguous | “Save project” downloads a file while recovery snapshots happen separately; the shell does not show dirty, saved, or autosave state | Users may not know what is protected |
| P0 | First-run guidance stops after room creation | The empty prompt offers a rectangle or sample, but no continuing path through openings, furniture, 3D, and export | New users must infer the workflow |
| P1 | Icon-only top actions require hover knowledge | New, Open, Save, Export, Undo, Redo, snapping, dimensions, and fit use compact icons | Slower recognition and more misclicks |
| P1 | Disabled tools hide prerequisites | Door, Window, Furniture, 3D, and Export disable until the room closes; disabled controls cannot provide strong inline guidance | Users see unavailable actions without a clear recovery step |
| P1 | 2D controls remain prominent in 3D | The same tool rail and properties shell remain visible while the view is selection-only | The active mode feels less intentional |
| P1 | Precision actions are split across distant UI | Selection occurs on canvas; exact editing is mostly in the right panel; only wall length has a spatial rail | Repetitive pointer travel and context switching |
| P1 | Furniture catalog becomes dense quickly | Thirteen items are always visible in a two-column grid without search, categories, favorites, or recents | Scanning cost grows with the catalog |
| P2 | Selection and manipulation affordances are limited | Furniture drags, but rotation and sizing are form-only; openings use form offsets; vertex editing is not exposed | Common adjustments require numeric trial and error |
| P2 | Fixed side rails reduce drafting space | The shell reserves 220 px and 304 px and requires a minimum 1180 px viewport | Laptop users lose useful canvas area |
| P2 | Error feedback is transient and detached | Invalid geometry/collision feedback primarily appears in a toast or status bar | Users may not connect the error to the attempted edit |
| P3 | 3D inspection has few navigation aids | Reset camera is available, but there are no camera presets, frame-selection action, or cutaway controls | Users spend more effort finding a useful view |

## Target user journey

1. **Start:** Choose measured rectangle, freeform room, sample, or recent local project.
2. **Define:** Enter or draw room geometry and see closure/progress feedback.
3. **Openings:** Place doors and windows, then adjust them directly along their wall.
4. **Furnish:** Search or browse furniture, place it, rotate, nudge, duplicate, and resolve collisions.
5. **Inspect:** Switch to an intentional 3D inspection workspace with camera presets and selection continuity.
6. **Finish:** See protection status, name the project, download/save it, and export a clean or dimensioned plan.

Each step should make the next reasonable action visible without forcing a wizard or hiding expert controls.

## Roadmap summary

| Release | Theme | Relative effort | Outcome |
| --- | --- | --- | --- |
| 1 | Trust and startup clarity | Medium | No blank failures; clear build, save, autosave, and recovery states |
| 2 | Guided first ten minutes | Large | A new user can build, furnish, inspect, and export without external documentation |
| 3 | Precision editing | Large | Direct manipulation and exact input work together instead of competing |
| 4 | Workspace efficiency | Medium | More canvas space, faster tool access, and scalable furniture browsing |
| 5 | Project confidence | Large | Local project management and recovery are understandable and deliberate |
| 6 | 3D inspection polish | Medium | 3D becomes a focused inspection mode rather than a canvas swap |

## Release 1 — Trust and startup clarity

### Scope

- Add a top-level error boundary with a branded recovery page, error summary, reload action, and safe “start without recovery” path where possible.
- Render a lightweight application shell before IndexedDB recovery checks and deferred modules finish.
- Lazy-load Three.js/React Three Fiber and PDF/PNG export code so 2D startup does not pay for 3D and export dependencies.
- Show project protection state in the toolbar: `Unsaved changes`, `Recovery saved`, `Downloaded`, and the relevant timestamp.
- Rename the download action to **Download project** unless the browser has a persistent file handle.
- Add a small About/build panel containing version, commit/build identifier, browser capability checks, and project schema.
- Convert unavailable major actions from unexplained disabled states into accessible prerequisite guidance such as “Close the room to add a door.”
- Add persistent inline failure context for geometry and collision errors while keeping toasts for confirmation.

### Technical touchpoints

- `src/App.tsx`: error boundary, loading shell, capability/recovery state.
- `src/components/TopToolbar.tsx`: protection state and clearer file actions.
- `src/store/projectStore.ts`: explicit last-downloaded and last-recovery metadata.
- Dynamic imports around `Scene3D`, PDF, and PNG exporters.
- UI preferences outside `FloorplanProjectV1`.

### Acceptance

- A startup exception never produces a blank page.
- The 2D shell is interactive before 3D/export chunks are loaded.
- Users can distinguish recovery protection from a downloaded project file.
- Every unavailable primary action has an accessible explanation and next step.
- Existing v1 project files remain byte-shape compatible after save/open round trips.

## Release 2 — Guided first ten minutes

### Scope

- Replace the one-time empty prompt with a compact, dismissible progress rail:
  - Define room
  - Add openings
  - Place furniture
  - Inspect in 3D
  - Download or export
- Add a **Measured rectangle** flow that accepts width and depth before creating the room.
- Retain freeform drawing and sample-room entry points.
- Show contextual next-action cards after room closure and first opening/furniture placement.
- Add a keyboard-and-mouse help sheet opened from a labeled Help action and `?`.
- Add short, real instructions to active tools near the canvas; avoid modal tutorials.
- Make status messages actionable: clicking “Room requires a closed polygon” should select the open endpoint or return to wall drawing.
- Preserve progress and dismissed help as local UI preferences, not project data.

### Acceptance

- A first-time user can create a 12 ft × 10 ft room, add a door and desk, open 3D, and export without reading README.
- Rectangle creation can be completed entirely by keyboard.
- Guidance never blocks expert use and can be dismissed or reopened.
- No onboarding state is written into exported project JSON.

## Release 3 — Precision editing

### Scope

- Add visible, zoom-stable handles for:
  - room vertices
  - opening position along a wall
  - furniture rotation
  - furniture resize
- Extend the spatial dimension rail to openings and furniture dimensions.
- Add arrow-key nudging with documented fine/coarse modifiers and collision-aware clamping.
- Add duplicate, copy, paste, and rotate-90° actions for furniture.
- Add optional X/Y position fields for furniture while preserving drag-first interaction.
- Add a snap preferences popover for grid, endpoint, midpoint, edge, alignment, and angle constraints.
- Show the active snap type and constrained axis at the pointer.
- Keep exact values synchronized between canvas controls and the properties panel.
- Attach validation feedback to the affected field/handle and show the nearest valid result when clamping occurs.

### Acceptance

- Openings can be repositioned without manually calculating wall offsets.
- Furniture can be placed, rotated, resized, duplicated, and nudged without leaving the canvas.
- Invalid edits preserve the last valid geometry and explain the violated constraint at the point of action.
- Undo/redo treats one drag, nudge sequence, or form commit as one understandable command.

## Release 4 — Workspace efficiency

### Scope

- Make the tool and properties rails collapsible and optionally resizable.
- Persist rail state and width locally.
- Use mode-aware left-rail content:
  - 2D: drawing, openings, furniture
  - 3D: scene navigation, camera presets, display controls
- Add furniture search, categories, recently used items, and favorites without increasing default visual density.
- Add tool shortcuts and show them in labels/tooltips.
- Add a selection breadcrumb in the properties header and a reliable clear-selection action.
- Group top actions into labeled File, Edit, View, and Help menus at narrower desktop widths while retaining one-click frequent actions.
- Improve focus order and keyboard reach across toolbar, canvas, and properties.

### Acceptance

- The canvas gains meaningful width on 1180–1440 px laptop displays.
- All primary tools remain reachable by keyboard.
- A user can find any catalog item quickly as the catalog grows beyond the current thirteen items.
- 3D mode does not present inactive 2D creation controls as if they are usable.

## Release 5 — Project confidence

### Scope

- Add a local project library backed by IndexedDB with project name, updated time, thumbnail, and schema version.
- Keep explicit portable project download as the source-of-truth handoff format.
- Add named local snapshots and a recovery center showing the three rotating snapshots.
- Distinguish **Open downloaded file**, **Open local project**, **Download project**, and **Export plan**.
- Add import diagnostics that identify schema, reference, polygon, opening, or collision failures without replacing the current project.
- Add optional progressive enhancement for the File System Access API only in supported secure contexts; plain-HTTP LAN behavior must retain the download fallback.
- Add clear deletion confirmations for local projects/snapshots without adding friction to normal canvas deletes.

### Acceptance

- Users can see what is protected locally and what has been downloaded.
- Recovery can be inspected and invoked after startup, not only through a one-time prompt.
- Failed imports leave the current project and its history untouched.
- Plain-HTTP LAN deployment retains the complete baseline project workflow.

## Release 6 — 3D inspection polish

### Scope

- Replace the 2D tool rail with scene controls when 3D is active.
- Add camera presets: Isometric, Top, Eye level, and Frame selection.
- Keep selection synchronized between 2D and 3D and expose a direct **Edit in 2D** action for walls, openings, and furniture.
- Add wall cutaway/transparency controls for occluded objects.
- Add optional object labels and dimensions on selection, not permanently.
- Improve opening geometry and selected-object outline while retaining the restrained low-poly style.
- Preserve camera state per project session and make Reset return to a predictable room-framed view.
- Keep geometry creation and mutation in 2D.

### Acceptance

- Users can reach a useful inspection view with one action.
- Any selected 3D object can be located and edited in 2D.
- Cutaway controls reveal interior content without modifying project geometry.
- 3D controls meet the existing keyboard, focus, contrast, and reduced-motion standards.

## Research and measurement plan

Before Release 2, run five moderated task sessions with people who understand room measurements but are not CAD experts.

Use the same tasks for the baseline and each major release:

1. Create a 12 ft × 10 ft room.
2. Add a 36 in door and 48 in window.
3. Place and rotate a desk and chair without collision.
4. Change one wall to 11 ft while holding the correct endpoint.
5. Inspect the room in 3D.
6. Download the project and export a dimensioned PDF.

Track:

- task completion
- time to first valid room
- time to completed export
- wrong-tool selections
- unexplained disabled-action attempts
- undo/redo usage
- invalid edits and recovery success
- whether users correctly explain autosave versus downloaded file

Initial success targets:

- 90% complete a valid rectangle in under 90 seconds.
- 80% complete the full workflow in under 7 minutes without README.
- 100% correctly identify whether the project has been downloaded.
- Zero unrecoverable blank-page startup failures.
- Zero critical or serious automated accessibility violations.
- No regression in current geometry, export, recovery, and project round-trip tests.

Because Floorplan is backend-free, moderated observation and local test notes should be the default. Do not add remote analytics solely for this roadmap.

## Engineering quality gates

Every release should include:

- focused domain/unit tests for new state and geometry behavior
- Playwright journeys for the changed user workflow
- Chromium, Firefox, and WebKit coverage for critical flows
- first-run and populated-state accessibility scans
- keyboard-only checks for newly added controls
- visual review at 1180×768, 1440×900, and 1920×1080
- plain-HTTP LAN smoke coverage for startup and project creation
- v1 import/export compatibility coverage
- production bundle-size comparison and deferred-chunk verification
- updated README screenshots, `PROJECT_STATE.md`, `Brain.md`, and `handoff.md`

## Explicitly deferred

These would materially change the product and should not be folded into UX releases without a new discovery decision:

- multiple rooms or floors
- mobile editing
- accounts, collaboration, cloud sync, or a required backend
- CAD/BIM interchange such as DXF or IFC
- photorealistic rendering
- 3D model import or export
- electrical, plumbing, or construction-document workflows

## Recommended first implementation slice

Start with Release 1 and the first half of Release 2:

1. Error boundary and lightweight loading shell.
2. Lazy-load 3D and export dependencies.
3. Explicit protection/download status.
4. Accessible prerequisite guidance for unavailable actions.
5. Measured-rectangle entry.
6. Dismissible workflow progress rail and Help sheet.

This slice addresses the recent startup failure class, clarifies the project lifecycle, and improves first-run success without changing geometry or project formats. It also creates the shell and state needed for later precision and project-library work.
