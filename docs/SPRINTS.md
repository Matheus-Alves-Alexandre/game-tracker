# Development sprints

Use feature branches and commit verified slices. The maintainer will open pull requests; do not automatically create or merge them. A commit is a checkpoint, not a public release. Keep all required checks and main protection.

## Sprint 1: recovery and keyboard access

Persistent archived-games view with search, status filter and bounded pagination. Restore records without changing their fields or counting archived games in active statistics. Contain modal focus, return it to the opener, support Escape and prevent dismissal during a pending save. Verify SQLite close/reopen, renderer behavior and the real native IPC flow.

## Sprint 2: backup before real-data import

Versioned exports, validation and preview before restore. Take a safety snapshot before replacing a library. Cover malformed, unsupported and interrupted operations. Never reset a database to recover from an error.

## Sprint 3: reviewed spreadsheet migration

Preview and field mapping, raw-value provenance, explicit time conversion and repeat-import protection. Legacy zero ratings mean unrated. Review ambiguous times and saga conflicts rather than guessing.

## Distribution milestone: signed installed updates

Complete before the first public installer intended for ongoing use. See [update design](UPDATES.md). Website download redirects alone cannot update installed applications.

## Later increments

Tags/platform normalization, sagas, annual statistics, exports and workload benchmarks. Optional IGDB metadata follows the offline core; credentials are not needed for the current sprints.
