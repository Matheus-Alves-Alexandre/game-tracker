# Import games from an IGDB saga

Connect your Twitch developer application in **Settings**, then create or choose a list under **Game lists**. Open **Find a saga on IGDB**, search a game or saga name (for example Borderlands), and select a returned collection or franchise. No other layout or navigation redesign is part of this feature.

The search discovers collection/franchise links from up to 20 matching games. Members are then fetched by that relationship, rather than by title substring. Missing IGDB relationships can leave a saga undiscovered or incomplete; try a more specific game title, another returned relationship, or manual entry. The [IGDB documentation](https://api-docs.igdb.com/) defines these catalog relationships.

Review covers, release years, game types and platforms. Extras such as DLC, expansions, remakes, remasters, bundles and alternate editions are hidden initially; enable the extras checkbox to see them. No games are preselected. Select individual entries or up to 100 visible games at once. Hidden entries are never imported. Load additional pages when offered: 100 entries per request, at most 2,000 loaded entries. These bounds are explicit; the app does not claim that an incomplete catalog is an exhaustive franchise checklist.

Enter the platform using the same label as your library, such as PC, and select **Add selected games**. Imports are atomic batches of 1–100 games. Existing IGDB identity plus platform is reused; a matching manual title/platform without an IGDB ID can be linked. Existing titles, notes, hours, ratings, statuses and archive state are preserved. New records start as Planned. Games already in the list are skipped, and a repeat import creates no duplicate memberships. Distinct platforms and catalog editions remain distinct records.

Games are saved before selected covers are cached. Cover failures do not undo saved games; repeated failures stop the cache pass. Leaving this importer stops further cover requests after the current request. Selected metadata remains usable offline after saving; cached covers work offline as before. No credentials are persisted or included in imports.

## Verification

Loopback HTTP tests cover relation discovery, relation deduplication, query bounds and pagination using synthetic credentials. Temporary SQLite tests cover repeat import, identity matching, personal-field preservation and rejection of invalid batches without partial records. Renderer tests cover explicit selection, extras filtering, pagination and recoverable import failure. The native Windows test also exercises batch import through real Tauri IPC and checks the resulting checklist progress in the isolated profile. Hosted checks remain required before merge. Live IGDB responses still depend on the user's own connection and current catalog coverage.
