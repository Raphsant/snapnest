import { useMemo } from 'react';

import { useTheme, type Palette } from './tokens';

/**
 * Turns a style factory into a hook whose StyleSheet is memoized per palette:
 *
 *   const useStyles = createThemedStyles((t) => StyleSheet.create({ ... }));
 *   // inside a component:
 *   const styles = useStyles();
 *
 * The factory runs at most once per theme — the WeakMap keys on palette identity
 * (there are only two stable palette objects), so flipping Comfort↔Blue reuses
 * the already-built sheets and a render without a switch does no work.
 */
export function createThemedStyles<T>(factory: (t: Palette) => T): () => T {
  const cache = new WeakMap<Palette, T>();
  return function useThemedStyles(): T {
    const palette = useTheme();
    return useMemo(() => {
      const cached = cache.get(palette);
      if (cached !== undefined) {
        return cached;
      }
      const built = factory(palette);
      cache.set(palette, built);
      return built;
    }, [palette]);
  };
}
