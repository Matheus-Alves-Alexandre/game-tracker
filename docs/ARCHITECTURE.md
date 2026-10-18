# Architecture

## Decision: modular monolith

One installed application, one local SQLite database, one repository. React renders the interface; typed Tauri IPC commands connect it to Rust. Validation and data integrity belong in Rust even when the UI also validates. There is no HTTP backend, cloud account or microservice requirement.

The current vertical slice separates UI, IPC contracts, desktop command handlers and SQLite storage. Split Rust domain and storage modules further as sagas, import and backups arrive. Keep each business rule owned in one place. Do not introduce a service framework or dependency injection container for an embedded local store.

## Current data model

- `games`: stable game identity and title.
- `library_entries`: personal status, platform label, optional rating, duration in seconds, completion date, platinum goal, notes and archive state.
- One personal entry per game is enforced in this first schema. Replays and multi-platform copies need a deliberate later migration, not duplicated title-based keys.
- SQLite foreign keys and constraints complement Rust validation. Updates use transactions. Queries return no more than 100 entries at a time.
- Schema version 1 is the initial schema. Future schema changes require versioned migrations and pre-migration backups.

## Planned modules

Library, tags, sagas, imports, backup/restore and metadata integrations. A saga item can reference a game; completion then derives from personal progress unless an explicit reviewed override exists. Import provenance stores raw source values and normalization decisions. Empty data and real zero must remain distinct.

## Optional online features

IGDB/Twitch cover lookup is opt-in. Fetch candidates in Rust, confirm the correct edition, cache thumbnails on disk and load only visible images. Never embed a shared confidential client secret in a distributed binary. Personal credentials need OS-protected storage; a public hosted proxy would be an optional separate deployment decision, not a requirement to use the local library.

The donation command opens one fixed Buy Me a Coffee URL. The frontend has no unrestricted shell or filesystem permission. External covers must retain their own source attribution and applicable rights.

## Distribution

The app identifier determines its data directory and must remain stable. Native desktop tests use a separate identifier. Windows x64 with an NSIS installer is the first target. Release artifacts must include access to corresponding source and build instructions. No update may silently remove user data.

## Resource budget

One primary webview. Bounded queries and state, thumbnail caching, no continuous polling while idle. Target 150–300 MB in ordinary use; a hard supported-scenario budget below 1,000 MB across the host and associated WebView2 processes. These are goals until benchmark evidence exists. Optimize CPU and disk activity too; do not obtain a smaller RAM number by causing continuous paging during games.
