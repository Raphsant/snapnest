import type React from 'react';

/**
 * Structural stand-in for a lucide icon component.
 *
 * Deliberately NOT `import type { LucideIcon } from 'lucide-react-native'`:
 * lucide's LucideProps extends react-native-svg's SvgProps, and react-native-svg
 * is not in the current dev client binary. Declaring the shape locally keeps the
 * primitives free of both packages while still accepting any lucide icon — their
 * props are all optional, so `LucideIcon` is assignable to this.
 *
 * Callers pass the component itself, not an element: `icon={Camera}`.
 */
export type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;
