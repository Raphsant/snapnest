import React, { useMemo, useState } from 'react';

import { AgencyFolderDetailScreen } from '../screens/AgencyFolderDetailScreen';
import { AgencyFoldersScreen } from '../screens/AgencyFoldersScreen';
import type { AgencyNavigationProp, AgencyStackParamList } from './agencyTypes';

type AgencyRouteState =
  | { screen: 'AgencyFolderList' }
  | { screen: 'AgencyFolderDetail'; params: AgencyStackParamList['AgencyFolderDetail'] };

/**
 * Agency folder list ↔ detail without native-stack — same Fabric workaround as
 * FoldersStack / AuthFlow. `@react-navigation/native-stack` triggers
 * `-[RCTView setColor:]` on iOS New Arch.
 */
export function AgencyStack(): React.ReactElement {
  const [route, setRoute] = useState<AgencyRouteState>({ screen: 'AgencyFolderList' });

  const navigation = useMemo<AgencyNavigationProp>(
    () => ({
      navigate(name, params) {
        if (name === 'AgencyFolderDetail') {
          setRoute({ screen: 'AgencyFolderDetail', params });
        }
      },
      goBack() {
        setRoute({ screen: 'AgencyFolderList' });
      },
    }),
    [],
  );

  if (route.screen === 'AgencyFolderDetail') {
    return (
      <AgencyFolderDetailScreen
        navigation={{ goBack: navigation.goBack }}
        route={{ params: route.params }}
      />
    );
  }

  return <AgencyFoldersScreen navigation={{ navigate: navigation.navigate }} />;
}
