import type { UNFILED_FILES_FOLDER_PARAM } from '../services/filesService';

export type FolderDetailFolderId = string | typeof UNFILED_FILES_FOLDER_PARAM;

export type FoldersStackParamList = {
  FolderList: undefined;
  FolderDetail: {
    /** Folder UUID, or `'none'` for the unfiled-only view. */
    folderId: FolderDetailFolderId;
    folderName: string;
  };
};

/** Minimal navigation surface for folders (no native stack — avoids Fabric setColor: crash). */
export type FoldersNavigationProp = {
  navigate(name: 'FolderDetail', params: FoldersStackParamList['FolderDetail']): void;
  goBack(): void;
};

export type FoldersListScreenProps = {
  navigation: Pick<FoldersNavigationProp, 'navigate'>;
};

export type FolderDetailScreenProps = {
  navigation: Pick<FoldersNavigationProp, 'goBack'>;
  route: { params: FoldersStackParamList['FolderDetail'] };
};
