import React, { useMemo, useState } from 'react';

import { ScreenTransition } from '../components/ScreenTransition';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StorageScreen } from '../screens/StorageScreen';

type SettingsRoute = { screen: 'SettingsRoot' } | { screen: 'Storage' };

/**
 * Settings root ↔ Storage without native-stack — same Fabric workaround as
 * FoldersStack/AuthFlow (`@react-navigation/native-stack` triggers
 * `-[RCTView setColor:]` on iOS New Arch). Storage is only reachable from the
 * Settings root, so a two-state machine is enough.
 */
export function SettingsStack(): React.ReactElement {
  const [route, setRoute] = useState<SettingsRoute>({ screen: 'SettingsRoot' });

  const nav = useMemo(
    () => ({
      openStorage: () => setRoute({ screen: 'Storage' }),
      goBack: () => setRoute({ screen: 'SettingsRoot' }),
    }),
    [],
  );

  return (
    <ScreenTransition
      transitionKey={route.screen}
      kind={route.screen === 'Storage' ? 'push' : 'pop'}
    >
      {route.screen === 'Storage' ? (
        <StorageScreen navigation={{ goBack: nav.goBack }} />
      ) : (
        <SettingsScreen navigation={{ openStorage: nav.openStorage }} />
      )}
    </ScreenTransition>
  );
}
