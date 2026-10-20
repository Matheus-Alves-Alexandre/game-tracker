# Game Tracker

A lightweight, local-first desktop game library and backlog tracker built with **Rust, Tauri, React, TypeScript and SQLite**.

[![CI](https://github.com/Matheus-Alves-Alexandre/game-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Matheus-Alves-Alexandre/game-tracker/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/Buy_me_a_coffee-Support_development-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/xxlozerxd)

Track what you play, finish and return to. Keep your personal library on your own computer. No account, subscription or cloud service is required for the core application.

**[Project website & downloads](https://matheus-alves-alexandre.github.io/game-tracker/)** · [Release history](https://github.com/Matheus-Alves-Alexandre/game-tracker/releases)

[Twitch / IGDB connection tutorial](docs/IGDB.md) · A visual setup-guide page is included under `website/twitch-setup.html` for the next reviewed Pages deployment.

## Project status

Early development. This branch supports creating and editing games, status and title/platform filters, optional ratings, playtime, completion dates, platinum goals, persistent archive recovery, keyboard-accessible dialogs and a persistent SQLite library. It is not the complete MVP yet.

This branch also includes a personal home dashboard and optional IGDB game/cover lookup with disk caching. Your Twitch application credentials are entered locally and used for one session; no shared secret is distributed. See [IGDB setup](docs/IGDB.md) and the [UI design notes](docs/UI.md).

General spreadsheet import, sagas, user-facing backup/restore, achievements synchronization and multilingual support remain planned. The database creates a safety backup when upgrading from schema 1 to schema 2; that is not a complete backup-management feature. Memory targets are engineering goals, not published benchmark results.

Signed in-app updates are [planned before stable installer distribution](docs/UPDATES.md); the current app does not update itself. See the [sprint plan](docs/SPRINTS.md) for reviewable increments.

## Features

- Local SQLite persistence, with no server to start.
- Planned, Playing, Paused, Completed and Dropped statuses.
- Optional 1–5 ratings; unrated is different from zero.
- Explicit minute input, displayed as hours and minutes.
- Completion dates, platinum goals and personal notes.
- Bounded library queries with 100 entries per page.
- Featured game, personal top-rated games, recorded finish dates and explicit platinum/playtime coverage.
- Optional IGDB edition selection with separate community ratings and offline cached covers.
- Optional support link, with no paid feature gates.

## Architecture

**Modular monolith:** one desktop application and one local database. React handles the interface. Tauri commands call Rust application code, which owns validation and persistence. There are no microservices or local HTTP server.

Current layout:

```text
src/                  React UI, typed command client and UI tests
src-tauri/src/        Rust commands, validation and SQLite storage
tests/               Native desktop end-to-end tests
scripts/             Development, verification and repository setup
.github/workflows/   Required CI checks and gated release workflow
docs/                Architecture, roadmap and verification
```

Domain modules will grow around library, sagas, import, backup and metadata integrations when those features are implemented. Avoid generic infrastructure abstractions before they are needed. See [architecture](docs/ARCHITECTURE.md) and [roadmap](docs/ROADMAP.md).

## Development on Windows

Install Node.js 24 or newer, the stable Rust MSVC toolchain, Microsoft C++ Build Tools with the Desktop development with C++ workload, Windows SDK and WebView2. Follow the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run desktop:dev
```

To generate a Windows NSIS installer:

```sh
npm run desktop:build
```

The installer is generated under `src-tauri/target/release/bundle/nsis/`. End users do not need Rust or Node.js. Early builds are unsigned. The default installer can download WebView2 if missing; a fully offline installation package remains a roadmap item.

`npm run dev` serves the renderer for development; database commands require the Tauri desktop host. It is not a separate browser edition.

For an existing Rust installation outside PATH, an ignored `.tools/toolchain.json` may specify `paths`, `cargoHome` and `rustupHome`. The scripts use normal PATH when this file is absent. Do not commit machine-specific paths.

## Verification

```sh
npm run check
npm run format:check
npm run test:ui
npm run test:backend
npm run test:site
node scripts/cargo.mjs fmt --manifest-path src-tauri/Cargo.toml -- --check
node scripts/cargo.mjs clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
```

For the actual Windows desktop test:

```powershell
node scripts/cargo.mjs install tauri-driver --locked --root .tools/tauri-driver
powershell -ExecutionPolicy Bypass -File scripts/install-webdriver.ps1
npm run desktop:build -- --debug --no-bundle --config src-tauri/tauri.e2e.conf.json
npm run test:desktop
```

The native test uses a separate application identifier, creates a uniquely named game, reloads the interface to read persisted edits through Rust IPC, and archives the test record. Backend tests separately verify closing and reopening the SQLite file. It must never run against your personal production library. See [verification](docs/VERIFICATION.md).

## CI and release policy

- Separate required checks for frontend, backend and the native Windows application.
- Test reports, screenshots and diagnostic logs retained for **14 days**.
- A required aggregate check fails if any required job fails or is cancelled.
- After successful main push CI, the release workflow automatically builds a uniquely versioned development preview and matching source archive from that exact revision. See [release automation](docs/RELEASES.md).
- Repository protection and log retention must also be applied in GitHub settings; workflow files alone do not protect a branch. The repository setup script verifies those settings.

The [project website](https://matheus-alves-alexandre.github.io/game-tracker/) deploys through GitHub Pages after a successful CI push run on `main`. Its download button follows the latest published installer automatically. Before the first release, it clearly displays that no installer is published yet. This updates the website download; it does not automatically update an installed app. See [website and release flow](docs/WEBSITE.md).

## Data and performance

The database is stored in the operating system's per-user application data directory under the app identifier, not beside the executable. There is no automatic cloud upload or telemetry. The initial version has no in-app backup UI yet; use disposable data until backup/restore ships. Always retain your original spreadsheet.

Target: **150–300 MB during ordinary use**, with all associated WebView2 processes included. The supported workload must stay below **1 GB**, including heavy-operation peaks. These targets require measurement of installed production builds; a Rust backend alone is not proof of low memory use. See the test scenarios in the verification document.

Never commit personal workbooks, databases, backups, API credentials or screenshots containing private data. Cover images and external game metadata are not automatically licensed under the source code's license.

## Contributing

Issues and pull requests are welcome. Use English for source code, documentation, issues and pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Contributions are accepted under AGPL-3.0-only. Keep changes focused and include evidence for changed behavior.

## License and credits

Copyright © 2026 Matheus-Alves-Alexandre and contributors.

This project's original code is licensed under **GNU AGPL-3.0-only**. Read the complete [LICENSE](LICENSE). There is no license fee for using or adopting AGPL. You must comply with its conditions when distributing covered work, including making the corresponding source available. Modified versions offered for interaction over a network must offer their corresponding source to those users as required by section 13.

This is an independently developed game tracker, not a Wealthfolio fork. No Wealthfolio code, branding or assets are included. That project's trademark notice is not our project's license notice. Upstream dependency licenses and notices remain applicable; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Support development

[Buy me a coffee](https://buymeacoffee.com/xxlozerxd) if you would like to support development. Donations are optional and do not unlock features or grant a different license.
