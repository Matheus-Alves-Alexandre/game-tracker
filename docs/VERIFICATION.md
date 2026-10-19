# Verification plan

## Claims and evidence

| Claim                                                       | Minimum evidence                                                                                      | Owner                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------- |
| UI sends correct units and preserves unsaved work on errors | Renderer tests using IPC mocks                                                                        | Frontend check        |
| Data is validated, persisted and updated atomically         | Rust tests against temporary SQLite databases, including reopen                                       | Backend check         |
| Native UI and Rust IPC actually work together               | Windows WebDriver test creates, edits and reloads the interface to read persisted records through IPC | Application check     |
| The installer is buildable                                  | NSIS build in the release workflow                                                                    | Release job           |
| A failed or cancelled required check blocks publication     | Reusable checks plus fail-closed aggregate job and release dependencies                               | CI configuration      |
| The app meets the memory target                             | Installed production build measurements, not renderer mocks                                           | Performance milestone |

Each claim has one primary evidence path. Renderer tests do not prove SQLite persistence; Rust tests do not prove webview IPC; neither proves installer behavior.

## Sprint 1: archive recovery and modal keyboard access

Rust owns the close/reopen evidence: an archived record remains searchable after the SQLite connection is reopened, stays out of active metrics, and restores with its original fields. Renderer tests own modal focus wrapping, Escape, opener focus restoration, pending-save protection and the archive-view restore command. The native Windows test verifies these boundaries together, including background inertness, keyboard focus return and restoring an archived record after renderer reload. These paths passed locally on the sprint branch: six renderer tests, six Rust tests and one native test. TypeScript, formatting, Clippy and the desktop debug build passed as well. Hosted CI remains an independent required check before merge.

This does not establish screen-reader compatibility across assistive technologies, an installed updater or backup/restore. Those need their own acceptance evidence.

## Catalog and home evidence

Controlled loopback HTTP tests verify OAuth form requests, absence of the secret in search/CDN requests, query escaping, sanitized failures, bounded responses, session invalidation and offline disk-cache reads. SQLite tests own migration/safety-backup evidence, persisted catalog metadata and home metrics excluding archives and missing-value fabrication. Renderer tests cover password-field clearing, explicit edition selection preserving personal fields, download failure and personal/community score separation. The native test opens connection settings without authenticating and captures the home in an isolated test profile, in addition to the existing editor/archive flow.

No test claims successful live Twitch authentication without owner-provided credentials. No test or home screenshot uses the owner's production library. Workload RAM/CPU and installed-update acceptance remain separate milestones.

Settings renderer tests establish navigation back to the library/home/archive, centralized credential fields, the Steam placeholder without unused key inputs, and clearing an unsubmitted secret on navigation. The native test captures Settings in the isolated profile before exercising the library flow. This change does not add Steam synchronization or persistent secret storage.

## Desktop isolation and diagnostics

The test configuration changes the application identifier. The test creates a unique title and archives it before cleanup. Do not delete production application data. Screenshots and driver logs are written into ignored `reports/`. CI uploads diagnostics even when tests fail, with 14-day retention. GitHub repository log retention is configured separately to 14 days.

Windows runners execute elevated by default. Recent WebView2 versions ignore environment-provided debugging switches in elevated hosts, preventing WebDriver from creating a session. CI runs the native test chain at Medium integrity using gsudo, with access granted only to the ephemeral checkout. This follows the [Tauri project's own CI approach](https://github.com/tauri-apps/tauri/blob/dev/.github/workflows/test-api-e2e.yml). It does not change production browser security flags or relax any required check.

## Performance acceptance

Reference machine: Windows 11 x64, 8 GB RAM, SSD and integrated graphics. Record actual hardware, WebView2 version and display scale. Use installed production builds without development servers or inspectors.

Measure the app and associated WebView2 processes by PID/profile, excluding unrelated browser apps. Record private working set, private committed bytes, peaks, normalized CPU and disk activity. Do not double-count shared pages. Target 150–300 MB normally, at most 500 MB in ordinary scenarios, and below 800 MB during heavy work as a safety margin. Both private resident and private committed totals must remain below 1,000 MB in supported scenarios. Minimized target: 150 MB. Idle CPU target: below 0.5% of total capacity, averaged with transient peaks reported separately.

Test 41 entries and a synthetic 10,000-entry library with 100 sagas when implemented. Navigate/filter for 15 minutes, remain open for 60 minutes, and minimize for 30 minutes while a game runs. Add real and synthetic 10,000-row imports when import ships. Repeat with 1,000 cached thumbnails when covers ship. Verify repeated navigation/minimize cycles do not cause continued growth. Keep exact build SHA and results. None of these RAM targets has been established by the initial source tests.
