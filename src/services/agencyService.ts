import { apiClient } from './api';
import type { MediaFile } from './filesService';

export type AgencyRole = 'CLIENT' | 'STAFF';

export type AccountType = 'PERSONAL' | 'AGENCY_CLIENT' | 'AGENCY_STAFF' | 'ADMIN';

export type AgencyMembershipSummary = {
  agencyId: string;
  agencyName: string;
  role: AgencyRole;
};

export type Me = {
  id: string;
  email: string;
  firstName: string | null;
  accountType: AccountType;
  memberships: AgencyMembershipSummary[];
};

export type AgencyFolder = {
  id: string;
  agencyId: string | null;
  ownerId: string;
  name: string;
  type: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
};

export type AgencyFolderDetails = {
  folder: AgencyFolder;
  files: MediaFile[];
};

type BackendAgencyFolderRow = {
  id: string;
  agencyId: string | null;
  ownerId: string;
  name: string;
  type: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { files: number };
};

type BackendAgencyFolderWithFiles = Omit<BackendAgencyFolderRow, '_count'> & {
  files: BackendAgencyMediaFile[];
};

type BackendAgencyMediaFile = Omit<MediaFile, 'sizeBytes'> & {
  sizeBytes: string | number;
};

function mapAgencyFolder(row: BackendAgencyFolderRow): AgencyFolder {
  return {
    id: row.id,
    agencyId: row.agencyId,
    ownerId: row.ownerId,
    name: row.name,
    type: row.type,
    parentFolderId: row.parentFolderId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fileCount: row._count.files,
  };
}

function normalizeMediaFile(file: BackendAgencyMediaFile): MediaFile {
  return {
    ...file,
    sizeBytes: String(file.sizeBytes),
  };
}

/** Auth interceptor in apiClient attaches the JWT automatically. */
export async function getMe(): Promise<Me> {
  const response = await apiClient.get<Me>('/me');
  return response.data;
}

export async function getAgencyFolders(agencyId: string): Promise<AgencyFolder[]> {
  const response = await apiClient.get<BackendAgencyFolderRow[]>(
    `/agency/${agencyId}/folders`,
  );
  return response.data.map(mapAgencyFolder);
}

export async function getAgencyFolderDetails(
  folderId: string,
): Promise<AgencyFolderDetails> {
  const response = await apiClient.get<BackendAgencyFolderWithFiles>(
    `/agency/folders/${folderId}`,
  );
  const { files, ...folderRow } = response.data;
  const normalizedFiles = files.map(normalizeMediaFile);
  const folder = mapAgencyFolder({
    ...folderRow,
    _count: { files: normalizedFiles.length },
  });
  return { folder, files: normalizedFiles };
}
