/**
 * ORION S3 Cloud Backup Service
 * 
 * Provides automated or on-demand backups to any S3-compatible cloud storage
 * (AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces).
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import { generateId } from '@utils/uuid'
import { nowISO } from '@utils/date'
import { dbSelect, dbExecute } from '@db/client'
import type { CloudBackupConfig, Backup } from '@/types/backup'

let s3ClientInstance: S3Client | null = null

export function getS3Client(config: CloudBackupConfig): S3Client {
  return new S3Client({
    region: config.region || 'us-east-1',
    endpoint: config.endpoint || undefined,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: Boolean(config.endpoint),
  })
}

/**
 * Saves or updates cloud backup configuration in app_settings
 */
export async function saveCloudBackupConfig(config: CloudBackupConfig): Promise<void> {
  const now = nowISO()
  await dbExecute(
    `INSERT INTO app_settings (id, key, value, updated_at)
     VALUES (?, 'cloud_backup_config', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [generateId(), JSON.stringify(config), now],
  )
}

/**
 * Retrieves cloud backup configuration from app_settings
 */
export async function getCloudBackupConfig(): Promise<CloudBackupConfig | null> {
  const rows = await dbSelect<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'cloud_backup_config'`,
    [],
  )
  if (rows.length === 0 || !rows[0].value) return null
  try {
    return JSON.parse(rows[0].value) as CloudBackupConfig
  } catch {
    return null
  }
}

/**
 * Uploads a local backup database file to the configured S3 bucket
 */
export async function uploadBackupToCloud(
  localBackupPath: string,
  fileName: string,
  businessId: string,
): Promise<{ s3Key: string; size: number }> {
  const config = await getCloudBackupConfig()
  if (!config || !config.enabled) {
    throw new Error('Cloud backup is not configured or disabled.')
  }

  const client = getS3Client(config)
  const fileBytes = await readFile(localBackupPath)

  const s3Key = `${config.prefix || 'backups'}/${fileName}`

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
      Body: fileBytes,
      ContentType: 'application/x-sqlite3',
      Metadata: {
        business_id: businessId,
        created_at: nowISO(),
      },
    }),
  )

  return {
    s3Key,
    size: fileBytes.byteLength,
  }
}

/**
 * Lists available backups in the S3 bucket
 */
export async function listCloudBackups(): Promise<Array<{ key: string; lastModified?: Date; size?: number }>> {
  const config = await getCloudBackupConfig()
  if (!config || !config.enabled) {
    throw new Error('Cloud backup is not configured or disabled.')
  }

  const client = getS3Client(config)
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: config.prefix || 'backups',
    }),
  )

  return (
    response.Contents?.map((obj) => ({
      key: obj.Key || '',
      lastModified: obj.LastModified,
      size: obj.Size,
    })) || []
  )
}
