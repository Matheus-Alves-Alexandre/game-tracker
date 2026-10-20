# Automated development previews

The Release workflow follows successful **CI push runs on main**. It rejects pull-request runs, other repositories, failed runs and stale main revisions. It checks the current main SHA again before publishing. Main protection and all required checks remain mandatory.

Each eligible run creates a unique version such as `0.1.0-alpha.42`, using the base version in the manifests and that CI workflow's run number. Retries reuse the same version; published releases are not overwritten. Numbers above 65535 fail rather than generating an unsupported Windows version. A manual retry accepts a successful main push CI run ID, not arbitrary source or a version.

The runner changes version fields in the npm, Cargo and Tauri manifests and lockfiles only for the build. The installer and corresponding source ZIP have matching generated versions. An annotated tag identifies the original reviewed source SHA; release notes explain the version-only build adjustment. No generated version commit is pushed to main. The source ZIP comes from a Git tree containing tracked files plus these version changes, excluding private databases, spreadsheets, environment files and local caches.

Publication creates a draft, uploads the Windows x64 installer and corresponding source ZIP, then publishes the complete prerelease. Failed uploads leave a draft that a retry can repair. Published versions are skipped. A changed main revision blocks stale publication; its own successful CI starts a new build.

These are **development previews**, not stable releases. The website fetches the release list and links directly to the newest available published Windows installer, including previews, with a visible Preview label. No token is required by the website. The standard GitHub latest-stable redirect does not select prereleases.

Installed apps do not update themselves yet. Users download and run the new installer manually, keeping the same application identifier and data directory. Back up data before upgrades; schema changes can prevent downgrades. Signed in-app updates still require the separate [updater milestone](UPDATES.md).

## Activation and verification

Merge the reviewed workflow PR, then wait for its main push CI to succeed. The Release workflow should build and publish the installer automatically. Verify the tag's SHA, prerelease status, both assets, generated package versions in the source ZIP, and the website download. Until that hosted build completes, local configuration tests do not prove installer publication or installation.

The workflow uses only GitHub's scoped Actions token, with read access to CI metadata and write access to releases. No Twitch/Steam credentials or updater signing secrets are needed for these unsigned previews. No publication runs from a PR.
