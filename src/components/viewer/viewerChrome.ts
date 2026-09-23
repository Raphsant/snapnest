/**
 * Shared values and label helpers for the media viewer's chrome.
 *
 * The viewer is a DARK screen in BOTH themes — the same rule as the camera (see
 * `sharedDark` in theme/tokens.ts). Its background is `colors.darkBg` and
 * everything drawn on top is `colors.cream` or a tint of it, so Comfort and
 * Blue are identical here by design. The tints live next to the viewer rather
 * than in the palette because nothing outside the viewer uses them.
 */

import type { MediaFile } from '../../services/filesService';
import { formatFileSize } from '../../utils/formatRelativeTime';

/* Cream (`colors.cream`) at the opacities the design calls for. ------------ */

/** Neutral chip and action-tile fill. */
export const CREAM_10 = 'rgba(253,250,244,0.1)';
/** Round icon-button fill in the top bar. */
export const CREAM_12 = 'rgba(253,250,244,0.12)';
/** Hairlines and the details-panel grabber. */
export const CREAM_20 = 'rgba(253,250,244,0.2)';
/** Top-bar sub line. */
export const CREAM_50 = 'rgba(253,250,244,0.5)';
/** Details-panel row labels. */
export const CREAM_60 = 'rgba(253,250,244,0.6)';
/** Neutral chip label. */
export const CREAM_75 = 'rgba(253,250,244,0.75)';

/** Backed-up chip: the design's sage tint. */
export const CHIP_OK_BG = 'rgba(122,138,94,0.22)';
export const CHIP_OK_TEXT = '#cfe0b0';

/** Not-backed-up chip: the same recipe on the warn hue (warn at 22%). */
export const CHIP_WARN_BG = 'rgba(192,138,46,0.22)';
export const CHIP_WARN_TEXT = '#f0d9a8';

/** Delete tile tint — the palette's danger reds are too dark on `darkBg`. */
export const DANGER_ON_DARK = '#ff9d8f';

/** Disabled action tiles and filmstrip neighbours. */
export const DISABLED_OPACITY = 0.45;

/* Labels ------------------------------------------------------------------- */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isVideoFile(file: MediaFile): boolean {
  return file.fileType === 'VIDEO' || file.mimeType.trim().toLowerCase().startsWith('video/');
}

/** The viewer only ever shows these two kinds. */
export function kindLabel(file: MediaFile): string {
  return isVideoFile(file) ? 'Video' : 'Photo';
}

/** "Photo · 0.4 MB" */
export function kindAndSizeLabel(file: MediaFile): string {
  return `${kindLabel(file)} · ${formatFileSize(file.sizeBytes)}`;
}

/**
 * The file's folder name, or "Unfiled" when it is in none. `null` when the list
 * didn't include the folder — callers decide whether to show a fallback.
 */
export function folderLabel(file: MediaFile): string | null {
  if (file.folder?.name !== undefined && file.folder.name.trim() !== '') {
    return file.folder.name;
  }
  if (file.folderId === null) {
    return 'Unfiled';
  }
  return null;
}

/** "24 July" — the day/month format the folder grid's section headers use. */
export function formatDayMonth(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const date = new Date(then);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Local wall-clock "HH:mm", as on the Uploads tab's backed-up rows.
 *
 * Callers pass `createdAt`, i.e. CAPTURE time. That is deliberate: MediaFile
 * carries no upload timestamp, and `updatedAt` is not one — a move rewrites it —
 * so the backed-up chip must not be "fixed" to read `updatedAt`.
 */
export function formatClockTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const date = new Date(then);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "1:04" for a video's duration; `null` when the backend sent none. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  const total = Math.floor(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
