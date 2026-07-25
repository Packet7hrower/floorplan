# Project State

Updated: 2026-07-25 18:06 CDT (America/Chicago)

## Current objective

The approved `UX_DEVELOPMENT_PLAN.md` software roadmap is implemented across startup trust, onboarding, precision editing, workspace efficiency, local project confidence, and 3D inspection. Preserve schema version 1, plain-HTTP LAN support, portable files, backend-free operation, and the Swiss drafting direction through any follow-up work.

## Current implementation state

- Releases 1–6 of the approved roadmap are implemented without changing project `schemaVersion: 1`, geometry identifiers, portable project structure, Docker/Nginx/network configuration, or dependencies.
- Startup now has a lightweight loading shell, application error boundary, recovery bypass, deferred 3D/export modules, and inspectable build/capability diagnostics.
- First use now includes measured rectangle entry, contextual next actions, a dismissible workflow rail, active-tool guidance, Help, and an explicit local-protection/download state.
- Precision editing now includes zoom-stable handles, spatial dimensions, opening/furniture nudging, copy/paste/duplicate/rotate, furniture X/Y fields, snap preferences, and collision-aware inline feedback.
- Workspace state is locally persisted outside project JSON; rails are collapsible/resizable, furniture is searchable and categorized with favorites/recents, selection context is explicit, and 3D replaces drawing tools with scene controls.
- IndexedDB now provides a thumbnail project library and named recovery snapshots; automatic recovery falls back to browser localStorage when IndexedDB is blocked or fails to write. Imports are diagnosed before the active project is replaced, and secure-context direct file save progressively enhances the universal download path.
- A selected wall can now be reoriented without rebuilding the room: a canvas rotation handle and exact angle field rotate its existing connected vertices around the selected Start, Center, or End anchor. Openings remain hosted on that wall, and room/collision validation rejects invalid geometry rather than deleting content.
- 3D now provides camera presets, frame selection, synchronized object selection, per-project-session camera state, wall transparency, optional selection labels/dimensions, and direct return to authoritative 2D editing.
- The main startup bundle fell from approximately 1.70 MB to 366.93 KB minified; 3D and export are isolated in deferred 889.85 KB and 475.14 KB chunks.
- The Swiss drafting system remains the visual direction and the spatial dimension rail is now the signature precision-editing surface.

## Preserved product baseline

- The backend-free React/TypeScript SPA, pure domain model, SVG editor, open-top 3D scene, recovery, portable saves, exports, Docker packaging, GitHub Actions, README, licensing, and rendered screenshots are complete.
- The Swiss drafting interface includes the shared Start/Center/End wall anchor, dimension rail, precise measurement entry, snapping, collision handling, and all specified keyboard/mouse behavior.
- GitHub repository: `https://github.com/Packet7hrower/floorplan` (public, default branch `main`).
- Container image: `ghcr.io/packet7hrower/floorplan:latest` (public anonymous registry access verified).
- Production application merge commit: `f5d5e7c588498d6c06b633619f275f93acb438d5`.
- Final successful release run: `https://github.com/Packet7hrower/floorplan/actions/runs/30178469470`.

## Active files and services

- `DeploymentPlan.txt` / `plan.md` — authoritative and preserved original specification.
- `UX_DEVELOPMENT_PLAN.md` — implemented post-MVP roadmap and product guardrails.
- `docs/UX_RESEARCH_PROTOCOL.md` — ready-to-run five-participant moderated validation protocol.
- `src/` — production application and framework-independent domain implementation.
- `tests/` — unit, integration, performance, accessibility, and Playwright acceptance coverage.
- `Dockerfile`, `nginx.conf`, `compose.yaml` — production deployment artifacts.
- `.github/workflows/ci-publish.yml` — cross-browser test, multi-architecture publish, and published-image runtime gate.
- `README.md`, `docs/screenshots/`, `LICENSE`, `THIRD_PARTY_NOTICES.md` — public delivery documentation.
- No local preview or production service is intentionally left running by this engagement.

## Current local implementation evidence

- `npm run check`: pass; ESLint with zero warnings, 55 of 55 Vitest tests, TypeScript, and the production Vite build.
- `npm run test:e2e`: 33 of 33 pass across Chromium, Firefox, and WebKit.
- Accessibility: first-run and populated states retain zero critical or serious automated WCAG A/AA violations in all three engines.
- Plain-HTTP compatibility: all three engines pass startup, sample creation, and IndexedDB recovery while native `crypto.randomUUID` and `crypto.subtle` are deliberately unavailable.
- Project workflows: portable round trip, newest-valid recovery fallback, local project library, import diagnostics, SVG/PDF/300-DPI PNG export, and 3D inspection all pass browser automation.
- Acceptance scale: the 50-wall, 50-opening, 100-object performance test completed in approximately 157 ms in the final quality run, inside its two-second target.
- Visual QA: 1180×768, 1440×900, and 1920×1080 layouts were reviewed; refreshed 1440×900 2D and 3D screenshots are stored under `docs/screenshots`.
- No application server or preview process is intentionally left running.

## Last published release evidence

- The GitHub default/production branch is `main`; the repository has no literal `master` branch.
- `codex/ux-roadmap` application commit `e7e6fdb5b6cb0461b386a6e4536e38d550a7a0c9` was pushed, then merged into `main` by merge commit `f5d5e7c588498d6c06b633619f275f93acb438d5`.
- Release run `30178469470` passed `test`, `publish`, and `runtime-smoke`, including all 33 Playwright journeys and the anonymous public-image runtime gate.
- Published multi-architecture image: `ghcr.io/packet7hrower/floorplan:latest`.
- Public OCI index digest: `sha256:3f0da0b0b91946e8beaa759c9c4a5801762d3d6e6fac3fad4eb98d468217fe22`.
- This deployment updates GitHub source and GHCR only; no persistent Home Lab stack, port, hostname, or running service was changed.

## Remaining required actions

None for the software implementation. Five real moderated sessions remain necessary to measure the human-success targets; the study is ready in `docs/UX_RESEARCH_PROTOCOL.md`, but no participant results are fabricated or claimed.

## Optional operational action

A persistent Home Lab stack was intentionally not created because the remembered Docker VM `deepwake-docker-01` (VM124) is stopped and the current Portainer VM at `192.168.30.183` already uses host port 8080 for Managed Services Pricing. The Portainer Git Repository instructions and root Compose contract are complete and runtime-proven; a later persistent rollout should select an approved host/port rather than displace an existing service or revive a stopped VM implicitly.

## Known nonblocking item

GitHub annotates several third-party actions because their current major versions target the deprecated Node 20 action runtime; GitHub transparently executes them on Node 24. The annotation does not affect any job result or the produced application image.
