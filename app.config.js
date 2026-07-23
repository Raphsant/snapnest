// Dynamic Expo config. Expo loads app.json first and passes it in as `config`;
// here we override identity fields for the development variant so a dev-client
// build installs alongside the TestFlight/production app instead of replacing it.
//
// The variant is selected by the APP_VARIANT env var (set per-profile in
// eas.json). Anything other than "development" keeps the production identity.
//
// Note: `scheme` is intentionally NOT varied — Cognito's redirect is bound to
// snapnest://, so both variants must keep the same scheme for auth to work.
const IS_DEV = process.env.APP_VARIANT === 'development';

/**
 * app.json lists expo-notifications as a bare string, which leaves the APNs
 * environment entitlement (aps-environment) at the plugin default. Rewrite that
 * one entry so it tracks the variant: a dev client is signed with a development
 * profile and must register against the APNs sandbox, while TestFlight and the
 * App Store need production. Mismatched, the token registers against the wrong
 * environment and pushes silently never arrive.
 *
 * Position in the array is preserved and every other plugin passes through
 * untouched. Handles the entry already carrying options, so adding some in
 * app.json later won't silently drop them here.
 */
const withNotificationsMode = (plugins = []) =>
  plugins.map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== 'expo-notifications') {
      return plugin;
    }
    const options = Array.isArray(plugin) ? plugin[1] : undefined;
    return [
      'expo-notifications',
      { ...options, mode: IS_DEV ? 'development' : 'production' },
    ];
  });

export default ({ config }) => ({
  ...config,
  name: IS_DEV ? 'SnapNest Dev' : config.name,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV
      ? 'com.sunnysant.snapnest.dev'
      : config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_DEV ? 'com.sunnysant.snapnest.dev' : config.android.package,
  },
  plugins: withNotificationsMode(config.plugins),
});
