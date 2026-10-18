# Project website and installer downloads

The English project website is static HTML, CSS and a small JavaScript module under `website/`. It is hosted on GitHub Pages. Only a successful CI push run from this repository's `main` branch can trigger deployment, and the workflow checks out the exact SHA that passed.

The page queries the public GitHub Releases API once when opened. Before the first release, the download control clearly says that the first release is not available yet. On network or API errors, it offers the repository's release list instead of inventing a version or a download URL.

Published Windows installers must use the stable asset name `game-tracker-windows-x64-setup.exe`. GitHub's `/releases/latest/download/<asset-name>` redirect then resolves to the most recent published release. This avoids changing the website for each release. The release workflow still checks the selected version, runs all mandatory checks, verifies the exact main SHA, builds the installer and packages corresponding source before publishing anything.

The website's sample library is explicitly fictional. It must not be replaced with the owner's personal spreadsheet or database. No analytics, accounts or payment processing are embedded. The support link opens the owner's Buy Me a Coffee page.

Updating a download on the website does not update an already installed app automatically. An in-app updater needs its own signing and compatibility design later.

## Local verification

Run `npm run test:site`. Preview with any static HTTP server rooted at `website/`. Verify desktop and mobile widths, keyboard access, the initial no-release state, successful-release state and GitHub API failure fallback. The state tests use synthetic release responses and never publish an installer.
