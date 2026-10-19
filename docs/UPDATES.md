# Installed application updates

Status: planned distribution milestone. The current app does not check for or install updates. Do not advertise this as implemented until the signed installed-upgrade path passes verification.

## Distribution paths

Installed Windows users will receive stable releases through Tauri's updater. Source users pull reviewed Git changes, install locked dependencies and rebuild. Development commits do not automatically become public installer releases.

The existing website follows the latest GitHub Release. Add an updater manifest and signed artifacts to that same release. Manifest URLs must identify the exact versioned artifact, not a moving download that could resolve to different bytes.

## User experience and data

Start with a Check for updates action. An optional bounded startup check can follow; do not poll during games. Show version, release notes, progress and download size when known. Offline startup and network failure must leave the library usable. Let players defer installation; do not interrupt games or discard an open editor. Require confirmation, finish pending writes, create a safety backup and hand off to the installer. Prevent concurrent attempts.

Keep the application identifier and data directory stable. Upgrade schemas through tested migrations. Reject unsupported newer schemas without modifying them; never silently downgrade data during rollback.

## Signing and releases

Tauri validates update signatures with a public key embedded in the app. This verification key is safe to commit. Keep its private signing key and password outside the repository, binary and logs. Use protected GitHub Actions secrets for releases and a separate owner-controlled recovery copy. Losing the private key can break existing installations' update path.

Build and sign only the exact protected main revision that passed required checks. Never expose signing credentials to untrusted pull-request code. Publish the installer, signature, corresponding source and `latest.json` together after validating target, versions and HTTPS URLs. Missing signing material blocks publication; there is no unsigned fallback. Updater signatures are separate from Windows Authenticode publisher signatures.

## Required evidence before activation

Install a signed version A in a disposable Windows profile, create records and update through the app to a signed test version B on an isolated test channel. Verify records and migrations after restart. Exercise deferral, offline startup, interrupted download, wrong signature, missing manifest and unsupported architecture. Mocked checks alone do not prove an installed upgrade. Keep test keys and channels separate from production.

Activation requires an owner-controlled signing key, protected release secrets and successful installed A-to-B evidence. Do not ship the first stable installer promising updates before these are ready.

Reference: [official Tauri updater documentation](https://v2.tauri.app/plugin/updater/).
