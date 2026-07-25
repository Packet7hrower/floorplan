# Floorplan — Technical Handoff

Last updated: 2026-07-25 CDT (America/Chicago)

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
- Playwright config covers Chromium, Firefox, and WebKit; all seven acceptance flows pass in every engine, for 21 passing browser tests.
- Dockerfile uses Node 22 for the build and nginxinc/nginx-unprivileged on port 8080 for runtime.
- nginx.conf supplies SPA fallback, immutable static caching, security headers, and /healthz.
- compose.yaml pulls ghcr.io/packet7hrower/floorplan:latest with port 8080:8080, unless-stopped restart behavior, and a health check.
- .github/workflows/ci-publish.yml runs lint, unit/integration tests, production build, and the complete three-engine Playwright suite before publishing public linux/amd64 and linux/arm64 images for main and version tags.
- After publication, the runtime-smoke job validates the root Compose file, starts the public image anonymously, and proves `/healthz`, SPA fallback, non-root execution, and clean teardown.
- README.md contains real rendered screenshots, local controls, compatibility, Docker, Portainer, publishing, and license instructions.

## Validation evidence

- npm run check: passing.
- Vitest: 39 passing tests, including a 50-wall, 50-opening, 100-furniture acceptance-scale project rendered in approximately 158 ms on this workstation.
- Playwright: 21 of 21 flows passing across Chromium, Firefox, and WebKit, including corrupted-newest recovery fallback and real SVG/PDF/PNG downloads.
- Accessibility: axe-core WCAG A/AA audits of first-run and populated editor states report no critical or serious violations in all three browser engines. The audit identified and drove fixes for invalid furniture-catalog ARIA grouping and opacity-reduced disabled-control contrast.
- npm audit: zero known vulnerabilities after upgrading jsPDF to 4.2.1 or newer.
- Visual QA completed against docs/screenshots/editor.png and docs/screenshots/3d-view.png.
- Final GitHub Actions release run 29306329914 passed `test`, `publish`, and `runtime-smoke` on source commit `e55129f84244c53a532822e22dc7ddbe98cf4570`.
- Public anonymous OCI index: `ghcr.io/packet7hrower/floorplan:latest`, digest `sha256:e3286f7e7c2fa61fc897698fef80ca56f88cb1bdfd2c56bdc12dbfcc1b39d51d`, with verified linux/amd64 and linux/arm64 manifests.

## Release endpoints

- Repository: `https://github.com/Packet7hrower/floorplan`
- Final workflow run: `https://github.com/Packet7hrower/floorplan/actions/runs/29306329914`
- Image: `ghcr.io/packet7hrower/floorplan:latest`
- Portainer contract: Git Repository deployment from the repository URL, branch `main`, root `compose.yaml`, then browse to `http://<docker-host>:8080`.

## Home Lab deployment posture

The application was not left running persistently in the Home Lab. Inventory found remembered VM124 `deepwake-docker-01` stopped, while the current Portainer VM at `192.168.30.183` already serves Managed Services Pricing on host port 8080. Starting the stopped VM or replacing/remapping that live service would be an environment decision outside the implementation plan's target-neutral Portainer contract. The published root Compose stack is nevertheless runtime-proven from an anonymous pull in GitHub Actions; a future Home Lab rollout only needs an approved Docker host and available host port.

## 2026-07-13 23:42 CDT completion record

The complete DeploymentPlan.txt scope is implemented and release-verified. There are no remaining required engineering actions. GitHub's Node 20 deprecation annotations apply to third-party action runtimes that GitHub currently forces onto Node 24; they are nonblocking and did not affect any test, image, or runtime result.

## 2026-07-25 UX review and roadmap

The implemented product, screenshots, interaction components, Zustand state, existing acceptance tests, original discovery decisions, and product constraints were reviewed without changing application code or runtime state. The Swiss drafting direction remains appropriate and should be preserved rather than restyled.

The main UX risks are startup failures without an application recovery surface, ambiguous autosave-versus-download state, onboarding that ends after room creation, icon-only top actions, unexplained unavailable tools, fixed rail density, form-heavy precision editing, and a 3D mode that retains prominent 2D controls. These are product-clarity and interaction issues rather than deficiencies in the geometry model.

`UX_DEVELOPMENT_PLAN.md` is now the proposed post-MVP roadmap. It sequences six releases: trust/startup clarity, guided first use, precision editing, workspace efficiency, project confidence, and 3D inspection polish. It preserves one-room scope, 2D-authoritative editing, backend-free operation, plain-HTTP LAN support, v1 compatibility, and the current Swiss design tokens.

The recommended first implementation slice is an error boundary and lightweight loading shell, deferred 3D/export loading, explicit protection/download state, accessible prerequisite guidance, measured-rectangle entry, and a dismissible workflow progress rail. No tests or deployment checks were run for this documentation-only review.

## 2026-07-25 16:48 CDT — UX roadmap implementation

All six releases in `UX_DEVELOPMENT_PLAN.md` are implemented locally. The work preserves the one-room scope, 2D-authoritative geometry model, `schemaVersion: 1`, existing IDs and storage formats, backend-free operation, portable project files, plain-HTTP LAN support, and the established Swiss drafting design. Dockerfile, `compose.yaml`, `nginx.conf`, networking, ports, dependencies, and published runtime state were not changed.

### Startup, lifecycle, and onboarding

`src/main.tsx` now mounts `AppErrorBoundary` around a Suspense loading shell. `src/components/AppErrorBoundary.tsx` supplies a recoverable startup surface with reload, recovery bypass, and technical details. `src/App.tsx` defers `Scene3D`, `ExportDialog`, and project-library dialogs; this reduces the main minified entry chunk from the approximately 1.70 MB baseline to 366.93 KB while isolating the 889.85 KB 3D and 475.14 KB export chunks.

`src/components/Guidance.tsx` implements a keyboard-completable measured rectangle flow, contextual active-tool instructions, the dismissible room-workflow rail, Help, shortcuts, and About/build diagnostics. `src/components/TopToolbar.tsx` distinguishes local recovery, portable download, local projects, exports, and optional secure-context direct file save. Prerequisite actions remain focusable and explain how to become available instead of disappearing behind inaccessible disabled controls.

### Precision and workspace state

`src/components/PlanCanvas.tsx` exposes zoom-stable vertex, opening, furniture rotation, and furniture resize handles with contextual dimension rails. `src/store/projectStore.ts` adds validated vertex/opening movement, coalesced nudge history, copy/paste/duplicate, 90-degree rotation, and collision-free paste placement. Furniture position fields and precision actions are mirrored in `src/components/PropertiesPanel.tsx`; `src/domain/snap.ts` supports independently persisted snap categories.

`src/store/uiStore.ts` keeps rail widths/collapse state, workflow dismissal, furniture search/category/favorites/recents, snap settings, 3D display choices, and per-project-session camera state in a separate local preference record. These preferences never enter project JSON. The rails are pointer- and keyboard-resizable, compact widths use File/Edit/View/Help menus, the selection breadcrumb can clear context reliably, and the 3D left rail becomes scene controls rather than inactive drawing tools.

### Local confidence and 3D inspection

IndexedDB schema version 2 retains the rotating snapshot store and adds a local project store. `src/components/ProjectLibrary.tsx` provides thumbnail project browsing, save/open/delete, a recovery center, and named recovery snapshots. `src/persistence/recovery.ts` implements the storage operations; existing snapshots migrate in place. Import validation and diagnostics now complete before discard confirmation or replacement of the active project.

`src/components/Scene3D.tsx` provides Isometric, Top, Eye level, Frame selection, room-framed reset, synchronized wall/opening/furniture selection, wall transparency, optional selected-object labels/dimensions, and direct Edit in 2D. Project geometry is not mutated from 3D. `src/domain/serialization.ts` uses SubtleCrypto when available and a browser-side SHA-256 implementation when insecure contexts restrict it, matching the existing Web Crypto UUID fallback.

### Validation

- `npm run check`: ESLint passed with zero warnings, all 52 Vitest tests passed, and TypeScript/Vite production build passed.
- `npm run test:e2e`: all 33 journeys passed across Chromium, Firefox, and WebKit in 2.4 minutes.
- The browser suite covers first-run/populated accessibility, measured and freeform room creation, precision commands, rails/catalog behavior, project protection, local projects, recovery corruption fallback, import diagnostics, 3D inspection, portable round trips, all export formats, and deliberate removal of both native `crypto.randomUUID` and `crypto.subtle`.
- Automated accessibility scans report no critical or serious WCAG A/AA violations in the three engines.
- Visual QA covered 1180×768, 1440×900, and 1920×1080; `docs/screenshots/editor.png` and `docs/screenshots/3d-view.png` were refreshed from the production build and inspected.
- `docs/UX_RESEARCH_PROTOCOL.md` defines the five-participant moderated validation, measurement sheet, and success thresholds. Those real sessions require participants and remain external evidence; no human results are claimed.

### Source map

- Application orchestration: `src/App.tsx`, `src/main.tsx`
- Startup and guidance: `src/components/AppErrorBoundary.tsx`, `src/components/Guidance.tsx`, `src/utils/buildInfo.ts`
- UI preferences: `src/store/uiStore.ts`
- Precision state/canvas: `src/store/projectStore.ts`, `src/components/PlanCanvas.tsx`, `src/components/PropertiesPanel.tsx`
- Workspace/navigation: `src/components/TopToolbar.tsx`, `src/components/ToolPalette.tsx`, `src/styles.css`
- Local project confidence: `src/components/ProjectLibrary.tsx`, `src/persistence/recovery.ts`, `src/export/projectFile.ts`
- 3D inspection: `src/components/Scene3D.tsx`
- Focused tests: `tests/projectStore.test.ts`, `tests/errorBoundary.test.ts`, `tests/recovery.test.ts`, `tests/serialization.test.ts`, `tests/snap.test.ts`, `tests/e2e/smoke.spec.ts`

## 2026-07-25 16:56 CDT — GitHub source publication

The complete verified UX implementation is published on the dedicated `codex/ux-roadmap` branch at `https://github.com/Packet7hrower/floorplan`. The push uses an explicit `HEAD:refs/heads/codex/ux-roadmap` refspec so remote `main` remains unchanged at the pre-UX plain-HTTP UUID release. This is source publication only: no pull request, merge, GHCR replacement, persistent deployment, Docker change, or networking change is part of this action.

## 2026-07-25 17:47 CDT — Recovery fallback and safe wall reorientation

`src/persistence/recovery.ts` now creates the recovery snapshot before opening IndexedDB and writes the normal version-2 IndexedDB record when possible. If IndexedDB is unavailable, blocked, or fails during the write/prune transaction, the same validated snapshot is retained in a bounded three-record `localStorage` fallback (`floorplan-recovery-fallback-snapshots`). Startup recovery merges IndexedDB and fallback records when both are readable, and uses the fallback alone if IndexedDB is unavailable. The fallback is intentionally browser-local, preserves the same schema/checksum/project JSON contract, and does not alter downloaded `.floorplan.json` files. If both IndexedDB and localStorage are blocked or out of quota, the existing visible warning still correctly directs the user to download the portable file.

`src/domain/geometry.ts` adds `reorientWallVertices`, which preserves the selected segment length and fixes its Start, Center, or End anchor while setting an absolute bearing. `src/store/projectStore.ts` exposes `setWallOrientation`, applies it only to the existing two vertex objects, and then runs the existing closed-room, opening-placement, and furniture-collision checks before committing history. Consequently the wall ID, connected-wall topology, and hosted-opening IDs/offsets are retained; invalid orientations are rejected instead of removing or rebuilding the room.

`src/components/PlanCanvas.tsx` renders a visible selected-wall rotation handle outside the room and previews the orientation before commit. Dragging supports 45-degree increments while Shift is held. `src/components/PropertiesPanel.tsx` adds an exact degrees field for repeatable work. The existing endpoint handles remain available for moving individual connected vertices. Focused regression coverage now verifies the anchor geometry, retention of a hosted door and a valid four-wall room, and recovery fallback when IndexedDB is undefined. `npm run check` passed with 55 Vitest tests, ESLint at zero warnings, TypeScript, and a regenerated Vite production build. No dependency, schema, Docker, network, or deployed-service change was made.
