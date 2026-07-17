# Session changelog — Camera & Uploads (2026-07-17)

Work spanning on-device thumbnails, a dev build variant, a camera capabilities
pass, pinch-to-zoom, and a camera upload-destination selector — plus an
adversarial review pass and fixes for two user-reported bugs.

All client changes are React Native + Expo (Dev Client) + TypeScript. Backend
(`snapnest-backend`, separate repo) was read for contract verification and
received one commit; further backend follow-ups are flagged below.

`npx tsc --noEmit` passes clean after every feature. Per house rules,
typecheck is **not** proof of runtime behavior — device/simulator verification
items are listed per feature.

---

## 1. On-device thumbnail generation  *(committed)*

Fixes rotated portrait-photo thumbnails and missing video thumbnails by
generating a correctly-oriented JPEG thumb on-device at queue time and
uploading it alongside the media.

**New dependencies** (via `npx expo install`): `expo-image-manipulator`,
`expo-video-thumbnails`.

**Files**
- `src/services/thumbnailService.ts` *(new)* — `generateThumbnail({ localUri, mimeType })`.
  Photo: `manipulateAsync` resize width 480 + JPEG compress 0.7 (baking EXIF
  orientation into pixels = the rotation fix). Video: `getThumbnailAsync` at
  1000ms → same resize/compress pass. Returns `null` on any failure.
- `src/types/upload.ts` — `thumbnailUri` on `UploadQueueItem` + `EnqueueUploadInput`.
- `src/store/uploadQueueStore.ts` — persist `thumbnailUri`; persist `version` 1→2
  with a `migrate` that backfills `thumbnailUri: null` on old items.
- `src/services/uploadService.ts` — `hasThumbnail` on create input;
  `thumbnailUploadUrl` on the presign response; `thumbnailUploaded` on complete;
  new `uploadThumbnailToS3()` PUT bound to `Content-Type: image/jpeg` exactly.
- `src/services/uploadManager.ts` — PUT the thumb **before** the main upload;
  a thumb failure only logs (never fails/retries the main upload);
  `/complete` always sends an explicit `thumbnailUploaded` boolean whenever
  `hasThumbnail` was requested.
- `src/screens/CameraScreen.tsx`, `src/screens/AgencyFolderDetailScreen.tsx` —
  generate a thumb before enqueue (camera capture + gallery import).
- `src/components/MediaThumbnailGrid.tsx` — render `thumbnailUrl` with an
  `onError` fallback chain to `fullUrl`, then to the placeholder icon.
- `src/services/api.ts` — response-error interceptor now logs `status`/`url`/`data`
  (surfaces NestJS validation messages).

**Contract fix (same feature):** the backend `/uploads/:id/complete` DTO
whitelists only `thumbnailUploaded` (global `forbidNonWhitelisted`), so the
old client body `{ fileId, s3Key }` 400'd. `confirmUpload` now sends only
`{ thumbnailUploaded? }` → `confirmUpload(uploadId, thumbnailUploaded?)`.

**Device verification:** upright portrait thumbs, video thumbs appear, stale
thumb keys degrade (no broken tiles). Capture-to-queue now awaits thumb
generation (small latency).

---

## 2. Dev build variant (install alongside TestFlight)  *(committed)*

Distinct bundle id for the development build so it coexists with the
TestFlight/production app instead of overwriting it — via a dynamic config, so
production identity is untouched.

**Files**
- `app.config.js` *(new)* — reads `APP_VARIANT`; when `development`, overrides
  `name` → "SnapNest Dev", iOS `bundleIdentifier` → `com.sunnysant.snapnest.dev`,
  Android `package` → `com.sunnysant.snapnest.dev`. Scheme intentionally
  **unchanged** (`snapnest`) so Cognito's `snapnest://` redirect still works.
- `eas.json` — `development` profile sets `env: { APP_VARIANT: "development" }`.

**Build:** `eas build --profile development --platform ios` (applies the `.dev`
identity automatically; EAS will prompt for a new provisioning profile).
Local runs need the prefix: `APP_VARIANT=development npx expo run:ios`.

**Known caveat:** both variants register the `snapnest://` scheme; iOS doesn't
guarantee which app an auth redirect reopens if both are installed.

---

## 3. Camera capabilities pass  *(committed)*

**Files**
- `src/components/CameraOverlays.tsx` *(new)* — `RuleOfThirdsGrid` (2×2 hairlines,
  ~30% white) and `TimerCountdown` (large center numeral). Pure UI.
- `src/screens/CameraScreen.tsx` — features below.

**Added**
- **Flash/torch** — one right-column control: photo mode cycles `off→auto→on`
  (`flash` prop); video mode toggles the torch (`enableTorch`). Icon reflects
  mode + state.
- **Front-camera mirror** — `mirror` prop, default mirrored; control shown only
  when `facing === 'front'`.
- **Rule-of-thirds grid** — toggle chip.
- **Self-timer** — chip cycles `off→3s→10s`; full-screen countdown then fires
  the existing capture branch; tap-again cancels. Applies to photo + video
  start (stop is never delayed). Countdown uses a closure counter (no
  double-fire) and clears on unmount.
- **Recording HUD** — relocated to just above the record button (red dot + mm:ss).
- **Defaults** — `videoQuality="1080p"`, `videoStabilizationMode="auto"` (iOS).

All control state is local `useState` (no store, no new deps).

**Device caveats:** torch/flash/stabilization are no-ops in the simulator;
`videoQuality` 1080p may be coerced to the nearest iOS preset.

---

## 4. Pinch-to-zoom + the after-navigation fix

**Original (committed):** `App.tsx` wrapped in `GestureHandlerRootView`;
`CameraScreen.tsx` used the classic `PinchGestureHandler` to drive the
CameraView `zoom` prop (0–1), with a `baseZoom` captured at gesture start and
reset on camera flip. No new deps (`react-native-gesture-handler` already
installed; no `reanimated`).

**Bug (user-reported):** pinch worked on fresh load but died after switching
tabs and returning.

**Root cause:** New Architecture (Fabric) is enabled; `react-native-screens`
recycles the camera's native view on tab blur/refocus. The **classic**
`PinchGestureHandler` binds its native recognizer once on mount and only
re-attaches when the React view tag changes — but with
`detachInactiveScreens={false}` the screen never unmounts and the tag never
changes, so the recognizer is orphaned and pinch goes permanently dead (the
camera session itself stays alive, hence a live preview with dead zoom).

**Fix *(pending)* — `src/screens/CameraScreen.tsx`:** migrate to the modern
`GestureDetector` + `Gesture.Pinch()` API, which re-attaches via a ref callback
(self-heals across the view recycle). Works without `reanimated` via
`.runOnJS(true)` (JS-thread callbacks). A `zoomRef` mirror keeps the gesture
object stable (empty `useMemo` deps) instead of rebuilding it every pinch frame.

**Device verification:** pinch on fresh load, switch tabs and return, pinch
again — must respond. `ZOOM_SENSITIVITY = 0.5` still wants an on-device tune.

---

## 5. Camera upload-destination selector  *(pending)*

A header chip + bottom sheet to choose which personal folder camera captures
upload to. Backend contract (pre-existing, verified): `POST /uploads` with no
`folderId` files into the per-user system "Unfiled" folder (created on demand);
`GET /folders` returns personal folders only (`agencyId: null`), each with
`isSystem: boolean`.

**Files**
- `src/store/cameraStore.ts` *(new)* — non-persisted zustand store (plain
  `create()`): `destinationFolderId: string | null` (null = system default),
  `setDestinationFolder`, `reset`. Non-persisted ⇒ resets on app launch.
- `src/components/DestinationPickerSheet.tsx` *(new)* — RN-Modal bottom sheet
  reusing `useFolders()` (no new fetch). A "default" row (→ `null`, labeled from
  the isSystem folder's name, "Unfiled" fallback) is pinned first; the isSystem
  folder is excluded from the list body to avoid duplication; other folders in
  backend order. Highlights the current selection.
- `src/services/foldersService.ts` — `isSystem: boolean` added to the `Folder`
  type, the backend list-row type, and both mappers.
- `src/services/sessionService.ts` — `useCameraStore.reset()` in the logout wipe
  (so a folder pick never leaks across accounts).
- `src/screens/CameraScreen.tsx` — left-anchored destination chip in the top bar
  (`top: controlColumnTop`, mirrors the right control column, collision-proof);
  renders the sheet; threads `folderId` through `queueCaptureUpload` and both
  capture sites.

**Contract behavior:** selecting the system folder stores `null`, and
`processItem` already omits a null `folderId` from `POST /uploads` — so the
backend default is the source of truth (requirement: omit for isSystem).

---

## 6. Adversarial review fixes  *(pending)*

A multi-agent review of feature 5 confirmed 5 findings (requirements review
found zero gaps). Fixes applied:

1. **Self-timer stale destination** *(CameraScreen.tsx)* — the countdown's
   interval froze the capture closure. Now both capture sites read the
   destination live via `useCameraStore.getState().destinationFolderId`.
2. **Deleted-folder reconciliation** *(CameraScreen.tsx)* — a `useEffect` resets
   the selection to `null` when its id is absent from loaded folders (covers
   deletion from any source), so the chip and the upload target never disagree.
3. **Offline hides Unfiled** *(DestinationPickerSheet.tsx)* — the list is now
   gated on `!isLoading` only (error is a non-blocking banner), so the
   network-free "Unfiled" default (and cached folders) stay selectable.
4. **Accessibility** *(both files)* — `accessible={false}` on the sheet
   backdrop/body wrappers + `accessibilityViewIsModal`; chip gains
   `accessibilityHint` + `accessibilityState={{ expanded }}`.

---

## 7. Duplicate/editable "Unfiled" folder fix  *(pending)*

**Bug (user-reported):** a real, rename/delete-able "Unfiled" folder appeared in
the Folders tab, duplicating the pre-existing synthetic Unfiled section.

**Root cause:** the backend now files unfiled uploads into a **real** per-user
system folder (`resolvedFolderId = findOrCreateUnfiledFolder(userId)`;
`file.folderId = <system id>`, not null). That folder is returned by
`GET /folders` with `isSystem: true`, but the client still ran the old model —
`FoldersScreen` showed a synthetic null-based "Unfiled" section **and** the real
folder as a normal, editable row.

**Fix — `src/screens/FoldersScreen.tsx`:**
- Exclude the `isSystem` folder from the editable folder rows (removes the
  duplicate; the pinned "Unfiled" entry has no rename/delete affordance).
- Repoint the "Unfiled" entry at the real system folder (navigate by its id,
  count from its `fileCount`), falling back to the legacy `'none'` view only
  until that folder exists.
- Empty-hint logic now counts non-system folders.

`FolderDetailScreen` only does batch **file** operations (no folder rename/delete),
so opening the system folder there does not re-expose editing.

---

## Backend (`snapnest-backend`) — read-only except one commit

- **Thumbnail contract** committed earlier this session (`feat(uploads): accept
  client-generated thumbnails`): `hasThumbnail`/`thumbnailUploadUrl` on presign,
  `thumbnailUploaded` on complete, server fallback hard-gated on a null
  thumbnail key.
- The **isSystem / Unfiled system-folder** work (`findOrCreateUnfiledFolder`,
  partial unique index, `isSystem` guardrails, backfill script) was pre-existing
  and used here as the verified contract.

### Outstanding backend follow-ups (NOT done — flagged for the backend repo)
1. **Backward compat:** add optional, ignored `fileId`/`s3Key` to
   `CompleteUploadDto`, or the deployed TestFlight client (which still sends
   them) will 400 on every upload once this ships.
2. **Fallback thumbnail rotation:** `thumbnail.service.ts` `sharp(buffer).resize(...)`
   lacks `.rotate()`, so server-generated thumbs ignore EXIF orientation. Add
   `.rotate()` before `.resize()`.

---

## Flagged follow-ups (client)

- **Move-file picker double-"Unfiled":** `FolderPickerSheet` (Folder detail +
  media viewer) has the same duplicate (synthetic null row + real system folder
  in `useFolders()`), and the deeper question of whether "move to Unfiled" means
  `folderId: null` or the system id is a genuine model reconciliation — left as a
  separate task, not folded in here.
- **Backfill assumption:** the Unfiled fix assumes the backend `backfill-unfiled`
  script moved legacy `folderId: null` files into the system folder. If it didn't,
  the legacy `'none'` view would need to stay reachable.
- **`videoQuality` on iOS**, **`ZOOM_SENSITIVITY` tuning**, and an optional
  `active={isFocused}` on the CameraView (battery/privacy hygiene; note it does
  **not** fix the pinch bug and can desync the zoom prop on resume).

---

## Files touched this session

**New:** `app.config.js`, `src/services/thumbnailService.ts`,
`src/components/CameraOverlays.tsx`, `src/store/cameraStore.ts`,
`src/components/DestinationPickerSheet.tsx`.

**Modified:** `App.tsx`, `eas.json`, `package.json`,
`src/screens/CameraScreen.tsx`, `src/screens/AgencyFolderDetailScreen.tsx`,
`src/screens/FoldersScreen.tsx`, `src/components/MediaThumbnailGrid.tsx`,
`src/services/api.ts`, `src/services/uploadService.ts`,
`src/services/uploadManager.ts`, `src/services/foldersService.ts`,
`src/services/sessionService.ts`, `src/store/uploadQueueStore.ts`,
`src/types/upload.ts`.

**Currently uncommitted** (features 5–7): `src/screens/CameraScreen.tsx`,
`src/screens/FoldersScreen.tsx`, `src/services/foldersService.ts`,
`src/services/sessionService.ts`, `src/components/DestinationPickerSheet.tsx`
*(new)*, `src/store/cameraStore.ts` *(new)*.
