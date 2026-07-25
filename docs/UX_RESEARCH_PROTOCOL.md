# Floorplan Moderated UX Validation Protocol

Updated: 2026-07-25 (America/Chicago)

## Purpose

Validate whether the implemented Floorplan workflow lets people who understand ordinary room measurements, but do not use CAD professionally, complete one-room planning tasks quickly and confidently. This is a moderated local study; do not add analytics, accounts, or telemetry to the product.

## Participants

Recruit five participants who can read feet-and-inches measurements and use a desktop browser, but who are not regular CAD/BIM users. Avoid coaching them on Floorplan before the session. Record only a participant code and broad experience level; do not collect unnecessary personal information.

## Environment

- Use a current supported desktop release of Chrome, Edge, Firefox, or Safari at 1180 px width or wider.
- Run at least two sessions from a plain-HTTP LAN URL and at least one in Firefox or Safari.
- Start with a clean browser profile or clear Floorplan local storage and IndexedDB before each session.
- Keep the README and this protocol unavailable to the participant during the task.
- Have a 12 ft × 10 ft reference room and the required measurements visible outside the application.
- Screen recording is optional and requires the participant's consent.

## Moderator script

Say:

> This is a room-planning application, not a test of you. Please work as you normally would and think aloud when something is unclear. I will not explain how the controls work unless you become fully blocked. You can stop at any time.

Then give the participant these tasks one at a time:

1. Create a room measuring 12 ft by 10 ft.
2. Add a 36 in door and a 48 in window.
3. Place a desk and chair, rotate the desk, and leave both without a collision.
4. Change one wall to 11 ft while keeping the endpoint identified by the moderator fixed.
5. Inspect the room in 3D and bring the desk into a useful view.
6. Return to 2D, download the project, and export a dimensioned PDF.
7. Explain which work is protected only in this browser and which artifact can be moved to another computer.

If the participant is blocked for 30 seconds, ask, “What would you expect to happen here?” Record the answer before offering the smallest neutral hint. Do not name the required control in the hint.

## Observation sheet

| Metric | Result |
| --- | --- |
| Participant code | |
| Browser and viewport | |
| Plain HTTP LAN session | Yes / No |
| Valid rectangle completed | Yes / No |
| Time to valid rectangle | |
| Full workflow completed | Yes / No |
| Time to completed PDF export | |
| Wrong-tool selections | |
| Unexplained unavailable-action attempts | |
| Undo/redo uses | |
| Invalid edits | |
| Invalid edits successfully recovered | |
| Moderator hints and timestamps | |
| Correctly identifies local protection | Yes / No |
| Correctly identifies downloaded project | Yes / No |
| Blank page or unrecoverable state | Yes / No |
| Participant's three clearest comments | |

## Success criteria

- At least 90% complete a valid rectangle within 90 seconds.
- At least 80% complete the room, openings, furniture, 3D, project download, and PDF export within seven minutes without the README.
- 100% correctly distinguish browser-local protection from a downloaded portable project.
- No blank-page startup failures.
- No newly observed critical or serious accessibility barrier.
- Geometry, recovery, export, project round-trip, cross-browser, and plain-HTTP fallback automation remains green.

With five participants, percentage targets are directional: the rectangle target effectively requires all five, and the full-workflow target requires at least four. Report both raw counts and percentages.

## Post-session debrief

Ask:

1. What did you expect to do first?
2. Which control or message was hardest to understand?
3. At what point did you feel your work was protected?
4. What did “Download project” mean to you?
5. Was the 3D view useful for checking the room? Why or why not?
6. What single change would make the application easier to use?

## Reporting

Create one dated result file beside this protocol after all five sessions. Include the raw aggregate counts, medians for both completion times, observed failure themes, browser/plain-HTTP coverage, and prioritized follow-up changes. Separate observed evidence from recommendations, and do not claim the roadmap targets were met until the participant results prove it.
