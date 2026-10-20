# Architecture

## Decision: modular monolith

One installed application, one local SQLite database, one repository. React renders the interface; typed Tauri IPC commands connect it to Rust. Validation and data integrity belong in Rust even when the UI also validates. There is no HTTP backend, cloud account or microservice requirement.

The current vertical slice separates UI, IPC contracts, desktop command handlers and SQLite storage. List operations live in a dedicated Rust storage module. Split other domain and storage modules as import and backups arrive. Keep each business rule owned in one place. Do not introduce a service framework or dependency injection container for an embedded local store.

## Current data model

- `games`: stable game identity and title, plus optional IGDB identity, cover ID and community-rating snapshot.
- `library_entries`: personal status, platform label, optional rating, duration in seconds, completion date, platinum goal, notes and archive state.
- One personal entry per game is enforced in this first schema. Replays and multi-platform copies need a deliberate later migration, not duplicated title-based keys.
- SQLite foreign keys and constraints complement Rust validation. Updates use transactions. Queries return no more than 100 entries at a time.
- `game_lists` and `game_list_entries`: named checklists referencing personal library entries, in addition order. Completion derives from the shared library status, including archived members.
- Schema version 3 adds list tables and foreign keys; version 2 introduced catalog metadata. Existing version-1/2 libraries receive a SQLite snapshot beside the database before migration. Unsupported newer versions are refused without downgrading.

## Planned modules

Library, tags, sagas, imports, backup/restore and metadata integrations. A saga item can reference a game; completion then derives from personal progress unless an explicit reviewed override exists. Import provenance stores raw source values and normalization decisions. Empty data and real zero must remain distinct.

## Optional online features

IGDB/Twitch cover lookup is opt-in and implemented on this branch. Rust authenticates, fetches candidates and caches selected covers on disk. The renderer loads visible cached images through a narrow read command; no general filesystem permission is exposed. Public search thumbnails use only the IGDB CDN. The owner confirms the correct edition before saving the link. Never embed a shared confidential client secret in a distributed binary. Authentication is session-only; any future persistent credential feature must use OS-protected storage. A public hosted proxy would be a separate deployment decision. See [IGDB boundaries and setup](IGDB.md).

The donation command opens one fixed Buy Me a Coffee URL. The frontend has no unrestricted shell or filesystem permission. External covers must retain their own source attribution and applicable rights.

## Distribution

The app identifier determines its data directory and must remain stable. Native desktop tests use a separate identifier. Windows x64 with an NSIS installer is the first target. Release artifacts must include access to corresponding source and build instructions. No update may silently remove user data.

## Resource budget

One primary webview. Bounded queries and state, thumbnail caching, no continuous polling while idle. Target 150–300 MB in ordinary use; a hard supported-scenario budget below 1,000 MB across the host and associated WebView2 processes. These are goals until benchmark evidence exists. Optimize CPU and disk activity too; do not obtain a smaller RAM number by causing continuous paging during games.
