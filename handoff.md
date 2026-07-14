# Floorplan — Technical Handoff

Last updated: 2026-07-13 22:55 CDT (America/Chicago)

## Product state

Floorplan is implemented as a backend-free React/TypeScript SPA for one closed room. The 2D editor is the authoritative geometry surface, the 3D view is derived from the same project, and explicit saves are portable schema-versioned JSON. The implementation target and acceptance requirements are preserved in DeploymentPlan.txt and plan.md.

## Architecture

- React 19, TypeScript, Vite, Zustand, and Zod provide the application shell, state, and schema validation.
- Native SVG owns 2D rendering and export geometry.
- Three.js, React Three Fiber, and Drei render the open-top 3D room.
- jsPDF and svg2pdf.js produce client-side vector Letter landscape PDFs.
- All measurements use integer thousandths of an inch, exposed as LengthMils.
- Framework-independent code lives under src/domain; state orchestration is isolated in src/store/projectStore.ts.
- No backend, remote model assets, runtime environment variables, mounted configuration, or external persistence service is used.

## Domain and validation

The canonical FloorplanProjectV1 model contains stable vertices, connected walls, parametric wall-hosted openings, and furniture instances. Import dispatch is keyed by schemaVersion and currently supports version 1 only. Zod validates the structure before deeper validation checks unique IDs, references, wall collapse, polygon closure and self-intersection, opening clearances and overlap, and solid furniture collisions.

Measurement parsing accepts decimal inches, decimal feet, feet-and-inches, mixed fractions, straight or typographic quote marks, and optional whitespace. Values are rounded to the nearest mil. Feet mode displays feet and inches to the nearest 1/16 inch; inch mode displays up to three trimmed decimals.

Geometry modules implement ordered-room discovery, polygon winding and intersection, wall-anchor resizing, oriented furniture footprints with SAT, wall rectangles, hosted-opening placement, and polygonal door-swing sectors. Door arcs are advisory only. Furniture collisions with walls and other furniture are hard constraints.

## State and interaction

Zustand owns the active project, selection, tool, view, viewport, shared wall anchor, dirty state, notices, errors, and a bounded 100-command undo/redo history. New and Open clear history after unsaved-work confirmation. Escape cancels an open wall chain. Delete validates the requested removal.

The Swiss drafting interface uses bundled Inter Variable, white and neutral surfaces, Yves Klein Blue, hairline rules, and restrained overlays. The signature dimension rail follows the selected wall and edits its exact length using the same Start, Center, or End anchor shown in the properties panel and on the canvas.

The 2D canvas supports cursor-centered 10–800 percent wheel zoom, Space plus left-drag pan, middle-mouse pan, zoom-to-fit, rectangle drawing, irregular wall drawing, live dimensions, master snapping, Alt suspension, Shift 45-degree constraints, opening placement, furniture placement, clamped drag commits, and collision feedback. Door-swing obstructions remain nonblocking and are reported in the status bar.

## Persistence and export

Explicit saves download sanitized project-name.floorplan.json files. IndexedDB keeps three rotating recovery snapshots. Each snapshot includes a timestamp, schema version, serialized project, and SHA-256 checksum. The new write commits before old snapshots are pruned; startup validates newest-to-oldest and offers the newest valid recovery.

SVG export uses native vector geometry and a geometry-derived viewBox. PDF export registers the bundled public/fonts/InterVariable.ttf before svg2pdf conversion. PNG export produces a 3300 by 2550 white-background image. The common export scene excludes grid, UI, selection, snapping, collisions, and warnings; its dimensions toggle includes walls and opening widths only.

## 3D presentation

The 3D scene renders a floor, wall segments split around door and window openings, fixed 36-inch window sills, door/window panels, and bundled parametric low-poly furniture. It uses hemispheric and ambient fill, a soft directional key, ACES tone mapping, sRGB output, contact shadows, restrained materials, and an open-top elevated default camera. Orbit, pan, zoom, reset, and object selection are available; geometry edits remain in 2D.

## Build and deployment

- npm run check executes lint, 39 unit/integration tests, TypeScript compilation, and the production Vite build.
- Playwright config covers Chromium, Firefox, and WebKit; six Chromium acceptance flows currently pass.
- Dockerfile uses Node 22 for the build and nginxinc/nginx-unprivileged on port 8080 for runtime.
- nginx.conf supplies SPA fallback, immutable static caching, security headers, and /healthz.
- compose.yaml pulls ghcr.io/packet7hrower/floorplan:latest with port 8080:8080, unless-stopped restart behavior, and a health check.
- .github/workflows/ci-publish.yml tests before publishing public linux/amd64 and linux/arm64 images for main and version tags.
- README.md contains real rendered screenshots, local controls, compatibility, Docker, Portainer, publishing, and license instructions.

## Validation evidence

- npm run check: passing.
- Vitest: 39 passing tests, including a 50-wall, 50-opening, 100-furniture acceptance-scale project rendered in approximately 158 ms on this workstation.
- Playwright Chromium: 6 of 6 flows passing, including corrupted-newest recovery fallback and real SVG/PDF/PNG downloads.
- npm audit: zero known vulnerabilities after upgrading jsPDF to 4.2.1 or newer.
- Visual QA completed against docs/screenshots/editor.png and docs/screenshots/3d-view.png.
- Docker runtime validation remains unavailable locally because this workstation does not have a Docker CLI; GitHub Actions is the deployment build authority.

## Operational next actions

1. Initialize and publish the public Packet7hrower/floorplan GitHub repository.
2. Observe the initial GitHub Actions run through multi-architecture image publication.
3. Confirm the package is public, anonymous GHCR pull metadata is visible, and the documented URL is correct.
4. If a Docker-capable host is available, run Compose, probe /healthz and SPA fallback, then perform the documented Portainer Git Repository deployment.

