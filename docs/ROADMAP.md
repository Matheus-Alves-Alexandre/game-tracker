# Roadmap

## Initial vertical slice

Desktop window, persistent game records, edit, search, status filtering, ratings, explicit time units, completion date, platinum goal and archive undo. English interface and documentation. AGPL-3.0-only, optional donation link and protected development workflow.

## MVP backlog

1. Keyboard/modal accessibility and persistent archive recovery (implemented in sprint 1).
2. Backup, validation and restore before real-data migration.
3. Spreadsheet preview and import with field mapping, original-value provenance and idempotency.
4. Tags and console/execution-method separation.
5. Saga checklists and custom lists with shared progress (implemented on the game-lists branch); manual reordering and franchise discovery remain planned.
6. Annual completion statistics and explicit missing-data coverage.
7. Planned-game priorities and CSV export.
8. Measure memory/CPU and validate installed Windows updates.

Implemented on the catalog/home branch: optional IGDB edition lookup, selected-cover disk caching, personal home cards and explicit metric coverage. Live authentication still requires the owner's own Twitch developer application. Local cover selection, a full library grid and OS-protected persistent credentials are future increments. Keep core features offline. Later: achievements synchronization, replay sessions, annual goals, portable packaging and additional operating systems.

## Product rules

Before the first stable public installer, complete the [signed in-app updater milestone](UPDATES.md). Follow the incremental [sprint plan](SPRINTS.md).

- Ratings are optional, 1–5. Legacy spreadsheet zero means unrated.
- Completion date means when a game was finished. Do not invent dates for historical records.
- Store durations in seconds; input units must be visible. Review ambiguous legacy values.
- A saga checklist is not proof of ownership or playtime. Keep imported disagreements visible until resolved.
- Lifetime playtime and completion dates cannot establish monthly play activity.
- Library catalog entries must not inflate personal-played statistics.
- Keep original titles and separate editions until a user confirms a match.

## Inspiration

The user supplied [Cogumelando's spreadsheet](https://docs.google.com/spreadsheets/d/1IiJLYBNuEt2q_Vg3h8uon0cvgEqABh9G1Y31n6an4TY/edit) as a structural reference. Sampled headers suggest useful console filters, personal completion criteria, difficulty and main-series/spin-off groupings. We are not copying its game records or treating its ratings as this user's ratings. Keep the user's 1–5 rating scale.
