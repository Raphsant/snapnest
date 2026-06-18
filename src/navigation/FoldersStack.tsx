import React, { useMemo, useState } from 'react';

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

  if (route.screen === 'FolderDetail') {
    return (
      <FolderDetailScreen
        navigation={{ goBack: navigation.goBack }}
        route={{ params: route.params }}
      />
    );
  }

  return <FoldersScreen navigation={{ navigate: navigation.navigate }} />;
}
