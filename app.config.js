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
});
