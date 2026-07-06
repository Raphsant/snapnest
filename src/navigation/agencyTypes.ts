export type AgencyStackParamList = {
  AgencyFolderList: undefined;
  AgencyFolderDetail: {
    folderId: string;
    folderName: string;
    agencyId: string;
  };
};

/** Minimal navigation surface (no native stack — avoids Fabric setColor: crash). */
export type AgencyNavigationProp = {
  navigate(
    name: 'AgencyFolderDetail',
    params: AgencyStackParamList['AgencyFolderDetail'],
  ): void;
  goBack(): void;
};

export type AgencyFolderListScreenProps = {
  navigation: Pick<AgencyNavigationProp, 'navigate'>;
};

export type AgencyFolderDetailScreenProps = {
  navigation: Pick<AgencyNavigationProp, 'goBack'>;
  route: { params: AgencyStackParamList['AgencyFolderDetail'] };
};
