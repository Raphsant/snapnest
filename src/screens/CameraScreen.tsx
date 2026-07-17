import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Device from 'expo-device';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type FlashMode,
} from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import {
  PinchGestureHandler,
  State,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../navigation/mainTabTypes';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { CameraFlash } from '../components/CameraFlash';
import { RuleOfThirdsGrid, TimerCountdown } from '../components/CameraOverlays';
import { CaptureToast, type CaptureToastType } from '../components/CaptureToast';
import { enqueueUpload } from '../services/uploadManager';
import { generateThumbnail } from '../services/thumbnailService';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type CaptureMode = 'photo' | 'video';
type ToastState = { message: string; type: CaptureToastType } | null;

const SHUTTER_SIZE = 80;
const INNER_RING_WIDTH = 3;
const isSimulator = !Device.isDevice;
/** Maps pinch delta (scale-1) onto the camera's normalized 0–1 zoom. Tune on device. */
const ZOOM_SENSITIVITY = 0.5;

/**
 * Fire-and-forget — queues the captured file for background upload.
 * Never awaited by the capture flow so the UI stays instant.
 */
async function queueCaptureUpload(uri: string, kind: 'photo' | 'video'): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return;
    }
    const sizeBytes = typeof info.size === 'number' ? info.size : 0;
    const ext = kind === 'photo' ? 'jpg' : 'mp4';
    const mimeType = kind === 'photo' ? 'image/jpeg' : 'video/mp4';
    const fileName = `snapnest-${Date.now()}.${ext}`;

    // Best-effort local thumbnail; null on failure falls back to the server-side path.
    const thumbnailUri = await generateThumbnail({ localUri: uri, mimeType });

    enqueueUpload({
      localUri: uri,
      fileName,
      mimeType,
      sizeBytes,
      source: 'camera',
      thumbnailUri,
    });
  } catch (error) {
    console.error('[CameraScreen] failed to enqueue upload', error);
  }
}

export function CameraScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const firstName = useAuthStore((s) => s.user?.firstName);
  const displayName = firstName?.trim() ? firstName.trim() : 'there';
  const cameraRef = useRef<CameraView | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);

  // Capability controls — component state only (no store backs this screen).
  const [photoFlash, setPhotoFlash] = useState<FlashMode>('off');
  const [torchOn, setTorchOn] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [gridOn, setGridOn] = useState(false);
  const [timerDuration, setTimerDuration] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [zoom, setZoom] = useState(0);
  const baseZoomRef = useRef(0);

  const shutterScale = useRef(new Animated.Value(1)).current;
  const recordMorph = useRef(new Animated.Value(0)).current;
  const blinkOpacity = useRef(new Animated.Value(1)).current;
  const viewfinderOpacity = useRef(new Animated.Value(1)).current;

  const cameraMode = mode === 'video' ? 'video' : 'picture';
  const canSaveToLibrary = mediaPermission?.granted === true;
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

  const onPinchGesture = useCallback((event: PinchGestureHandlerGestureEvent): void => {
    const next = baseZoomRef.current + (event.nativeEvent.scale - 1) * ZOOM_SENSITIVITY;
    setZoom(Math.min(1, Math.max(0, next)));
  }, []);

  const onPinchStateChange = useCallback((event: PinchGestureHandlerStateChangeEvent): void => {
    // Capture the zoom level at gesture start so deltas accumulate from there.
    if (event.nativeEvent.state === State.BEGAN) {
      baseZoomRef.current = zoom;
    }
  }, [zoom]);

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

  const toggleMirror = useCallback((): void => {
    setMirror((prev) => !prev);
  }, []);

  const goToSettingsTab = useCallback((): void => {
    navigation.navigate('Settings');
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

  /** Reserve space above the floating tab bar (≈104px bar+fab) + 100px breathing room */
  const bottomChromePadding = insets.bottom + 116;
  const toastTopOffset = insets.top + spacing.lg;
  const controlColumnTop = insets.top + 96;

  const recordingTimeLabel = useMemo(() => {
    const minutes = Math.floor(recordingDuration / 60);
    const seconds = recordingDuration % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [recordingDuration]);

  // Flash control reflects both mode (flash vs torch) and current state.
  const flashIconName = useMemo<React.ComponentProps<typeof Ionicons>['name']>(() => {
    if (mode === 'video') {
      return torchOn ? 'flashlight' : 'flashlight-outline';
    }
    return photoFlash === 'on' ? 'flash' : photoFlash === 'auto' ? 'flash-outline' : 'flash-off-outline';
  }, [mode, photoFlash, torchOn]);

  const flashActive = mode === 'video' ? torchOn : photoFlash !== 'off';
  const flashAutoBadge = mode === 'photo' && photoFlash === 'auto';

  const showToast = useCallback((message: string, type: CaptureToastType): void => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 1500);
  }, []);

  const animateRecordShape = useCallback((toValue: 0 | 1): void => {
    Animated.timing(recordMorph, {
      toValue,
      duration: 200,
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
        Animated.timing(blinkOpacity, { toValue: 0.25, duration: 450, useNativeDriver: true }),
        Animated.timing(blinkOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
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
          showToast("Couldn't save", 'error');
          return false;
        }
      }

      if (!hasPermission) {
        showToast("Couldn't save", 'error');
        return false;
      }

      try {
        await MediaLibrary.saveToLibraryAsync(uri);
        showToast('Saved', 'success');
        return true;
      } catch (error) {
        console.error('Failed saving capture to media library', error);
        showToast("Couldn't save", 'error');
        return false;
      }
    },
    [mediaPermission?.granted, requestMediaPermission, showToast]
  );

  const handlePhotoCapture = useCallback(async (): Promise<void> => {
    if (isCapturingPhoto) {
      return;
    }

    if (!cameraRef.current) {
      showToast("Couldn't save", 'error');
      return;
    }

    setIsCapturingPhoto(true);
    runPhotoTapPulse();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, exif: false });
      if (!photo?.uri) {
        showToast("Couldn't save", 'error');
        return;
      }

      setShowFlash(true);
      const saved = await saveCapture(photo.uri);
      if (saved) {
        void queueCaptureUpload(photo.uri, 'photo');
      }
    } catch (error) {
      console.error('Photo capture failed', error);
      showToast("Couldn't save", 'error');
    } finally {
      setIsCapturingPhoto(false);
    }
  }, [isCapturingPhoto, runPhotoTapPulse, saveCapture, showToast]);

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
        showToast("Couldn't save", 'error');
        return;
      }
      const saved = await saveCapture(video.uri);
      if (saved) {
        void queueCaptureUpload(video.uri, 'video');
      }
    } catch (error) {
      console.error('Video recording failed', error);
      showToast("Couldn't save", 'error');
    } finally {
      setIsRecording(false);
      animateRecordShape(0);
    }
  }, [animateRecordShape, isRecording, saveCapture, showToast]);

  const stopVideoRecording = useCallback((): void => {
    if (!cameraRef.current || !isRecording) {
      return;
    }

    try {
      cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Stopping video recording failed', error);
      showToast("Couldn't save", 'error');
      setIsRecording(false);
      animateRecordShape(0);
    }
  }, [animateRecordShape, isRecording, showToast]);

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
          <GlassCard intensity={76}>
            <Text style={styles.permissionTitle}>Camera access required</Text>
            <Text style={styles.permissionBody}>
              Enable camera and microphone in Settings to record in SnapNest.
            </Text>
            <PrimaryButton label="Open Settings" onPress={openSettings} />
          </GlassCard>
        </View>
      );
    }

    if (cameraGranted && micGranted) {
      return null;
    }

    return (
      <View style={styles.permissionCenter}>
        <GlassCard intensity={76}>
          <Text style={styles.permissionTitle}>Camera & microphone</Text>
          <Text style={styles.permissionBody}>
            SnapNest needs access to your camera and microphone to capture video.
          </Text>
          <PrimaryButton
            label="Allow Access"
            onPress={() => {
              void requestAllPermissions();
            }}
          />
        </GlassCard>
      </View>
    );
  };

  const renderPreviewLayer = (): React.ReactElement | null => {
    if (isSimulator) {
      return (
        <View style={styles.simulatorPlaceholder}>
          <Ionicons name="videocam-outline" size={56} color={colors.tabInactive} style={styles.simulatorIcon} />
          <Text style={styles.simulatorText}>Camera unavailable in simulator — test on a real device</Text>
        </View>
      );
    }

    if (!cameraGranted || !micGranted) {
      return null;
    }

    return (
      <PinchGestureHandler onGestureEvent={onPinchGesture} onHandlerStateChange={onPinchStateChange}>
        <Animated.View style={[styles.viewfinder, { opacity: viewfinderOpacity }]}>
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
      </PinchGestureHandler>
    );
  };

  const recordInnerSize = recordMorph.interpolate({
    inputRange: [0, 1],
    outputRange: [SHUTTER_SIZE - 32, 24],
  });
  const recordInnerRadius = recordMorph.interpolate({
    inputRange: [0, 1],
    outputRange: [(SHUTTER_SIZE - 32) / 2, 6],
  });
  const recordInnerScale = recordMorph.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.98],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {renderPreviewLayer()}
      {renderPermissionGate()}
      <CaptureToast
        visible={toast !== null}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        topOffset={toastTopOffset}
      />

      {gridOn && showControls ? <RuleOfThirdsGrid /> : null}

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.greetingPill}>
            <Text style={styles.greetingText}>Hi, {displayName}</Text>
          </View>
          <View style={styles.topIcons}>
            <Pressable
              onPress={flipCamera}
              disabled={isRecording}
              style={({ pressed }) => [
                styles.iconHit,
                isRecording && styles.iconDisabled,
                pressed && styles.iconPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <Ionicons name="camera-reverse-outline" size={24} color={colors.card} />
            </Pressable>
            <Pressable
              onPress={goToSettingsTab}
              style={({ pressed }) => [styles.iconHit, pressed && styles.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings-outline" size={24} color={colors.card} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {showControls ? (
        <View style={[styles.controlColumn, { top: controlColumnTop }]} pointerEvents="box-none">
          <Pressable
            onPress={cycleFlashOrTorch}
            style={({ pressed }) => [
              styles.controlButton,
              flashActive && styles.controlButtonActive,
              pressed && styles.iconPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={mode === 'video' ? 'Toggle torch' : 'Cycle flash mode'}
          >
            <Ionicons
              name={flashIconName}
              size={22}
              color={flashActive ? colors.accentBlue : colors.card}
            />
            {flashAutoBadge ? <Text style={styles.controlBadge}>A</Text> : null}
          </Pressable>

          <Pressable
            onPress={cycleTimer}
            style={({ pressed }) => [
              styles.controlButton,
              timerDuration > 0 && styles.controlButtonActive,
              pressed && styles.iconPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cycle self-timer"
          >
            <Ionicons
              name="timer-outline"
              size={22}
              color={timerDuration > 0 ? colors.accentBlue : colors.card}
            />
            {timerDuration > 0 ? <Text style={styles.controlBadge}>{timerDuration}</Text> : null}
          </Pressable>

          <Pressable
            onPress={toggleGrid}
            style={({ pressed }) => [
              styles.controlButton,
              gridOn && styles.controlButtonActive,
              pressed && styles.iconPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Toggle grid"
          >
            <Ionicons name="grid-outline" size={22} color={gridOn ? colors.accentBlue : colors.card} />
          </Pressable>

          {facing === 'front' ? (
            <Pressable
              onPress={toggleMirror}
              style={({ pressed }) => [
                styles.controlButton,
                mirror && styles.controlButtonActive,
                pressed && styles.iconPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle front-camera mirror"
            >
              <Ionicons
                name="swap-horizontal"
                size={22}
                color={mirror ? colors.accentBlue : colors.card}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showControls ? (
        <View style={[styles.bottomControls, { paddingBottom: bottomChromePadding }]} pointerEvents="box-none">
          {showMediaWarning ? (
            <Pressable onPress={openSettings} style={styles.mediaWarningPill} accessibilityRole="button">
              <Text style={styles.mediaWarningText}>Captures won&apos;t be saved to your camera roll. Tap to fix.</Text>
            </Pressable>
          ) : null}

          {isRecording ? (
            <View style={styles.recordingHud} pointerEvents="none">
              <Animated.View style={[styles.recordingDot, { opacity: blinkOpacity }]} />
              <Text style={styles.recordingText}>{recordingTimeLabel}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleCapturePress}
            disabled={isCapturingPhoto}
            style={({ pressed }) => [styles.shutterOuter, pressed && !isRecording && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel="Capture"
          >
            <Animated.View style={[styles.shutterAnimated, { transform: [{ scale: shutterScale }] }]}>
              <View style={styles.shutterInnerRing}>
                <Animated.View
                  style={[
                    styles.shutterInnerCore,
                    {
                      width: recordInnerSize,
                      height: recordInnerSize,
                      borderRadius: recordInnerRadius,
                      backgroundColor: isRecording ? colors.error : colors.card,
                      transform: [{ scale: recordInnerScale }],
                    },
                  ]}
                />
              </View>
            </Animated.View>
          </Pressable>

          <View style={styles.modeRow}>
            <Pressable
              disabled={isRecording || isModeTransitioning}
              onPress={handleSwitchToPhoto}
              style={[
                styles.modePill,
                mode === 'photo' ? styles.modePillActive : styles.modePillInactive,
                (isRecording || isModeTransitioning) && styles.modeDisabled,
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.modePillText, mode === 'photo' && styles.modePillTextActive]}>PHOTO</Text>
            </Pressable>
            <Pressable
              disabled={isRecording || isModeTransitioning}
              onPress={handleSwitchToVideo}
              style={[
                styles.modePill,
                mode === 'video' ? styles.modePillActive : styles.modePillInactive,
                (isRecording || isModeTransitioning) && styles.modeDisabled,
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.modePillText, mode === 'video' && styles.modePillTextActive]}>VIDEO</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {countdown !== null ? <TimerCountdown seconds={countdown} /> : null}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryNavy,
  },
  viewfinder: {
    ...StyleSheet.absoluteFillObject,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  simulatorPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryNavy,
    paddingHorizontal: spacing.xxl,
  },
  simulatorIcon: {
    opacity: 0.35,
    marginBottom: spacing.md,
  },
  simulatorText: {
    ...typography.body,
    color: colors.tabInactive,
    textAlign: 'center',
  },
  permissionCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.primaryNavy,
  },
  permissionTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
  },
  permissionBody: {
    ...typography.body,
    color: colors.mutedText,
    marginBottom: spacing.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  greetingPill: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    maxWidth: '70%',
  },
  greetingText: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '600',
  },
  topIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconHit: {
    padding: spacing.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  iconPressed: {
    opacity: 0.75,
  },
  iconDisabled: {
    opacity: 0.4,
  },
  controlColumn: {
    position: 'absolute',
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  controlBadge: {
    position: 'absolute',
    bottom: 3,
    right: 6,
    fontSize: 10,
    fontWeight: '800',
    color: colors.accentBlue,
    fontVariant: ['tabular-nums'],
  },
  recordingHud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    marginBottom: spacing.md,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  recordingText: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  mediaWarningPill: {
    marginBottom: spacing.md,
    backgroundColor: 'rgba(16,42,67,0.7)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 18,
  },
  mediaWarningText: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '600',
    textAlign: 'center',
  },
  /** White ring + inner disc — classic shutter affordance; recording wiring comes later */
  shutterOuter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  shutterAnimated: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerRing: {
    width: SHUTTER_SIZE - 16,
    height: SHUTTER_SIZE - 16,
    borderRadius: (SHUTTER_SIZE - 16) / 2,
    borderWidth: INNER_RING_WIDTH,
    borderColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerCore: {
    width: SHUTTER_SIZE - 32,
    height: SHUTTER_SIZE - 32,
    borderRadius: (SHUTTER_SIZE - 32) / 2,
    backgroundColor: colors.card,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modePill: {
    minWidth: 92,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: colors.card,
  },
  modePillInactive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  modeDisabled: {
    opacity: 0.5,
  },
  modePillText: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  modePillTextActive: {
    color: colors.accentBlue,
  },
});
