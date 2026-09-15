import React, { useMemo, useState } from 'react';

import { ScreenTransition } from '../components/ScreenTransition';
import { FolderDetailScreen } from '../screens/FolderDetailScreen';
import { FoldersScreen } from '../screens/FoldersScreen';
import type { FoldersNavigationProp, FoldersStackParamList } from './foldersTypes';

type FoldersRouteState =
  | { screen: 'FolderList' }
  | { screen: 'FolderDetail'; params: FoldersStackParamList['FolderDetail'] };

/**
 * Folders list ↔ detail without native-stack — same Fabric workaround as AuthFlow.
 * `@react-navigation/native-stack` triggers `-[RCTView setColor:]` on iOS New Arch.
 */
export function FoldersStack(): React.ReactElement {
  const [route, setRoute] = useState<FoldersRouteState>({ screen: 'FolderList' });

  const navigation = useMemo<FoldersNavigationProp>(
    () => ({
      navigate(name, params) {
        if (name === 'FolderDetail') {
          setRoute({ screen: 'FolderDetail', params });
        }
      },
      goBack() {
        setRoute({ screen: 'FolderList' });
      },
    }),
    [],
  );

  return (
    <ScreenTransition
      transitionKey={route.screen}
      kind={route.screen === 'FolderDetail' ? 'push' : 'pop'}
    >
      {route.screen === 'FolderDetail' ? (
        <FolderDetailScreen
          navigation={{ goBack: navigation.goBack }}
          route={{ params: route.params }}
        />
      ) : (
        <FoldersScreen navigation={{ navigate: navigation.navigate }} />
      )}
    </ScreenTransition>
  );
}
