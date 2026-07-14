# Floorplan MVP Implementation Plan

## Summary

Build **Floorplan**, a desktop-browser room planner for creating one closed, arbitrarily shaped room in a precise 2D editor and viewing it in polished interactive 3D. Users can draw connected or rectangular rooms, enter conventional US measurements, place openings and collision-aware low-poly furniture, save portable projects, recover autosaves, and export dimensioned or clean 2D plans.

Implement this as a backend-free React/TypeScript SPA. Before implementation, save this specification to `plan.md`; then maintain `PROJECT_STATE.md`, `Brain.md`, and `handoff.md` throughout development.

## Frontend and Interaction Design

### Design system

- Use a Swiss drafting aesthetic with bundled **Inter Variable** under its open-font license. Use the same bundled font in the UI and export pipeline so SVG/PDF labels render consistently.
- Define these core tokens:
  - Surfaces: `#FFFFFF` canvas, `#F7F7F8` panels, `#EEF0F3` hover surface.
  - Text: `#111318` primary, `#5F6368` secondary.
  - Accent: `#002FA7`; warning `#B45309`; error `#C62828`.
  - Borders: `#D5D8DE`, 1px; selected borders use the accent.
  - Spacing: 4, 8, 12, 16, 24, 32, and 48px.
  - Type: 12/16, 14/20, 16/24, 20/28, and 28/34px.
  - Control heights: 32px compact and 40px standard.
  - Corner radius: 4px controls and 8px overlays.
- Use no decorative shadows. Dialogs, dropdowns, menus, and tooltips may use `0 8px 24px rgba(17, 24, 39, 0.14)` for canvas separation.
- Define control states:
  - Hover: light accent-tinted surface.
  - Active/selected: blue border and pale-blue background.
  - Focus: 2px blue focus ring with 2px white separation.
  - Disabled: 45% opacity, default cursor, no hover response.
  - Invalid: error border plus inline text; never color alone.
- Use 120ms state transitions and 180ms overlay transitions. Disable nonessential transitions under `prefers-reduced-motion`.
- Keep the signature interaction: a dimension rail beside the active or selected wall that displays live length and becomes the exact-value editor.

### Application shell and first-run experience

- Top toolbar: New, Open Project, Save Project, Export, Undo, Redo, unit selector, snap toggle, all-wall-dimensions toggle, 2D/3D switch, zoom-to-fit, and zoom percentage.
- Left panel: Select, Draw Wall, Draw Rectangle Room, Door, Window, and furniture catalog.
- Right panel: project settings or selected-item properties.
- Center: SVG drafting canvas or Three.js viewport.
- Empty projects show a compact inline prompt: “Draw walls to create a room,” with:
  - **Draw rectangle** to activate the rectangle tool.
  - **Load sample room** to create an explicitly labeled editable sample containing a 12′×10′ room, door, window, desk, and chair.
- Rectangle drawing uses click-drag between opposite corners, displays live width and depth, and creates four connected walls on release. Exact width and depth can then be entered through the room properties.
- Manual wall drawing remains available for irregular rooms. Require at least three connected walls forming one non-self-intersecting closed polygon before enabling openings, furniture, exports, or 3D.

### Canvas navigation and editing

- Wheel zoom centers on the cursor and supports 10%–800% zoom.
- Pan using Space+left-drag or middle-mouse drag.
- Display the current zoom percentage and provide zoom-to-fit.
- Escape cancels the current drawing or drag operation.
- Delete removes the selected item after validation.
- Undo and Redo are explicit toolbar buttons with disabled states and tooltips.
- Support Ctrl/Cmd+Z for undo and Ctrl/Cmd+Shift+Z or Ctrl+Y for redo.
- Maintain a 100-command undo history. New/Open clears history after confirmation.
- Show live dimensions while drawing.
- Provide an editor toggle that displays labels for every wall simultaneously, independent of selection and independent of export settings.

### Units and dimension entry

- Store all measurements as integer thousandths of an inch (`LengthMils`).
- Accept:
  - `150in`
  - `12.5ft`
  - `12'6"`
  - `12ft 6in`
  - `12' 6 1/2"`
  - Simple positive fractions with nonzero denominators up to 64.
- Normalize straight or typographic quote marks and optional whitespace.
- Round parsed values to the nearest mil instead of rejecting measurements that do not convert exactly, including `10.33ft`.
- Reject only malformed, negative, zero-denominator, non-finite, or out-of-range values.
- In inch mode, display decimal inches with up to three trimmed decimal places.
- In foot mode, display feet and inches, rounding inches to the nearest 1/16 inch; do not display decimal feet.
- Switching units changes only formatting and input defaults, never stored geometry.

### Wall editing and snapping

- Selecting a wall exposes its exact length and an anchor selector:
  - **Start:** keep the start vertex fixed and move the end.
  - **Center:** preserve the midpoint and move both endpoints equally.
  - **End:** keep the end vertex fixed and move the start.
- Default to Start, based on the wall’s original drawing direction, and show the anchored vertex on the canvas.
- Shared vertices remain connected; moved vertices update the lengths of neighboring walls.
- Reject changes that create self-intersections, collapse a wall, invalidate hosted openings, or leave fewer than three usable walls.
- The master snap toggle controls:
  - Existing endpoints and room closure.
  - Grid intersections.
  - 45° and 90° wall angles.
  - Parallel and perpendicular alignment.
  - Wall centers.
  - Furniture and opening edges.
- Snap priority: endpoints/closure, wall centers or object edges, angular/alignment constraints, then grid.
- Use a screen-space snap threshold so zoom does not change snap usability.
- Holding Alt temporarily suspends automatic snapping.
- Holding Shift constrains a wall to the nearest 45° increment while drawing, even if master snapping is disabled.
- Alt+Shift applies only the intentional 45° constraint and suppresses all other snap targets.

### Openings, furniture, and collisions

- Host doors and windows parametrically on walls by offset rather than independent world coordinates.
- Prevent openings from overlapping and require two inches of wall at each end.
- Doors expose width, height, left/right hinge, and inward/outward swing.
- Door swing arcs are advisory clearance regions:
  - Allow furniture inside the arc.
  - Highlight the furniture and arc in warning amber.
  - Show a nonblocking “Door swing obstructed” warning.
- Windows expose width and height. Use a fixed internal 36-inch sill elevation for 3D without exposing sill height in the MVP.
- Furniture exposes width, depth/length, height, rotation, and position.
- Dimension changes preserve object center and are rejected if the resulting solid footprint overlaps a wall or another furniture item.
- During dragging, clamp furniture at the nearest valid wall or furniture boundary and highlight the blocking solid.
- Door swing arcs never clamp or reject furniture.
- Include parametric low-poly models for desk, office chair, dining chair, bookshelf, sofa, table, bed, TV, TV stand, computer/monitor, speaker, cabinet, and dresser.

### 3D presentation

- Allow orbit, pan, zoom, reset-camera, and object selection.
- Keep geometry movement and editing in 2D. A 3D selection shows dimensions and an **Edit in 2D** action.
- Render an open-top room with a floor plane, wall openings, door panels, windows, and recognizable low-poly furniture.
- Use:
  - Soft hemispheric/ambient fill lighting.
  - One soft directional key light with restrained shadows.
  - ACES filmic tone mapping and sRGB output.
  - Soft contact shadows beneath furniture.
  - Off-white walls, light-gray flooring, muted wood, charcoal, and blue-accent materials.
- Avoid glossy defaults, saturated random colors, harsh shadows, and exposed Three.js debug styling.

## Architecture and Public Data Interfaces

- Use React, TypeScript, Vite, Zustand, Zod, native SVG, Three.js, React Three Fiber, jsPDF, and svg2pdf.js.
- Keep geometry, collision, snapping, parsing, formatting, validation, serialization, and export calculations in framework-independent pure TypeScript modules.
- Use SVG as the authoritative 2D rendering/export representation.
- Prove browser-side vector PDF generation early with a vertical slice using **svg2pdf.js with jsPDF**, bundled Inter glyphs, wall geometry, and measurement labels before building the complete export UI.
- Use one canonical scene model for 2D and 3D:

```ts
type LengthMils = number;
type Unit = "in" | "ft";
type WallAnchor = "start" | "center" | "end";

interface FloorplanProjectV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  displayUnit: Unit;
  settings: {
    wallThickness: LengthMils;
    wallHeight: LengthMils;
    gridSpacing: LengthMils;
    snappingEnabled: boolean;
    showAllWallDimensions: boolean;
  };
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
  furniture: FurnitureInstance[];
  updatedAt: string;
}

interface Vertex {
  id: string;
  x: LengthMils;
  y: LengthMils;
}

interface Wall {
  id: string;
  startVertexId: string;
  endVertexId: string;
}

interface Opening {
  id: string;
  wallId: string;
  kind: "door" | "window";
  offsetFromStart: LengthMils;
  width: LengthMils;
  height: LengthMils;
  hinge?: "left" | "right";
  swing?: "inward" | "outward";
}

interface FurnitureInstance {
  id: string;
  catalogType: FurnitureType;
  x: LengthMils;
  y: LengthMils;
  rotationDegrees: number;
  width: LengthMils;
  depth: LengthMils;
  height: LengthMils;
}
```

- Validate imported JSON completely before replacing the active project.
- Reject unsupported schemas, broken references, invalid polygons, solid collisions, malformed measurements, and overlapping openings with a readable error.
- Add migration dispatch keyed by `schemaVersion`; implement only version 1.
- Default settings:
  - Wall thickness: 4.5 inches.
  - Wall height: 96 inches.
  - Grid spacing: 6 inches.
  - Door: 36×80 inches.
  - Window: 48×48 inches.
- Global wall thickness and height changes revalidate all openings and solid-object collisions.
- Use polygon validation for rooms, oriented bounding boxes/SAT for furniture, wall rectangles split around door openings, and polygonal door-swing sectors for warnings.
- Generate furniture from bundled geometry and materials, avoiding runtime asset downloads and external model-license uncertainty.

### Persistence and recovery

- Save portable projects as `<project-name>.floorplan.json`.
- Maintain three rotating IndexedDB recovery snapshots:
  - Debounce writes by 500ms.
  - Write the next snapshot before pruning the oldest.
  - Attach timestamp, schema version, and checksum metadata.
  - On startup, validate snapshots newest-to-oldest and offer the newest valid recovery.
- A failed or interrupted snapshot write must not replace the last known valid snapshot.
- New/Open warns about unsaved work, while autosave recovery remains separate from explicit JSON download.

## Export, Packaging, and Deployment

- Provide one export dialog for PDF, PNG, and SVG with an Include Dimensions toggle.
- When enabled, show wall-segment lengths and door/window widths; exclude furniture dimensions.
- Exclude selection handles, snap guides, collision highlights, warning arcs, grid, and UI controls.
- Produce:
  - SVG with native vector geometry, bundled-font styling, and a geometry-derived `viewBox`.
  - US Letter landscape vector PDF through svg2pdf.js and jsPDF.
  - 3300×2550 white-background PNG representing Letter landscape at 300 DPI.
- Auto-fit the room with consistent margins and include the project name.
- Sanitize all downloaded filenames consistently.
- Use a multi-stage Dockerfile:
  - Node 22 builds the SPA.
  - Unprivileged Nginx serves it on port 8080.
  - Configure SPA fallback, static cache headers, and `/healthz`.
- Use a root Compose file with:
  - `ghcr.io/packet7hrower/floorplan:latest`
  - Port `8080:8080`
  - `restart: unless-stopped`
  - Container health check
  - No volumes, custom networks, secrets, substitutions, environment variables, or `.env` requirement
- Use GitHub Actions to test and publish public `linux/amd64` and `linux/arm64` images on `main` and version tags.
- Publish the public repository under `Packet7hrower`.
- Portainer deployment uses Git Repository, branch `main`, and the root Compose file; Portainer pulls the prebuilt public GHCR image.
- Document deployment as: enter repository URL, select `main`, select the Compose path, deploy, and open `http://<docker-host>:8080`.
- Include a GitHub-ready README covering features, screenshots, local development, keyboard/mouse controls, project compatibility, Docker, Portainer, and licenses.

## MVP Test and Acceptance Plan

### Unit and integration coverage

Thoroughly test the pure modules:

- Measurement parsing, feet/inches formatting, fraction handling, nearest-mil rounding, and malformed input.
- Polygon closure, winding, self-intersection, rectangle creation, and wall-anchor resizing.
- Snap candidates, priority, master toggle, Alt suspension, and Shift constraints.
- Wall, furniture, opening, and door-warning geometry.
- JSON validation, checksums, lossless round trips, schema dispatch, and rotating recovery snapshots.
- SVG generation and svg2pdf.js/jsPDF vector conversion using representative labels and geometry.

### Playwright smoke flows

1. Use first-run guidance to create a rectangle, navigate by zoom/pan, show all wall dimensions, and undo/redo.
2. Draw an irregular room, exercise snap types and modifiers, then resize walls using Start, Center, and End anchors.
3. Add doors, windows, and furniture; verify hard solid collisions and nonblocking door-swing warnings.
4. Switch to 3D, inspect lighting/materials, select an object, reset the camera, and return to 2D editing.
5. Save JSON, import it, reload, and recover from the newest valid IndexedDB snapshot after corrupting the newest snapshot.
6. Export SVG, PDF, and PNG with dimensions both enabled and disabled and verify nonblank, correctly sized outputs.

### Acceptance criteria

- Supports the latest two desktop releases of Chrome, Edge, Firefox, and Safari at widths of 1180px and above.
- Remains responsive with one 50-wall room, 50 openings, and 100 furniture objects.
- Produces consistent Inter-based measurement labels on screen, in SVG, and in PDF.
- Docker Compose starts without user-supplied variables, `.env` files, custom networks, or mounted configuration.
- `/healthz`, SPA fallback, anonymous GHCR pull, and Portainer deployment work as documented.
- No unresolved critical/high defects involving geometry corruption, project loss, invalid exports, accessibility, or deployment.
- Excludes backend accounts, collaboration, mobile editing, multiple rooms/floors, DXF, 3D export, container scanning, exhaustive per-catalog E2E tests, and multi-resolution visual-regression suites from MVP.


