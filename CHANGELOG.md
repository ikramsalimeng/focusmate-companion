# Changelog

## v1.3.0 — Ambient Audio, Performance, and Trust Cleanup

### Added

- Ambient audio support for brown noise, dark noise, and rain.
- Ambient volume control.
- Option to keep ambient audio playing between sessions.
- Pop-out companion window support.
- Separate audio setup guide in `AUDIO.md`.
- Privacy note in `PRIVACY.md`.
- Security contact note in `SECURITY.md`.

### Improved

- Task workflow with persistent local task storage.
- Multi-line paste support for adding several tasks at once.
- Random task picker for choosing one unfinished task.
- Copy-all task list action.
- Clear-completed task action.
- Live popup status updates.
- Progress display for common Focusmate session lengths.

### Performance

- Reduced repeated storage writes during active sessions.
- Skips unnecessary work when the Focusmate tab is hidden.
- Avoids broad full-page text scanning for pre-session detection.
- Consolidated session timing work into a lighter loop.

### Permissions

- Removed the Chrome `tabs` permission.
- Chrome manifest now uses only:
  - `storage`
  - `windows`
  - `host_permissions: https://app.focusmate.com/*`

### Notes

- Audio binaries are not included in the GitHub source by default. See `AUDIO.md` for setup.
- The Chrome Web Store package may include audio assets if they are generated or properly licensed.

## v1.0.0 — Initial Release

- Added Focusmate session audio cues.
- Added tick/tock sounds.
- Added voice time announcements.
- Added seconds countdown.
- Added basic task list.
- Added Chrome and Firefox manifest support.
