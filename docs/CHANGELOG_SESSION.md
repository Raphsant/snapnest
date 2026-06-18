# SnapNest — Session Changelog (Activity, Folders, Media)

Complete record of changes from this build session: **4-tab shell**, **Activity feed**, **Folders tab**, **folder edit/delete**, **in-app photo viewing**, and **iOS navigation fixes**.

---

## Storage model (FAQ)

| What | Where | Notes |
|------|--------|--------|
| **Folders** | **PostgreSQL** (`Folder`) | Name, type, owner, `parentFolderId`. **Not in S3.** |
| **File metadata** | **PostgreSQL** (`MediaFile`) | `fileName`, `mimeType`, `folderId`, `s3Key`, `uploadStatus`, etc. |
| **Photo/video bytes** | **AWS S3** | Path like `users/{userId}/raw/{timestamp}-{uuid}-{fileName}`. |
| **Upload** | Presigned S3 **PUT** | `POST /uploads` → client PUT → `POST /uploads/:id/complete` |
| **View in app** | Presigned S3 **GET** | `GET /files/:fileId/view-url` (1h TTL) |

The mobile app never holds AWS credentials. JWT auth on all API calls via `apiClient` interceptor.

---

## Part 1 — Remove Uploads tab & 4-tab `GlassTabBar`

### Removed

- `src/screens/UploadsScreen.tsx` (deleted)
- `Uploads` from `MainTabParamList` (`src/navigation/mainTabTypes.ts`)

### Updated

- **`src/navigation/RootNavigator.tsx`**
  - Tab order: **Folders → Camera → Activity → Settings**
  - `initialRouteName="Camera"`
  - Upload queue still resumes on auth hydrate (`processQueue`, `resetStuckUploads`)

- **`src/components/GlassTabBar.tsx`**
  - 4-tab layout: left cluster (Folders + Activity), center Camera FAB (56px, gradient, pulse), right (Settings)
  - Left/right clusters `flex: 1`, `justifyContent: 'space-around'`
  - FAB shadow uses `colors.cameraFabShadow`
  - Side tab icons: folder/time/settings (outline when inactive)
  - Active `#2F80ED` / inactive `#829AB1` from theme

### Unchanged

- Upload services: `uploadManager.ts`, `uploadQueueStore.ts`, `uploadService.ts`

---

## Part 2 — Activity tab (unified feed)

### New / updated services

- **`src/services/filesService.ts`**
  - `MediaFile` type (matches backend, `sizeBytes` as string)
  - `getUserFiles()` → `GET /files`
  - `getFileViewUrl(fileId)` → `GET /files/:fileId/view-url` *(added in Part 4)*

- **`src/services/queryClient.ts`**
  - Shared `QueryClient` for `App.tsx` and `uploadManager`

### Hooks

- **`src/hooks/useFiles.ts`** — `queryKey: ['files']`, `staleTime: 60_000`
- **`src/hooks/useActivityFeed.ts`**
  - Merges queue items (`status !== 'uploaded'`) + files from `useFiles`
  - Sort newest first (`createdAt` / `Date.parse(file.createdAt)`)
  - Avoids duplicate row after upload (queue hides `uploaded`; files refetch)

### Upload integration

- **`src/services/uploadManager.ts`**
  - After `confirmUpload`: `queryClient.invalidateQueries({ queryKey: ['files'] })`
  - Queue item removed after 3s success cleanup

### UI

- **`src/screens/ActivityScreen.tsx`**
  - Gradient background, `SafeAreaView` top
  - Header: Hi `{firstName}`, Activity, subtitle
  - `FlatList` + pull-to-refresh
  - Empty / loading / error states (Activity patterns)
  - Bottom padding clears floating tab bar
  - File tap → opens media viewer *(Part 4)*

- **`src/components/ActivityFeedRow.tsx`**
  - `GlassCard` rows: queue (queued / uploading % / failed retry) + file rows
  - Helpers: truncate name, size MB, `formatRelativeTime`

### App root

- **`App.tsx`** — `QueryClientProvider` + `queryClient`
- **`src/utils/formatRelativeTime.ts`** — relative times without `date-fns`

### Theme additions (Activity polish)

- `colors.accentBlueMuted` — retry chips
- `colors.accentBlueDark`, `colors.cameraFabShadow` — tab bar FAB

---

## Part 3 — Folders tab (initial)

### Backend (pre-existing, wired on mobile)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/folders` | List folders + `_count.files` |
| POST | `/folders` | Create folder |
| GET | `/folders/:id` | Folder + `files[]` |
| DELETE | `/folders/:id` | Delete if empty |
| GET | `/files` | All files (optional `?folderId=`) |

### Mobile — services & hooks

- **`src/services/foldersService.ts`**
  - `Folder` type with `fileCount` (from `_count.files`)
  - `getFolders`, `createFolder`, `getFolderDetails`

- **`src/hooks/useFolders.ts`** — `['folders']`
- **`src/hooks/useCreateFolder.ts`** — mutation + invalidate `['folders']`
- **`src/hooks/useFolderDetails.ts`** — `['folder', id]`, `enabled` when id set

### Navigation (iOS Fabric fix)

- **`src/navigation/foldersTypes.ts`** — param list + typed navigation props
- **`src/navigation/FoldersStack.tsx`**
  - **State-based** list ↔ detail (no `native-stack`)
  - Fixes crash: `-[RCTView setColor:]` when opening Folders tab
  - Same pattern as **`AuthFlow`**

- **`src/navigation/RootNavigator.tsx`**
  - Folders tab → `<FoldersStack />` (not `FoldersScreen` directly)

### Screens & components

- **`src/screens/FoldersScreen.tsx`**
  - “All Files” synthetic row (always first) → `FolderDetail` with `folderId: null`
  - Folder rows: icon, name, file count, chevron
  - `+ New Folder`, pull-to-refresh, empty hint
  - `GlassCard` rows

- **`src/screens/FolderDetailScreen.tsx`**
  - Back + title from params
  - All Files: `useFiles()`; folder: `useFolderDetails(id)`
  - Reuses `ActivityFeedRow` for files

- **`src/components/CreateFolderModal.tsx`**
  - `POST /folders`, loading/error states

### Theme

- `colors.inputBackground`, `colors.modalBackdrop`

---

## Part 4 — Folder rename/delete & photo viewer

### Backend (`snapnest-backend`)

| Method | Path | Purpose |
|--------|------|---------|
| **PATCH** | `/folders/:id` | Rename (`UpdateFolderDto`: `name`, max 100) |
| DELETE | `/folders/:id` | Delete folder (only if no files) — existed |
| **GET** | `/files/:fileId/view-url` | Presigned GET for viewing uploaded media |

**New files**

- `src/folders/dto/update-folder.dto.ts`
- `FoldersService.updateFolder()`
- `FoldersController` `@Patch(':id')`
- `UploadsService.getFileViewUrl()` — `GetObjectCommand`, 1h expiry, `UPLOADED` only

### Mobile

| File | Change |
|------|--------|
| `foldersService.ts` | `updateFolder`, `deleteFolder` |
| `filesService.ts` | `FileViewUrl`, `getFileViewUrl` |
| `useUpdateFolder.ts` | PATCH + invalidate folders + folder detail |
| `useDeleteFolder.ts` | DELETE + invalidate folders |
| `useFileViewUrl.ts` | `['fileViewUrl', fileId]` |
| `EditFolderModal.tsx` | Rename UI |
| `FoldersScreen.tsx` | **⋯** + long-press → Rename / Delete; delete blocked if `fileCount > 0` |
| `MediaViewerModal.tsx` | Full-screen viewer |
| `MediaViewerContext.tsx` | Global `openFile` / `close` |
| `App.tsx` | `MediaViewerProvider` wrapper |
| `ActivityScreen.tsx` | File tap → `openFile` |
| `FolderDetailScreen.tsx` | File tap → `openFile` |

### Image viewer note

- Initially used **`expo-image`** → crash: `Cannot find native module 'ExpoImage'` without dev-client rebuild.
- **Fixed:** `MediaViewerModal` uses React Native **`Image`** + `resizeMode="contain"` (no rebuild).
- `expo-image` may still be in `package.json`; safe to `npm uninstall expo-image` if unused.

---

## Part 5 — Bug fixes during session

| Issue | Fix |
|-------|-----|
| Folders tab crash (`setColor:`) | Replaced `native-stack` with state-based `FoldersStack` |
| `ExpoImage` native module missing | Switched viewer to RN `Image` |
| Activity list double spacing | Removed `ItemSeparatorComponent` when rows use `GlassCard` margins |

---

## API quick reference (JWT on all)

### Folders

```
GET    /folders
POST   /folders          { name, parentFolderId?, type? }
PATCH  /folders/:id      { name }
GET    /folders/:id
DELETE /folders/:id      (empty only)
```

### Files & uploads

```
GET    /files
GET    /files/:fileId/view-url
POST   /uploads
POST   /uploads/:uploadId/complete
```

---

## New packages

| Package | When | Rebuild? |
|---------|------|----------|
| *(none for Activity/Folders core)* | — | Metro reload |
| `expo-image` | Added then **not used** in viewer | Uninstall optional; rebuild only if you re-adopt it |

---

## Test plan

### Tabs & Activity

1. App opens on Camera; tab bar shows 4 tabs + FAB.
2. Activity: queue rows while uploading; file row after complete (auto-refresh).
3. Pull-to-refresh on Activity.

### Folders

4. Folders tab opens (no crash).
5. “All Files” → lists every uploaded file.
6. Create folder → appears in list.
7. Open folder → empty state if no assignments.
8. Long-press or **⋯** → Rename / Delete.
9. Delete empty folder works; delete with files shows alert.

### Photos

10. Tap photo in Activity or folder list → full-screen image.
11. Close with **×**.
12. Video row → “coming soon” message.

### Backend

13. Restart backend after pulling Part 4 API changes.
14. `.env`: `S3_BUCKET`, `AWS_REGION`, credentials valid.

---

## File index

### SnapNest (mobile) — created

```
src/services/foldersService.ts
src/services/queryClient.ts          (if not pre-existing)
src/hooks/useFolders.ts
src/hooks/useCreateFolder.ts
src/hooks/useFolderDetails.ts
src/hooks/useActivityFeed.ts
src/hooks/useUpdateFolder.ts
src/hooks/useDeleteFolder.ts
src/hooks/useFileViewUrl.ts
src/navigation/foldersTypes.ts
src/navigation/FoldersStack.tsx
src/screens/FolderDetailScreen.tsx
src/components/CreateFolderModal.tsx
src/components/EditFolderModal.tsx
src/components/MediaViewerModal.tsx
src/context/MediaViewerContext.tsx
src/utils/formatRelativeTime.ts
docs/CHANGELOG_SESSION.md             (this file)
docs/FOLDERS_AND_MEDIA.md             (shorter summary)
```

### SnapNest (mobile) — modified

```
src/navigation/RootNavigator.tsx
src/navigation/mainTabTypes.ts
src/components/GlassTabBar.tsx
src/components/ActivityFeedRow.tsx
src/screens/ActivityScreen.tsx
src/screens/FoldersScreen.tsx
src/services/filesService.ts
src/services/uploadManager.ts
App.tsx
src/theme/colors.ts
```

### SnapNest (mobile) — deleted

```
src/screens/UploadsScreen.tsx
```

### snapnest-backend — created / modified

```
src/folders/dto/update-folder.dto.ts          (new)
src/folders/folders.service.ts                (updateFolder)
src/folders/folders.controller.ts             (PATCH)
src/uploads/uploads.service.ts                (getFileViewUrl)
src/uploads/uploads.controller.ts             (GET :fileId/view-url)
```

---

## What is not built yet

- Assigning files to folders from the app (folder detail empty for new folders is expected).
- Video playback in viewer.
- File detail screen beyond full-screen image.
- Folder hierarchy UI (`parentFolderId` in API only).

---

*Last updated: session covering Activity tab, Folders tab, media viewer, and Fabric navigation workaround.*
