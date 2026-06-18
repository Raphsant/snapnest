import { useQuery } from '@tanstack/react-query';

import { getFileViewUrl } from '../services/filesService';

export const fileViewUrlQueryKey = (fileId: string): readonly ['fileViewUrl', string] =>
  ['fileViewUrl', fileId] as const;

const FIFTY_FIVE_MINUTES = 55 * 60 * 1000;

export function useFileViewUrl(fileId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: fileViewUrlQueryKey(fileId ?? ''),
    queryFn: () => getFileViewUrl(fileId as string),
    enabled: enabled && fileId !== null && fileId.length > 0,
    staleTime: FIFTY_FIVE_MINUTES,
    refetchOnWindowFocus: false,
  });
}
