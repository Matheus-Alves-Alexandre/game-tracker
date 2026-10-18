# Verification plan

## Claims and evidence

| Claim | Minimum evidence | Owner |
| --- | --- | --- |
| UI sends correct units and preserves unsaved work on errors | Renderer tests using IPC mocks | Frontend check |
| Data is validated, persisted and updated atomically | Rust tests against temporary SQLite databases, including reopen | Backend check |
| Native UI and Rust IPC actually work together | Windows WebDriver test creates, edits and reloads a record across sessions | Application check |
| The installer is buildable | NSIS build in the release workflow | Release job |
| A failed or cancelled required check blocks publication | Reusable checks plus fail-closed aggregate job and release dependencies | CI configuration |
| The app meets the memory target | Installed production build measurements, not renderer mocks | Performance milestone |

Each claim has one primary evidence path. Renderer tests do not prove SQLite persistence; Rust tests do not prove webview IPC; neither proves installer behavior.

## Desktop isolation and diagnostics

The test configuration changes the application identifier. The test creates a unique title and archives it before cleanup. Do not delete production application data. Screenshots and driver logs are written into ignored `reports/`. CI uploads diagnostics even when tests fail, with 14-day retention. GitHub repository log retention is configured separately to 14 days.

## Performance acceptance

Reference machine: Windows 11 x64, 8 GB RAM, SSD and integrated graphics. Record actual hardware, WebView2 version and display scale. Use installed production builds without development servers or inspectors.

Measure the app and associated WebView2 processes by PID/profile, excluding unrelated browser apps. Record private working set, private committed bytes, peaks, normalized CPU and disk activity. Do not double-count shared pages. Target 150–300 MB normally, at most 500 MB in ordinary scenarios, and below 800 MB during heavy work as a safety margin. Both private resident and private committed totals must remain below 1,000 MB in supported scenarios. Minimized target: 150 MB. Idle CPU target: below 0.5% of total capacity, averaged with transient peaks reported separately.

Test 41 entries and a synthetic 10,000-entry library with 100 sagas when implemented. Navigate/filter for 15 minutes, remain open for 60 minutes, and minimize for 30 minutes while a game runs. Add real and synthetic 10,000-row imports when import ships. Repeat with 1,000 cached thumbnails when covers ship. Verify repeated navigation/minimize cycles do not cause continued growth. Keep exact build SHA and results. None of these RAM targets has been established by the initial source tests.
