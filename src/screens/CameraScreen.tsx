import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Device from 'expo-device';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type FlashMode,
} from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { StatusBar } from 'expo-status-bar';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  Flashlight,
  FlashlightOff,
  Folder as FolderIcon,
  Grid3x3,
  RefreshCw,
  Timer as TimerIcon,
  VideoOff,
  Zap,
  ZapOff,
} from 'lucide-react-native';

import type { MainTabParamList } from '../navigation/mainTabTypes';
import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { PillButton } from '../components/ui/PillButton';
import { Toast } from '../components/ui/Toast';
import { CameraFlash } from '../components/CameraFlash';
import { RuleOfThirdsGrid, TimerCountdown } from '../components/CameraOverlays';
import { CaptureToast, type CaptureToastType } from '../components/CaptureToast';
import { DestinationPickerSheet } from '../components/DestinationPickerSheet';
import { PushPromptBanner, useUploadNotificationPrompt } from '../components/PushPromptBanner';
import { useFolders } from '../hooks/useFolders';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { enqueueUpload, subscribeUploadJobCreated } from '../services/uploadManager';
import { generateThumbnail } from '../services/thumbnailService';
import { useCameraStore } from '../store/cameraStore';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

type CaptureMode = 'photo' | 'video';
type ToastState = { message: string; type: CaptureToastType } | null;
type CaptureToastContent = { title: string; subtitle: string } | null;

const SHUTTER_SIZE = 82;
const SHUTTER_BORDER = 4;
const SHUTTER_INNER_IDLE = 66;
const SHUTTER_INNER_RECORDING = 30;
const isSimulator = !Device.isDevice;
/** Maps pinch delta (scale-1) onto the camera's normalized 0–1 zoom. Tune on device. */
const ZOOM_SENSITIVITY = 0.5;
/**
 * Normalized zoom that reads as roughly "2×". expo-camera's zoom is a 0–1
 * scalar over the single active lens, NOT an optical multiplier and NOT wide
 * enough to reach the ultrawide (.5×) lens — so this is an on-device-tuned
 * approximation, and there is deliberately no .5× preset.
 */
const ZOOM_2X = 0.04;
/** How long the capture toast stays up; the caller owns this timer. */
const CAPTURE_TOAST_MS = 2600;

/**
 * Fire-and-forget — queues the captured file for background upload.
 * Never awaited by the capture flow so the UI stays instant.
 *
 * Deliberately the FIRST thing a capture does. Everything in here is either
 * local and instant (a file stat) or handed off unawaited (the thumbnail), so
 * the presign — and with it the S3 PUT on its native background session — is
 * under way within about a second of the shutter. Lock the phone right after
 * capturing and the transfer is already the OS's problem, not the JS thread's.
 *
 * Resolves the item id + generated fileName once the item is actually on the
 * queue, or null if the file vanished / enqueue threw. The caller keys the
 * capture toast and the notification pre-prompt off a non-null result.
 */
async function queueCaptureUpload(
  uri: string,
  kind: 'photo' | 'video',
  folderId: string | null,
): Promise<{ id: string; fileName: string } | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return null;
    }
    const sizeBytes = typeof info.size === 'number' ? info.size : 0;
    const ext = kind === 'photo' ? 'jpg' : 'mp4';
    const mimeType = kind === 'photo' ? 'image/jpeg' : 'video/mp4';
    const fileName = `snapnest-${Date.now()}.${ext}`;

    // Started, NOT awaited: generation costs 1s+ for video and nothing about the
    // presign or the main PUT depends on it. uploadManager picks this promise up
    // only after the file transfer is already moving, and writes the result into
    // the queue item. Best-effort — null falls back to the server-side path.
    const thumbnailPromise = generateThumbnail({ localUri: uri, mimeType });

    // folderId null = system "Unfiled"; processItem omits it from POST /uploads.
    const id = enqueueUpload(
      {
        localUri: uri,
        fileName,
        mimeType,
        sizeBytes,
        source: 'camera',
        // Filled in by the promise above once generation finishes.
        thumbnailUri: null,
        folderId,
      },
      { thumbnailPromise },
    );
    return { id, fileName };
  } catch (error) {
    console.error('[CameraScreen] failed to enqueue upload', error);
    return null;
  }
}

export function CameraScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const cameraRef = useRef<CameraView | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const [mode, setMode] = useState<CaptureMode>('video');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [captureToast, setCaptureToast] = useState<CaptureToastContent>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  // Capability controls — component state only (no store backs this screen).
  const [photoFlash, setPhotoFlash] = useState<FlashMode>('off');
  const [torchOn, setTorchOn] = useState(false);
  // Front-camera selfie mirror. The toggle was dropped in the Organic redesign;
  // front captures stay mirrored (the long-standing default), back never mirrors.
  const [mirror] = useState(true);
  const [gridOn, setGridOn] = useState(false);
  const [timerDuration, setTimerDuration] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [zoom, setZoom] = useState(0);
  const baseZoomRef = useRef(0);
  // Mirrors the latest zoom so the stable gesture object can read it without a dep.
  const zoomRef = useRef(0);
  zoomRef.current = zoom;

  // Upload destination (personal folders). null = system "Unfiled" default.
  const destinationFolderId = useCameraStore((s) => s.destinationFolderId);
  const setDestinationFolder = useCameraStore((s) => s.setDestinationFolder);
  const foldersQuery = useFolders();
  const [destPickerVisible, setDestPickerVisible] = useState(false);

  // Upload queue — drives the status pill and the last-capture thumbnail.
  const queueItems = useUploadQueueStore((s) => s.items);

  // Shared upload/connectivity state — same derivation as the Folders/Uploads
  // SyncStatusCard, so the pill and the card can't disagree.
  const sync = useSyncStatus();
  // Mirror of online-ness for capture callbacks, which must read the current
  // value without being re-created when it changes.
  const isOnlineRef = useRef(true);
  useEffect(() => {
    isOnlineRef.current = !sync.isOffline;
  }, [sync.isOffline]);

  // One-time notification pre-prompt. Owns its own "already asked" bookkeeping
  // and permission check — this screen only tells it a capture was queued.
  const pushPrompt = useUploadNotificationPrompt();
  // Pulled out separately: the hook returns a fresh object each render, so
  // depending on `pushPrompt` would re-create every capture callback downstream.
  const { notifyCaptureQueued } = pushPrompt;

  // Capture id → generated fileName, for the toast fallback when the backend
  // sends no displayName. `toasted` dedupes so an offline pre-toast and the
  // later job-created event (or a retry re-emit) never double-fire.
  const enqueuedNamesRef = useRef<Map<string, string>>(new Map());
  const toastedIdsRef = useRef<Set<string>>(new Set());

  // If the selected folder is deleted (or otherwise vanishes from the list),
  // fall back to the Unfiled default so the chip and the upload target agree.
  const foldersData = foldersQuery.data;
  useEffect(() => {
    if (!foldersData || destinationFolderId === null) {
      return;
    }
    if (!foldersData.some((folder) => folder.id === destinationFolderId)) {
      setDestinationFolder(null);
    }
  }, [foldersData, destinationFolderId, setDestinationFolder]);

  const shutterScale = useRef(new Animated.Value(1)).current;
  const recordMorph = useRef(new Animated.Value(0)).current;
  const blinkOpacity = useRef(new Animated.Value(1)).current;
  const viewfinderOpacity = useRef(new Animated.Value(1)).current;

  const cameraMode = mode === 'video' ? 'video' : 'picture';
  const mediaDenied = mediaPermission != null && mediaPermission.granted === false;
  const showMediaWarning = showControlsFromPermissions(cameraPermission, microphonePermission) && mediaDenied;

  const openSettings = useCallback((): void => {
    void Linking.openSettings();
  }, []);

  const requestAllPermissions = useCallback(async (): Promise<void> => {
    await requestCameraPermission();
    await requestMicrophonePermission();
    await requestMediaPermission();
  }, [requestCameraPermission, requestMicrophonePermission, requestMediaPermission]);

  const flipCamera = useCallback((): void => {
    if (isRecording) {
      return;
    }
    // Front/back have different zoom ranges — reset so the flip isn't jarring.
    setZoom(0);
    baseZoomRef.current = 0;
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, [isRecording]);

  // Remount counter for the zoom catcher — see renderPreviewLayer for why it
  // exists. Bumped on the rising edge of focus only: remounting while blurred
  // would re-attach against a view that isn't in the hierarchy yet, and the
  // native side gives up silently after 25 retries.
  const isFocused = useIsFocused();
  const wasFocusedRef = useRef(isFocused);
  const [gestureEpoch, setGestureEpoch] = useState(0);
  useEffect(() => {
    if (isFocused && !wasFocusedRef.current) {
      setGestureEpoch((prev) => prev + 1);
    }
    wasFocusedRef.current = isFocused;
  }, [isFocused]);

  // Modern Gesture API (not the classic PinchGestureHandler). The recognizer is
  // attached to the zoom catcher in renderPreviewLayer, not to the viewfinder —
  // see the comment there. .runOnJS keeps the callbacks on the JS thread (no
  // reanimated dependency needed).
  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onBegin(() => {
          // Capture the zoom level at gesture start so deltas accumulate from there.
          baseZoomRef.current = zoomRef.current;
        })
        .onUpdate((event) => {
          const next = baseZoomRef.current + (event.scale - 1) * ZOOM_SENSITIVITY;
          setZoom(Math.min(1, Math.max(0, next)));
        }),
    [],
  );

  /** Jump to a preset zoom, keeping the pinch base in sync so a later pinch accumulates from here. */
  const setZoomPreset = useCallback((value: number): void => {
    setZoom(value);
    baseZoomRef.current = value;
  }, []);
  // Which preset pill reads as active. Midpoint split so a pinch lands on the nearest.
  const zoomIsTele = zoom >= ZOOM_2X / 2;

  /** One control: cycles photo flash (off→auto→on) or toggles the video torch. */
  const cycleFlashOrTorch = useCallback((): void => {
    if (mode === 'photo') {
      setPhotoFlash((prev) => (prev === 'off' ? 'auto' : prev === 'auto' ? 'on' : 'off'));
      return;
    }
    setTorchOn((prev) => !prev);
  }, [mode]);

  const cycleTimer = useCallback((): void => {
    setTimerDuration((prev) => (prev === 0 ? 3 : prev === 3 ? 10 : 0));
  }, []);

  const toggleGrid = useCallback((): void => {
    setGridOn((prev) => !prev);
  }, []);

  const goToUploads = useCallback((): void => {
    navigation.navigate('Activity');
  }, [navigation]);

  const cameraGranted = cameraPermission?.granted === true;
  const micGranted = microphonePermission?.granted === true;

  const showDenied =
    !isSimulator &&
    cameraPermission &&
    !cameraPermission.granted &&
    cameraPermission.canAskAgain === false;

  /** Show shutter row on simulator (UI dev) or when hardware permissions are granted */
  const showControls = showControlsFromPermissions(cameraPermission, microphonePermission);

  const topRowTop = insets.top;
  const controlColumnTop = insets.top + 54;
  /** Reserve space above the floating tab bar (≈90) + breathing room for the cluster. */
  const bottomChromePadding = insets.bottom + 116;
  /** Clears the shutter row so the prompt never covers it. */
  const promptBottomOffset = bottomChromePadding + 196;

  const recordingTimeLabel = useMemo(() => {
    const minutes = Math.floor(recordingDuration / 60);
    const seconds = recordingDuration % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [recordingDuration]);

  const flashActive = mode === 'video' ? torchOn : photoFlash !== 'off';
  const flashAutoBadge = mode === 'photo' && photoFlash === 'auto';
  // Lucide component for the flash/torch control, chosen by mode + state.
  const FlashGlyph = mode === 'video'
    ? torchOn ? Flashlight : FlashlightOff
    : photoFlash === 'off' ? ZapOff : Zap;

  // Chip label: selected folder's name, defaulting to the system folder ("Unfiled").
  const destinationLabel = useMemo((): string => {
    const folders = foldersQuery.data ?? [];
    if (destinationFolderId === null) {
      return folders.find((folder) => folder.isSystem)?.name ?? 'Unfiled';
    }
    return folders.find((folder) => folder.id === destinationFolderId)?.name ?? 'Unfiled';
  }, [foldersQuery.data, destinationFolderId]);

  // Status pill: formats the shared sync state. offline > waiting > uploading% > ok.
  const statusPill = useMemo((): { dot: string; label: string } => {
    switch (sync.kind) {
      case 'offline':
        return { dot: theme.colors.warn, label: 'Offline' };
      case 'waiting':
        return { dot: theme.colors.warn, label: `${sync.pendingCount} waiting` };
      case 'uploading':
        return { dot: theme.colors.accent, label: `${sync.progress}%` };
      default:
        return { dot: theme.colors.ok, label: 'Backed up' };
    }
  }, [sync, theme]);

  // Newest queue item drives the thumbnail button (its thumb + upload progress).
  const latestItem = useMemo(() => {
    if (queueItems.length === 0) {
      return undefined;
    }
    return queueItems.reduce((newest, item) => (item.createdAt > newest.createdAt ? item : newest));
  }, [queueItems]);
  const latestThumbnailUri = latestItem?.thumbnailUri ?? null;
  const latestUploadingPct =
    latestItem && latestItem.status === 'uploading' ? latestItem.progress : null;

  const showErrorToast = useCallback((message: string): void => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({ message, type: 'error' });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 1500);
  }, []);

  /** Capture confirmation pill (Phase 1 Toast). Caller-owned auto-dismiss. */
  const showCaptureToast = useCallback((name: string, online: boolean): void => {
    if (captureToastTimeoutRef.current) {
      clearTimeout(captureToastTimeoutRef.current);
      captureToastTimeoutRef.current = null;
    }
    setCaptureToast({
      title: `${name} saved`,
      subtitle: online ? 'Uploading now' : "Saved on device · will upload when you're back online",
    });
    captureToastTimeoutRef.current = setTimeout(() => {
      setCaptureToast(null);
      captureToastTimeoutRef.current = null;
    }, CAPTURE_TOAST_MS);
  }, []);

  // Job-created events carry the backend displayName. Toast only for captures
  // this screen enqueued, and only once per item.
  useEffect(() => {
    const unsubscribe = subscribeUploadJobCreated((event) => {
      const fallback = enqueuedNamesRef.current.get(event.id);
      if (fallback === undefined || toastedIdsRef.current.has(event.id)) {
        return;
      }
      toastedIdsRef.current.add(event.id);
      showCaptureToast(event.displayName ?? fallback, isOnlineRef.current);
    });
    return unsubscribe;
  }, [showCaptureToast]);

  const animateRecordShape = useCallback((toValue: 0 | 1): void => {
    Animated.timing(recordMorph, {
      toValue,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [recordMorph]);

  useEffect(() => {
    if (!isRecording) {
      blinkOpacity.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkOpacity, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.timing(blinkOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
      blinkOpacity.setValue(1);
    };
  }, [blinkOpacity, isRecording]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (captureToastTimeoutRef.current) {
        clearTimeout(captureToastTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const runPhotoTapPulse = useCallback((): void => {
    // 100ms total pulse gives immediate shutter feedback for still captures.
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: 0.92, duration: 50, useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shutterScale]);

  const saveCapture = useCallback(
    async (uri: string): Promise<boolean> => {
      let hasPermission = mediaPermission?.granted === true;
      if (!hasPermission) {
        try {
          const result = await requestMediaPermission();
          hasPermission = result.granted === true;
        } catch (error) {
          console.error('Failed requesting media library permission', error);
          showErrorToast("Couldn't save");
          return false;
        }
      }

      if (!hasPermission) {
        showErrorToast("Couldn't save");
        return false;
      }

      try {
        await MediaLibrary.saveToLibraryAsync(uri);
        // Success is signalled by the capture toast, not a second library toast.
        return true;
      } catch (error) {
        console.error('Failed saving capture to media library', error);
        showErrorToast("Couldn't save");
        return false;
      }
    },
    [mediaPermission?.granted, requestMediaPermission, showErrorToast]
  );

  /**
   * Records a freshly-queued capture: bumps the session counter, lets the
   * pre-prompt decide about notifications, and — if we're offline — shows the
   * "saved on device" toast immediately, since no job-created event will arrive
   * to trigger it while there's no connection.
   */
  const handleQueued = useCallback(
    (result: { id: string; fileName: string } | null): void => {
      if (!result) {
        return;
      }
      enqueuedNamesRef.current.set(result.id, result.fileName);
      setSessionCount((prev) => prev + 1);
      notifyCaptureQueued();

      if (!isOnlineRef.current && !toastedIdsRef.current.has(result.id)) {
        toastedIdsRef.current.add(result.id);
        showCaptureToast(result.fileName, false);
      }
    },
    [notifyCaptureQueued, showCaptureToast],
  );

  /**
   * Queues the capture and hands the result to handleQueued.
   *
   * The destination is read live rather than closed over: a self-timer
   * countdown can fire long after capture was requested, and the closure value
   * would be stale.
   */
  const queueCapture = useCallback(
    (uri: string, kind: CaptureMode): void => {
      void queueCaptureUpload(uri, kind, useCameraStore.getState().destinationFolderId).then(
        handleQueued,
      );
    },
    [handleQueued],
  );

  const handlePhotoCapture = useCallback(async (): Promise<void> => {
    if (isCapturingPhoto) {
      return;
    }

    if (!cameraRef.current) {
      showErrorToast("Couldn't save");
      return;
    }

    setIsCapturingPhoto(true);
    runPhotoTapPulse();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, exif: false });
      if (!photo?.uri) {
        showErrorToast("Couldn't save");
        return;
      }

      setShowFlash(true);
      // Upload first, and unconditionally. The camera-roll save is a separate
      // best-effort concern that must never gate the upload (denying photo
      // library access used to silently kill uploads outright) and must never
      // delay it either — saveCapture can sit on a permission dialog for as
      // long as the user ignores it. Gated on the Settings preference, read live.
      queueCapture(photo.uri, 'photo');
      if (useCameraStore.getState().saveToPhotos) {
        void saveCapture(photo.uri);
      }
    } catch (error) {
      console.error('Photo capture failed', error);
      showErrorToast("Couldn't save");
    } finally {
      setIsCapturingPhoto(false);
    }
  }, [isCapturingPhoto, queueCapture, runPhotoTapPulse, saveCapture, showErrorToast]);

  const startVideoRecording = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || isRecording) {
      return;
    }

    setIsRecording(true);
    setRecordingDuration(0);
    animateRecordShape(1);

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (!video?.uri) {
        showErrorToast("Couldn't save");
        return;
      }
      // Upload first and unconditionally — same reasoning as the photo path.
      queueCapture(video.uri, 'video');
      if (useCameraStore.getState().saveToPhotos) {
        void saveCapture(video.uri);
      }
    } catch (error) {
      console.error('Video recording failed', error);
      showErrorToast("Couldn't save");
    } finally {
      setIsRecording(false);
      animateRecordShape(0);
    }
  }, [animateRecordShape, isRecording, queueCapture, saveCapture, showErrorToast]);

  const stopVideoRecording = useCallback((): void => {
    if (!cameraRef.current || !isRecording) {
      return;
    }

    try {
      cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Stopping video recording failed', error);
      showErrorToast("Couldn't save");
      setIsRecording(false);
      animateRecordShape(0);
    }
  }, [animateRecordShape, isRecording, showErrorToast]);

  /** Runs the actual capture for the current mode (photo shot / video start). */
  const fireCapture = useCallback((): void => {
    if (mode === 'photo') {
      void handlePhotoCapture();
      return;
    }
    void startVideoRecording();
  }, [handlePhotoCapture, mode, startVideoRecording]);

  const clearCountdown = useCallback((): void => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startCountdown = useCallback((): void => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    // `remaining` lives in the closure so the tick never reads stale state and
    // capture fires exactly once (no setState-updater side effects).
    let remaining: number = timerDuration;
    setCountdown(remaining);
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        fireCapture();
        return;
      }
      setCountdown(remaining);
    }, 1000);
  }, [fireCapture, timerDuration]);

  const handleCapturePress = useCallback((): void => {
    if (!showControls) {
      return;
    }

    // A tap while counting down cancels the timer.
    if (countdown !== null) {
      clearCountdown();
      return;
    }

    // Stopping a recording is never delayed by the timer.
    if (mode === 'video' && isRecording) {
      stopVideoRecording();
      return;
    }

    if (timerDuration > 0) {
      startCountdown();
      return;
    }

    fireCapture();
  }, [
    clearCountdown,
    countdown,
    fireCapture,
    isRecording,
    mode,
    showControls,
    startCountdown,
    stopVideoRecording,
    timerDuration,
  ]);

  const switchModeWithFade = useCallback(
    (nextMode: CaptureMode): void => {
      if (nextMode === mode || isRecording || isModeTransitioning) {
        return;
      }

      setIsModeTransitioning(true);
      Animated.timing(viewfinderOpacity, {
        toValue: 0.4,
        duration: 120,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          setIsModeTransitioning(false);
          return;
        }

        setMode(nextMode);
        Animated.timing(viewfinderOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          setIsModeTransitioning(false);
        });
      });
    },
    [isModeTransitioning, isRecording, mode, viewfinderOpacity]
  );

  const handleSwitchToPhoto = useCallback((): void => {
    switchModeWithFade('photo');
  }, [switchModeWithFade]);

  const handleSwitchToVideo = useCallback((): void => {
    switchModeWithFade('video');
  }, [switchModeWithFade]);

  const renderPermissionGate = (): React.ReactElement | null => {
    if (isSimulator) {
      return null;
    }

    if (showDenied) {
      return (
        <View style={styles.permissionCenter}>
          <Card style={styles.permissionCard}>
            <DisplayText size={22}>Camera access required</DisplayText>
            <Text style={styles.permissionBody}>
              Enable camera and microphone in Settings to record in SnapNest.
            </Text>
            <PillButton title="Open Settings" onPress={openSettings} />
          </Card>
        </View>
      );
    }

    if (cameraGranted && micGranted) {
      return null;
    }

    return (
      <View style={styles.permissionCenter}>
        <Card style={styles.permissionCard}>
          <DisplayText size={22}>Camera &amp; microphone</DisplayText>
          <Text style={styles.permissionBody}>
            SnapNest needs access to your camera and microphone to capture video.
          </Text>
          <PillButton
            title="Allow Access"
            onPress={() => {
              void requestAllPermissions();
            }}
          />
        </Card>
      </View>
    );
  };

  const renderPreviewLayer = (): React.ReactElement | null => {
    if (isSimulator) {
      return (
        <View style={styles.simulatorPlaceholder}>
          <VideoOff size={56} color={theme.colors.faintOnDark} strokeWidth={1.5} />
          <Text style={styles.simulatorText}>
            Camera unavailable in simulator — test on a real device
          </Text>
        </View>
      );
    }

    if (!cameraGranted || !micGranted) {
      return null;
    }

    return (
      <>
        <Animated.View collapsable={false} style={[styles.viewfinder, { opacity: viewfinderOpacity }]}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode={cameraMode}
            videoQuality="1080p"
            videoStabilizationMode="auto"
            flash={mode === 'photo' ? photoFlash : 'off'}
            enableTorch={mode === 'video' && torchOn}
            mirror={mirror}
            zoom={zoom}
          />
        </Animated.View>
        {/*
          The pinch target is deliberately OUTSIDE the camera subtree, and
          deliberately keyed. Do not fold it back into the viewfinder.

          GestureDetector attaches its native recognizer once, in a mount-only
          useLayoutEffect, and its only re-attach trigger is a changed view tag.
          A screen that stays mounted across a tab blur (the tab navigator sets
          detachInactiveScreens={false}) never changes its tag, so once the blur
          severs the native binding the recognizer is dead for good. Remounting
          is the only way to force a fresh attach — and remounting an empty view
          keeps CameraView alive, so the AVCaptureSession isn't cycled (and the
          preview doesn't black-flash) on every tab return.

          Second generation of this fix: the first (1e4b97f) swapped
          PinchGestureHandler for GestureDetector on the assumption that its ref
          callback would re-attach. It can't — the tag never changes.

          Render position matters: this must stay above the viewfinder and below
          every control, so it can't swallow their touches.
        */}
        <GestureDetector key={gestureEpoch} gesture={pinchGesture}>
          <View collapsable={false} style={styles.zoomCatcher} />
        </GestureDetector>
      </>
    );
  };

  const recordInnerSize = recordMorph.interpolate({
    inputRange: [0, 1],
    outputRange: [SHUTTER_INNER_IDLE, SHUTTER_INNER_RECORDING],
  });
  const recordInnerRadius = recordMorph.interpolate({
    inputRange: [0, 1],
    outputRange: [SHUTTER_INNER_IDLE / 2, 9],
  });
  const shutterInnerColor = mode === 'photo' ? theme.colors.card : theme.colors.danger;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {renderPreviewLayer()}
      {renderPermissionGate()}
      <CaptureToast
        visible={toast !== null}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'error'}
        topOffset={insets.top + 12}
      />

      {gridOn && showControls ? <RuleOfThirdsGrid /> : null}

      {showControls ? (
        <View style={[styles.topRow, { top: topRowTop }]} pointerEvents="box-none">
          <Pressable
            onPress={() => setDestPickerVisible(true)}
            disabled={isRecording}
            style={({ pressed }) => [
              styles.chip,
              isRecording && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Upload destination: ${destinationLabel}`}
            accessibilityHint="Opens the destination picker"
            accessibilityState={{ expanded: destPickerVisible }}
          >
            <FolderIcon size={15} color={theme.colors.white} strokeWidth={2.4} />
            <Text style={styles.chipText} numberOfLines={1}>
              {destinationLabel}
            </Text>
            <ChevronDown size={13} color={theme.colors.white} strokeWidth={2.4} />
          </Pressable>

          <View style={styles.topSpacer} />

          <Pressable
            onPress={goToUploads}
            style={({ pressed }) => [styles.statusPill, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Upload status: ${statusPill.label}`}
          >
            <View style={[styles.statusDot, { backgroundColor: statusPill.dot }]} />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusPill.label}
            </Text>
          </Pressable>

          <Pressable
            onPress={flipCamera}
            disabled={isRecording}
            style={({ pressed }) => [
              styles.flipButton,
              isRecording && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
          >
            <RefreshCw size={18} color={theme.colors.white} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}

      {showControls ? (
        <View style={[styles.controlColumn, { top: controlColumnTop }]} pointerEvents="box-none">
          <Pressable
            onPress={cycleFlashOrTorch}
            style={({ pressed }) => [
              styles.controlButton,
              flashActive && styles.controlButtonActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={mode === 'video' ? 'Toggle torch' : 'Cycle flash mode'}
          >
            <FlashGlyph
              size={22}
              color={flashActive ? theme.colors.accentDeep : theme.colors.white}
              strokeWidth={2.2}
            />
            {flashAutoBadge ? <Text style={styles.controlBadge}>A</Text> : null}
          </Pressable>

          <Pressable
            onPress={cycleTimer}
            style={({ pressed }) => [
              styles.controlButton,
              timerDuration > 0 && styles.controlButtonActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cycle self-timer"
          >
            {timerDuration === 0 ? (
              <TimerIcon size={22} color={theme.colors.white} strokeWidth={2.2} />
            ) : (
              <Text style={styles.controlText}>{timerDuration}s</Text>
            )}
          </Pressable>

          <Pressable
            onPress={toggleGrid}
            style={({ pressed }) => [
              styles.controlButton,
              gridOn && styles.controlButtonActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Toggle grid"
          >
            <Grid3x3
              size={22}
              color={gridOn ? theme.colors.accentDeep : theme.colors.white}
              strokeWidth={2.2}
            />
          </Pressable>
        </View>
      ) : null}

      {showControls && isRecording ? (
        <View style={[styles.recordingPill, { top: controlColumnTop }]} pointerEvents="none">
          <Animated.View style={[styles.recordingDot, { opacity: blinkOpacity }]} />
          <Text style={styles.recordingText}>{recordingTimeLabel}</Text>
        </View>
      ) : null}

      {showControls ? (
        <View style={[styles.bottomCluster, { bottom: bottomChromePadding }]} pointerEvents="box-none">
          {showMediaWarning ? (
            <Pressable onPress={openSettings} style={styles.mediaWarningPill} accessibilityRole="button">
              <Text style={styles.mediaWarningText}>
                Captures won&apos;t be saved to your camera roll. Tap to fix.
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.zoomRow}>
            <Pressable
              onPress={() => setZoomPreset(0)}
              style={[styles.zoomPill, !zoomIsTele ? styles.zoomPillActive : styles.zoomPillInactive]}
              accessibilityRole="button"
              accessibilityLabel="Zoom 1x"
              accessibilityState={{ selected: !zoomIsTele }}
            >
              <Text style={!zoomIsTele ? styles.zoomTextActive : styles.zoomTextInactive}>1×</Text>
            </Pressable>
            <Pressable
              onPress={() => setZoomPreset(ZOOM_2X)}
              style={[styles.zoomPill, zoomIsTele ? styles.zoomPillActive : styles.zoomPillInactive]}
              accessibilityRole="button"
              accessibilityLabel="Zoom 2x"
              accessibilityState={{ selected: zoomIsTele }}
            >
              <Text style={zoomIsTele ? styles.zoomTextActive : styles.zoomTextInactive}>2×</Text>
            </Pressable>
          </View>

          <View style={styles.modeTrack}>
            <Pressable
              disabled={isRecording || isModeTransitioning}
              onPress={handleSwitchToPhoto}
              style={[styles.modeSeg, mode === 'photo' && styles.modeSegActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'photo' }}
            >
              <Text style={mode === 'photo' ? styles.modeTextActive : styles.modeTextInactive}>
                PHOTO
              </Text>
            </Pressable>
            <Pressable
              disabled={isRecording || isModeTransitioning}
              onPress={handleSwitchToVideo}
              style={[styles.modeSeg, mode === 'video' && styles.modeSegActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'video' }}
            >
              <Text style={mode === 'video' ? styles.modeTextActive : styles.modeTextInactive}>
                VIDEO
              </Text>
            </Pressable>
          </View>

          <View style={styles.shutterRow}>
            <View style={styles.sideSlot}>
              <Pressable
                onPress={goToUploads}
                style={styles.thumbButton}
                accessibilityRole="button"
                accessibilityLabel="View recent uploads"
              >
                {latestThumbnailUri ? (
                  <Image source={{ uri: latestThumbnailUri }} style={styles.thumbImage} contentFit="cover" />
                ) : (
                  <View style={styles.thumbEmpty} />
                )}
                {latestUploadingPct !== null ? (
                  <View style={styles.thumbOverlay}>
                    <View style={styles.thumbScrim} />
                    <Text style={styles.thumbPct}>{latestUploadingPct}%</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>

            <Pressable
              onPress={handleCapturePress}
              disabled={isCapturingPhoto}
              style={({ pressed }) => [styles.shutterOuter, pressed && !isRecording && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Capture"
            >
              <Animated.View style={[styles.shutterAnimated, { transform: [{ scale: shutterScale }] }]}>
                <Animated.View
                  style={{
                    width: recordInnerSize,
                    height: recordInnerSize,
                    borderRadius: recordInnerRadius,
                    backgroundColor: shutterInnerColor,
                  }}
                />
              </Animated.View>
            </Pressable>

            <View style={styles.sideSlot}>
              {sessionCount > 0 ? (
                <Text style={styles.sessionText} numberOfLines={2}>
                  {sessionCount} this session
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {countdown !== null ? <TimerCountdown seconds={countdown} /> : null}

      <PushPromptBanner
        visible={pushPrompt.visible}
        onEnable={pushPrompt.onEnable}
        onDismiss={pushPrompt.onDismiss}
        bottomOffset={promptBottomOffset}
      />

      {captureToast ? <Toast title={captureToast.title} subtitle={captureToast.subtitle} /> : null}

      <DestinationPickerSheet
        visible={destPickerVisible}
        selectedFolderId={destinationFolderId}
        onSelect={setDestinationFolder}
        onClose={() => setDestPickerVisible(false)}
      />
      <CameraFlash visible={showFlash} onComplete={() => setShowFlash(false)} />
    </View>
  );
}

function showControlsFromPermissions(
  cameraPermission: ReturnType<typeof useCameraPermissions>[0],
  microphonePermission: ReturnType<typeof useMicrophonePermissions>[0]
): boolean {
  const cameraGranted = cameraPermission?.granted === true;
  const micGranted = microphonePermission?.granted === true;
  return isSimulator || (cameraGranted && micGranted);
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.darkBg,
  },
  viewfinder: {
    ...StyleSheet.absoluteFillObject,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Transparent pinch target above the camera, pinned under every control. */
  zoomCatcher: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  simulatorPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.darkBg,
    paddingHorizontal: 24,
    gap: 12,
  },
  simulatorText: {
    fontFamily: theme.typography.body[400],
    fontSize: 15,
    color: theme.colors.faintOnDark,
    textAlign: 'center',
  },
  permissionCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: theme.colors.darkBg,
  },
  permissionCard: {
    padding: 20,
    gap: 12,
  },
  permissionBody: {
    fontFamily: theme.typography.body[400],
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.4,
  },

  // Top row -------------------------------------------------------------------
  topRow: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  topSpacer: {
    flex: 1,
  },
  chip: {
    height: 38,
    maxWidth: '58%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.darkGlass,
    borderWidth: 1,
    borderColor: theme.colors.lineOnDark,
  },
  chipText: {
    flexShrink: 1,
    maxWidth: 190,
    fontFamily: theme.typography.body[600],
    fontSize: 13,
    color: theme.colors.white,
  },
  statusPill: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.darkGlass,
    borderWidth: 1,
    borderColor: theme.colors.lineOnDark,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
  },
  statusText: {
    fontFamily: theme.typography.body[600],
    fontSize: 13,
    color: theme.colors.white,
    fontVariant: ['tabular-nums'],
  },
  flipButton: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.darkGlass,
    borderWidth: 1,
    borderColor: theme.colors.lineOnDark,
  },

  // Right control column ------------------------------------------------------
  controlColumn: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 9,
    zIndex: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.darkGlass,
    borderWidth: 1,
    borderColor: theme.colors.lineOnDark,
  },
  controlButtonActive: {
    backgroundColor: theme.colors.glass,
    borderColor: theme.colors.glass,
  },
  controlText: {
    fontFamily: theme.typography.body[700],
    fontSize: 12,
    color: theme.colors.accentDeep,
    fontVariant: ['tabular-nums'],
  },
  controlBadge: {
    position: 'absolute',
    bottom: 4,
    right: 7,
    fontFamily: theme.typography.body[800],
    fontSize: 10,
    color: theme.colors.accentDeep,
  },

  // Recording pill ------------------------------------------------------------
  recordingPill: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
  },
  recordingText: {
    fontFamily: theme.typography.body[700],
    fontSize: 13,
    color: theme.colors.white,
    fontVariant: ['tabular-nums'],
  },

  // Bottom cluster ------------------------------------------------------------
  bottomCluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
    zIndex: 20,
  },
  mediaWarningPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.darkGlass,
    borderWidth: 1,
    borderColor: theme.colors.lineOnDark,
  },
  mediaWarningText: {
    fontFamily: theme.typography.body[600],
    fontSize: 12.5,
    color: theme.colors.white,
    textAlign: 'center',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoomPill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomPillActive: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card,
  },
  zoomPillInactive: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.darkGlass,
  },
  zoomTextActive: {
    fontFamily: theme.typography.body[700],
    fontSize: 13,
    color: theme.colors.text,
  },
  zoomTextInactive: {
    fontFamily: theme.typography.body[600],
    fontSize: 12,
    color: theme.colors.white,
  },
  modeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.darkGlass,
  },
  modeSeg: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  modeSegActive: {
    backgroundColor: theme.colors.card,
  },
  modeTextActive: {
    fontFamily: theme.typography.body[700],
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: theme.colors.text,
  },
  modeTextInactive: {
    fontFamily: theme.typography.body[700],
    fontSize: 11.5,
    letterSpacing: 0.9,
    color: theme.colors.white,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  sideSlot: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.faintOnDark,
    backgroundColor: theme.colors.darkSurface,
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbEmpty: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.darkSurface,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.darkBg,
    opacity: 0.5,
  },
  thumbPct: {
    fontFamily: theme.typography.body[700],
    fontSize: 12,
    color: theme.colors.white,
    fontVariant: ['tabular-nums'],
  },
  shutterOuter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: SHUTTER_BORDER,
    borderColor: theme.colors.strongOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterAnimated: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionText: {
    fontFamily: theme.typography.body[600],
    fontSize: 10.5,
    color: theme.colors.faintOnDark,
    textAlign: 'center',
  },
}));
