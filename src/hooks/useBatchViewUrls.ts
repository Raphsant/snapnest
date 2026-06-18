import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getBatchViewUrls,
  type BatchFileViewUrlItem,
} from '../services/filesService';

const FIFTY_FIVE_MINUTES = 55 * 60 * 1000;

export const batchViewUrlsQueryKey = (fileIds: string[]): readonly ['batchViewUrls', string] => {
  const key = [...fileIds].sort().join(',');
  return ['batchViewUrls', key] as const;
};

export type ViewUrlByFileId = Record<string, BatchFileViewUrlItem>;

export function useBatchViewUrls(fileIds: string[]) {
  const sortedUniqueIds = useMemo((): string[] => {
    const unique = [...new Set(fileIds.filter((id) => id.length > 0))];
    unique.sort();
    return unique;
  }, [fileIds]);

  return useQuery({
    queryKey: batchViewUrlsQueryKey(sortedUniqueIds),
    queryFn: () => getBatchViewUrls(sortedUniqueIds),
    enabled: sortedUniqueIds.length > 0,
    staleTime: FIFTY_FIVE_MINUTES,
    refetchOnWindowFocus: false,
    select: (items): ViewUrlByFileId => {
      const map: ViewUrlByFileId = {};
      for (const item of items) {
        map[item.fileId] = item;
      }
      return map;
    },
  });
}
