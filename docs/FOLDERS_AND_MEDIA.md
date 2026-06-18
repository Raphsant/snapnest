# SnapNest — Folders, Activity & Media Viewing

Summary of the **initial tab/Activity/Folders build** and the **follow-up** work (folder edit/delete, in-app photos, storage model).

---

## Where is data stored?

| What | Where | Notes |
|------|--------|--------|
| **Folders** | **PostgreSQL** (Prisma `Folder` table) | Metadata only: name, type, owner, parent, timestamps. **Not in S3.** |
| **File metadata** | **PostgreSQL** (`MediaFile` table) | `fileName`, `mimeType`, `folderId`, `s3Key`, `uploadStatus`, etc. |
| **Actual photos/videos** | **AWS S3** | Bytes live at `s3Key` (e.g. `users/{userId}/raw/...`). Upload uses presigned **PUT**; viewing uses presigned **GET**. |

The app never talks to S3 directly with your AWS keys. The backend signs short-lived URLs; the app uses those URLs to upload or display media.

---

## Part A — Initial changes (Activity tab & 4-tab shell)

### Navigation & tab bar

- Removed **Uploads** tab; tabs are **Folders | Camera | Activity | Settings**.
- **`GlassTabBar`**: 4-slot layout, camera FAB centered, pulse/glow.
- **`RootNavigator`**: 4 tabs, `initialRouteName="Camera"`.

### Activity feed

- **`filesService.ts`**: `MediaFile` type, `getUserFiles()` → `GET /files`.
- **`useFiles.ts`**: React Query `['files']`.
- **`uploadManager.ts`**: invalidates `['files']` after upload completes.
- **`useActivityFeed.ts`**: merges upload queue (non-`uploaded`) + files, newest first.
- **`ActivityScreen.tsx`**: header, pull-to-refresh, empty/loading/error states.
- **`ActivityFeedRow.tsx`**: glass rows for queue + file items.

### Upload queue

- Upload services/store unchanged; only the **Uploads screen** was removed.

---

## Part B — Initial Folders tab (mobile UI)

### Services & hooks

- **`foldersService.ts`**: `getFolders`, `createFolder`, `getFolderDetails`; maps `_count.files` → `fileCount`.
- **`useFolders`**, **`useCreateFolder`**, **`useFolderDetails`**.

### Navigation (Fabric-safe)

- **`FoldersStack`**: state-based list ↔ detail (no `@react-navigation/native-stack`) to avoid iOS `-[RCTView setColor:]` crash (same approach as **`AuthFlow`**).
- **`foldersTypes.ts`**: `FolderList`, `FolderDetail` params.
- **`RootNavigator`**: Folders tab renders **`FoldersStack`**.

### Screens

- **`FoldersScreen`**: “All Files” synthetic row + folder list, create modal, pull-to-refresh.
- **`FolderDetailScreen`**: back header, files via `useFiles` (all) or `useFolderDetails` (folder), reuses **`ActivityFeedRow`**.
- **`CreateFolderModal`**: name input, `POST /folders`.

---

## Part C — This prompt (edit/delete folders + view photos)

### Backend (`snapnest-backend`)

| Endpoint | Purpose |
|----------|---------|
| `PATCH /folders/:id` | Rename folder (`UpdateFolderDto`: `name`) |
| `DELETE /folders/:id` | Delete folder (already existed; **only if empty**) |
| `GET /files/:fileId/view-url` | Presigned S3 **GET** URL (1h TTL) for viewing an uploaded file |

**`uploads.service.ts`**: `getFileViewUrl()` — uses `thumbnailS3Key` if set, else `s3Key`; requires `uploadStatus === UPLOADED`.

### Mobile app

| Area | Change |
|------|--------|
| **`foldersService`** | `updateFolder`, `deleteFolder` |
| **`filesService`** | `getFileViewUrl`, `FileViewUrl` type |
| **Hooks** | `useUpdateFolder`, `useDeleteFolder`, `useFileViewUrl` |
| **`EditFolderModal`** | Rename flow |
| **`FoldersScreen`** | **⋯** button + **long-press** → Rename / Delete; delete blocked if `fileCount > 0` |
| **`MediaViewerModal`** | Full-screen image via React Native **`Image`** + presigned URL |
| **`MediaViewerContext`** | `openFile(file)` from Activity & folder detail |
| **`App.tsx`** | wraps app in **`MediaViewerProvider`** |
| **Activity / Folder detail** | tapping a file opens viewer (images); videos show “coming soon” |

### Image viewer dependency

- Uses built-in React Native **`Image`** (no native rebuild). Optional: `expo-image` if you rebuild the dev client later for caching/performance.

---

## How to use folder actions

1. Open **Folders** tab.
2. On a real folder row (not “All Files”):
   - Tap **⋯**, or **long-press** the row.
3. **Rename** → edit name → Save.
4. **Delete** → only allowed when folder has **0 files** (backend rule).

---

## How to view photos

1. Open **Activity**, **All Files**, or a **folder detail** list.
2. Tap a **photo** row (image mime types).
3. App calls `GET /files/:id/view-url`, then shows the image full-screen.
4. Tap **×** to close.

Videos show a placeholder until playback is implemented.

---

## Test checklist

- [ ] Folders tab opens (no native-stack crash).
- [ ] Create / rename / delete empty folder.
- [ ] Delete blocked when folder has files.
- [ ] Tap photo in Activity → image loads from S3 URL.
- [ ] Tap photo in All Files / folder detail → same viewer.
- [ ] Backend running with valid `S3_BUCKET` and AWS creds.

---

## Common issues

| Issue | Likely cause |
|-------|----------------|
| Image won’t load | S3 creds/bucket; file not `UPLOADED`; presigned URL expired (refetch by closing/reopening viewer) |
| Delete fails | Folder not empty (`409` from backend) |
| Folders tab crash | Re-introduced `native-stack` under Folders — keep state-based `FoldersStack` |
| `Cannot find native module ExpoImage` | Rebuild dev client **or** use RN `Image` (current default in `MediaViewerModal`) |

---

## Files touched (reference)

### SnapNest (mobile)

- `src/navigation/`, `src/screens/FoldersScreen.tsx`, `FolderDetailScreen.tsx`
- `src/services/foldersService.ts`, `filesService.ts`
- `src/hooks/useFolders.ts`, `useCreateFolder.ts`, `useFolderDetails.ts`, `useUpdateFolder.ts`, `useDeleteFolder.ts`, `useFileViewUrl.ts`
- `src/components/CreateFolderModal.tsx`, `EditFolderModal.tsx`, `MediaViewerModal.tsx`, `ActivityFeedRow.tsx`
- `src/context/MediaViewerContext.tsx`
- `App.tsx`
- `docs/FOLDERS_AND_MEDIA.md` (this file)

### SnapNest Backend

- `src/folders/` — `updateFolder`, `PATCH` route, `UpdateFolderDto`
- `src/uploads/uploads.service.ts` — `getFileViewUrl`
- `src/uploads/uploads.controller.ts` — `GET :fileId/view-url`
