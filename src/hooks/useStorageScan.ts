import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { scanStorage, type StorageBreakdown } from '../services/storageService';

export const STORAGE_SCAN_QUERY_KEY = ['storageScan'] as const;

const FIVE_MINUTES = 5 * 60_000;

/**
 * Shared cache for the cacheDirectory scan, so the Settings "On-device storage"
 * row and the Storage screen reuse one result. The scan walks the filesystem, so
 * it's deliberately not refetched on focus or on a short stale window — the
 * Storage screen refetches explicitly after a free-up (invalidate this key).
 */
export function useStorageScan(enabled = true): UseQueryResult<StorageBreakdown, Error> {
  return useQuery<StorageBreakdown, Error>({
    queryKey: STORAGE_SCAN_QUERY_KEY,
    queryFn: scanStorage,
    enabled,
    staleTime: FIVE_MINUTES,
    refetchOnWindowFocus: false,
  });
}
