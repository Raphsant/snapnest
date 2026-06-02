import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { uploadVideoFromGallery } from '../services/uploadService';

type UseGalleryUploadResult = {
  pickAndUpload: () => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  lastUploadedFile: string | null;
};

function inferMimeTypeFromFilename(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

export function useGalleryUpload(): UseGalleryUploadResult {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const pickAndUpload = async (): Promise<void> => {
    try {
      setError(null);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access Needed',
          'SnapNest needs access to your photo library so you can upload videos and images.',
        );
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (pickerResult.canceled || pickerResult.assets.length === 0) {
        return;
      }

      const selectedAsset = pickerResult.assets[0];
      const fileUri = selectedAsset.uri;
      const fileName = selectedAsset.fileName ?? `upload-${Date.now()}`;
      const mimeType = selectedAsset.mimeType ?? inferMimeTypeFromFilename(fileName);
      const sizeBytes = selectedAsset.fileSize ?? 0;

      setIsUploading(true);
      setProgress(0);
      setLastUploadedFile(null);

      await uploadVideoFromGallery(fileUri, fileName, mimeType, sizeBytes, (pct: number) => {
        setProgress(pct);
      });

      setLastUploadedFile(fileName);
      setProgress(100);

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setLastUploadedFile(null);
      }, 2500);
    } catch (caughtError: unknown) {
      console.error('[GalleryUpload] Failed to pick and upload:', caughtError);
      const message = caughtError instanceof Error ? caughtError.message : 'Upload failed. Please try again.';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return {
    pickAndUpload,
    isUploading,
    progress,
    error,
    lastUploadedFile,
  };
}
