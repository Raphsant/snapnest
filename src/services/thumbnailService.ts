import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';

/** Target width for generated thumbnails. Height scales to preserve aspect ratio. */
const THUMBNAIL_WIDTH = 480;
/** JPEG quality for the resize/compress pass (0–1). */
const THUMBNAIL_COMPRESS = 0.7;
/** Frame timestamp (ms) sampled for video thumbnails. */
const VIDEO_FRAME_MS = 1000;

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * Resize + JPEG-compress a local image. Resizing to a fixed width bakes the
 * source EXIF orientation into the pixels, which is the rotated-portrait fix:
 * S3/backend never see the orientation flag, so the thumb renders upright.
 */
async function resizeToJpeg(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: THUMBNAIL_WIDTH } }],
    { compress: THUMBNAIL_COMPRESS, format: SaveFormat.JPEG },
  );
  return result.uri;
}

/**
 * Produce a local JPEG thumbnail for a queued upload.
 *
 * - Photo: resize/compress the source image directly.
 * - Video: grab a frame at 1000ms, then run it through the same resize/compress.
 *
 * Returns the local file URI of the thumbnail, or `null` if generation fails
 * for any reason — callers proceed without a thumb (hasThumbnail: false path).
 */
export async function generateThumbnail(input: {
  localUri: string;
  mimeType: string;
}): Promise<string | null> {
  try {
    if (isVideoMime(input.mimeType)) {
      const frame = await getThumbnailAsync(input.localUri, { time: VIDEO_FRAME_MS });
      return await resizeToJpeg(frame.uri);
    }
    return await resizeToJpeg(input.localUri);
  } catch (error) {
    console.warn('[thumbnailService] thumbnail generation failed', {
      mimeType: input.mimeType,
      error,
    });
    return null;
  }
}
