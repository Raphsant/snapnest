# SnapNest architecture & fragility review

Pre-production, solo-founder lens. Findings are from `src/` (and backend limits where the client depends on them). Signal over volume.

---

## Critical (fix before real users)

### 1. Production API URL is still dev-only

**Where:** `src/services/api.ts` lines 25–27, 8–9

**What:** `API_BASE_URL` is always `http://<dev-host>:3000`. Non-`__DEV__` builds still use `FALLBACK_DEV_API_HOST` (`10.0.0.25`). There is no `EXPO_PUBLIC_*` or release config.

**Why it matters:** A TestFlight/production build will hit the wrong host (or nothing). Every authenticated feature fails.

**Effort:** Small (env + `expo-constants` / EAS secrets). Must-do before any external tester.

---

### 2. Upload path loads the entire file into memory

**Where:** `src/services/uploadService.ts` lines 48–49, 77

**What:** `fetch(fileUri)` → `.blob()` → `xhr.send(fileBlob)`.

**Why it matters:** A 60s 720p video or burst of photos can OOM or freeze the JS thread on real devices. This is the main “large files” risk, worse than queue logic.

**Effort:** Medium–large (streaming upload via `expo-file-system` upload APIs or native multipart). Highest-impact media fix.

---

### 3. Retries create new backend files instead of resuming

**Where:** `src/services/uploadManager.ts` lines 86–93 (always `requestPresignedUrl`); `uploadQueueStore.ts` lines 81–88 (`resetStuckUploads` only resets status)

**What:** Every failure/retry (including after kill mid-upload) starts a **new** `POST /uploads`, which always creates a new `MediaFile` + `UploadJob` (backend `uploads.service.ts` lines 143–167). Backend `completeUpload` is idempotent for the **same** `uploadId`, but the client never reuses `backendUploadId` / `backendFileId`.

**Why it matters:** Flaky network or “confirm failed after S3 succeeded” → orphan `PENDING` rows and duplicate S3 objects. Activity/folders counts drift; storage cost grows silently.

**Effort:** Medium (resume: if `backendUploadId` set, skip presign, re-PUT or only `complete`; handle expired presign explicitly).

---

### 4. Persisted upload queue survives logout and app restarts with dead URIs

**Where:** `src/store/uploadQueueStore.ts` lines 25–97 (`persist` + `localUri`); `SettingsScreen.tsx` lines 24–28 (only `clearUser`, no queue clear); `RootNavigator.tsx` lines 78–84 (resumes queue on login)

**What:** Queue is in AsyncStorage keyed globally (`snapnest-upload-queue`), not per user. Logout does not clear it. After restart, `localUri` often points at temp camera paths that no longer exist.

**Why it matters:** Shared device / account switch → wrong-user queue UI and failed uploads. Silent permanent failures until user clears failed rows. `queueCaptureUpload` only logs errors (`CameraScreen.tsx` lines 59–60).

**Effort:** Small–medium (clear queue on logout; scope storage by `userId`; validate `FileSystem.getInfoAsync` before upload).

---

### 5. JWT logged to console in normal flows

**Where:** `src/services/authService.ts` line 153; `SettingsScreen.tsx` lines 49–52

**What:** Full ID token printed on token fetch and on Settings mount.

**Why it matters:** Real users + crash/log tools = credential leak. Not acceptable outside pure local dev.

**Effort:** Trivial (delete or gate behind `__DEV__`).

---

### 6. Activity feed is capped at 50 files with no pagination

**Where:** `src/hooks/useFiles.ts` + `filesService.ts` `getUserFiles()` (no `limit`); backend default `DEFAULT_FILES_LIMIT = 50` in `uploads.service.ts` lines 38, 289–304

**What:** Activity uses `useFiles()` → `GET /files` with no cursor/limit. Backend returns at most 50, newest first.

**Why it matters:** Power users lose older items from Activity with no warning. Feels like data loss.

**Effort:** Medium (client `limit`/`before` + infinite scroll or “load more”).

---

## Worth fixing soon

### Fake stacks (`FoldersStack`, `AuthFlow`) — cost vs fix now

**Where:** `FoldersStack.tsx` lines 11–41; `AuthFlow.tsx` lines 13–53

**What you pay:**

- No real stack history: only `navigate('FolderDetail')` / `goBack()` — no `replace`, no nested routes.
- **No deep linking** (`NavigationContainer` in `RootNavigator.tsx` has no `linking`).
- **No iOS edge-swipe back** on folder detail (chevron only, line 256 `FolderDetailScreen.tsx`).
- **No `BackHandler`** anywhere — on Android, hardware back from folder detail likely does **not** pop your fake stack (may leave detail or behave oddly).
- Auth: same limitations; type casts at `AuthFlow.tsx` lines 26, 33.
- `@react-navigation/native-stack` is still a dependency but unused — the Fabric `setColor:` crash workaround is documented in `CHANGELOG_SESSION.md`.

**What still works:** Tab state is kept (`detachInactiveScreens={false}` in `RootNavigator.tsx` line 25), so switching tabs while in folder detail preserves list/detail state. Fine for MVP if you stay on iOS and one level deep.

**Worth fixing properly?** Before marketing/deep links: yes. Before a few friends on iOS: acceptable if you document “use back chevron.” Try **JS stack** (`@react-navigation/stack`) before native-stack if Fabric is still the blocker. **Effort:** half day–2 days depending on crash repro.

---

### `useBatchViewUrls` will 400 when >100 thumbnails

**Where:** `useBatchViewUrls.ts`; consumers pass all IDs (`ActivityScreen.tsx` 40–47, `FolderDetailScreen.tsx` 97–103, `MediaViewerModal.tsx` 222–231); backend `MAX_BATCH_VIEW_URL_IDS = 100`

**Why:** Folder detail loads **all** folder files (`folders.service.ts` lines 63–66, no cap). Grids/viewers requesting 101+ IDs get `BadRequestException` — thumbnails fail for the whole query.

**Effort:** Small (chunk requests in hook).

---

### Duplicate rows: queue + `PENDING` backend files

**Where:** `useActivityFeed.ts` lines 36–56; `getUserFiles` returns all statuses

**What:** After presign, backend has `PENDING` `MediaFile`. Queue row shows “uploading.” Pull-to-refresh on Activity can fetch `PENDING` files and show **both** until complete.

**Effort:** Small (filter `uploadStatus !== 'PENDING'` in feed, or hide queue when `backendFileId` matches).

---

### Upload pipeline inconsistencies (not broken, but fragile)

| Issue | Where |
|--------|--------|
| FIFO + `isProcessing` is sound for MVP | `uploadManager.ts` 17–77 |
| `retryItem` increments `attemptCount`; failure path also increments — manual retry burns attempts faster | `uploadQueueStore.ts` 61–74, `uploadManager.ts` 121 |
| `friendlyError` only matches message substrings, not Axios `response.status` | `uploadManager.ts` 26–37 |
| `axios` 30s timeout on presign/confirm, not on S3 XHR — OK for big uploads to S3, bad if confirm hangs | `api.ts` 31 |
| `NetInfo` in `package.json` but unused — no pause/resume on offline | — |
| Dead second pipeline: `useGalleryUpload.ts` bypasses queue (unused in app) | whole file |

---

### Auth / API error handling gaps

- **No response interceptor** for 401/403 — queries surface raw Axios errors; upload manager’s auth message (`uploadManager.ts` 32–33) rarely triggers unless message contains `"401"`.
- **Logout failure swallowed** — `SettingsScreen.tsx` 29–31: user may think they’re logged out while Cognito session remains.
- **`hydrate` failure** sets `user: null` silently (`authStore.ts` 63–65) — fine for splash, but indistinguishable from “not logged in.”

---

### `detachInactiveScreens={false}`

**Where:** `RootNavigator.tsx` line 25

**Tradeoff:** Keeps camera + all tabs mounted (helps tab/fake-stack state). Costs memory/battery on low-end devices with camera + multiple lists.

---

### Product gaps that affect “real conditions” (known, still matter soon)

- **Video:** viewer is placeholder (`MediaViewerModal.tsx` 94–99); core value prop incomplete.
- **Cloud upload only if save to camera roll succeeds** (`CameraScreen.tsx` 263–266, 290–293) — deny Photos permission → capture saved nowhere in cloud, only local toast.
- **Folder grids:** `MediaThumbnailGrid` has no `windowSize` / virtualization tuning for huge folders (unbounded folder `files` from API).

---

## Minor / can ignore for now

- Duplicated tab-bar padding constants across screens (`TAB_BAR_*` in Activity, Settings, Folders, FolderDetail).
- `confirmUpload` sends `fileId`/`s3Key` body; backend ignores body (`uploads.controller.ts` 40–45) — harmless.
- `useGalleryUpload` + `uploadVideoFromGallery` — dead code until wired or deleted.
- `expo-file-system/legacy` in `CameraScreen.tsx` line 4 — track Expo migration later.
- `native-stack` dependency unused.
- Type safety: no `any` in `src/`; a few `as` casts in `AuthFlow` only.
- React Query: consistent invalidation keys; `refetchOnWindowFocus: false` everywhere (mobile-appropriate).

---

## What’s actually good (don’t churn this)

1. **Layering** — `services/` / `hooks/` / `screens/` / `components/` is clear; domain types in `filesService.ts` match backend.
2. **Auth UX** — `authService.ts` `translateAmplifyError` (lines 45–72) is solid; login/signup screens surface errors properly.
3. **Upload queue design** — Zustand persist, FIFO `isProcessing`, backoff, stuck-upload reset on hydrate (`RootNavigator.tsx` 73–84) is a reasonable MVP; core logic in `uploadManager.ts` is readable.
4. **React Query usage** — Shared `queryClient`, mutation invalidation patterns (`useMoveFile`, `useDeleteFile`, batch utils) are coherent.
5. **Batch file ops** — `batchFileOperations.ts` with `Promise.allSettled` + partial-failure alerts is the right pattern.
6. **Activity feed merge** — `useActivityFeed.ts` hiding `uploaded` queue rows avoids permanent duplicates after success.
7. **Media viewer context** — `MediaViewerContext.tsx` is small and focused; modal colocated is fine at this size.
8. **TypeScript** — Strict enough for pre-prod; services are typed end-to-end without `any`.

---

## Priority order if you only fix five things

1. API base URL / env for release builds
2. Remove JWT logging
3. Upload resume (stop duplicate `MediaFile` on retry)
4. Queue: per-user + clear on logout + dead URI handling
5. Streaming/chunked upload (memory) — or cap video length aggressively until then

Then: pagination (50-file cap), batch URL chunking, PENDING/queue dedupe, then revisit fake stacks when you need Android back, deep links, or a third navigation level.
