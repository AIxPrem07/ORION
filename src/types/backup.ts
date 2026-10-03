import type { UUID, ISODateTimeString } from './common'

export type BackupType = 'LOCAL' | 'CLOUD_S3' | 'CLOUD_CUSTOM'
export type BackupStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CORRUPTED'

export interface Backup {
  id: UUID
  businessId: UUID
  backupType: BackupType
  filePath: string | null
  cloudKey: string | null
  fileSize: number | null
  status: BackupStatus
  checksum: string | null
  providerMetadata: Record<string, unknown> | null
  createdAt: ISODateTimeString
  completedAt: ISODateTimeString | null
}

export interface CloudBackupConfig {
  enabled?: boolean
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  prefix: string   // folder prefix in bucket
}

export interface BackupRestoreOptions {
  backupId: UUID
  confirmOverwrite: boolean
}
