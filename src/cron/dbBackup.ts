import cron from 'node-cron';
import {
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

import { db } from '../config/db';
import { r2Client, R2_BUCKET } from '../config/r2';
import { logger } from '../utils/logger';

const TIMEZONE = 'Asia/Kolkata';
const SCHEDULE = '0 5 * * *'; // every day at 05:00 AM
const BACKUP_ROOT = 'backup/';

// Use a dedicated private bucket when configured; fall back to the main bucket.
const BACKUP_BUCKET = process.env.R2_BACKUP_BUCKET_NAME || R2_BUCKET;

/** Today's date in Asia/Kolkata as DD-MM-YYYY. */
function todayFolderName(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('day')}-${get('month')}-${get('year')}`;
}

/** Upload one file and confirm R2 stored the full content. */
async function uploadAndVerify(key: string, body: Buffer): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    })
  );

  const head = await r2Client.send(new HeadObjectCommand({ Bucket: BACKUP_BUCKET, Key: key }));
  if (head.ContentLength !== body.length) {
    throw new Error(`Size mismatch for ${key}: expected ${body.length}, got ${head.ContentLength}`);
  }
}

/** All date folders under backup/ (e.g. "backup/23-11-2026/"). */
async function listBackupFolders(): Promise<string[]> {
  const folders: string[] = [];
  let token: string | undefined;

  do {
    const res = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: BACKUP_BUCKET,
        Prefix: BACKUP_ROOT,
        Delimiter: '/',
        ContinuationToken: token,
      })
    );
    res.CommonPrefixes?.forEach((p) => p.Prefix && folders.push(p.Prefix));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  return folders;
}

/** Delete every object under a folder prefix. */
async function deleteFolder(prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;

  do {
    const res = await r2Client.send(
      new ListObjectsV2Command({ Bucket: BACKUP_BUCKET, Prefix: prefix, ContinuationToken: token })
    );

    const keys = (res.Contents || []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length) {
      const del = await r2Client.send(
        new DeleteObjectsCommand({ Bucket: BACKUP_BUCKET, Delete: { Objects: keys, Quiet: true } })
      );
      if (del.Errors?.length) {
        throw new Error(`Failed to delete ${del.Errors.length} object(s) under ${prefix}`);
      }
      deleted += keys.length;
    }

    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  return deleted;
}

let running = false;

/**
 * Dump every table to <ModelName>.json, upload to backup/DD-MM-YYYY/,
 * and only after every upload is verified, remove older backup folders.
 */
export async function runDatabaseBackup(): Promise<void> {
  if (running) {
    logger.warn('[db-backup] Previous backup still running, skipping this run.');
    return;
  }
  running = true;

  const folder = `${BACKUP_ROOT}${todayFolderName()}/`;
  const startedAt = Date.now();
  logger.info(`[db-backup] Starting backup → ${BACKUP_BUCKET}/${folder}`);

  try {
    // 1. Read every table first, so a DB failure uploads nothing.
    const dumps: { key: string; body: Buffer; rows: number }[] = [];
    for (const [name, model] of Object.entries(db.models)) {
      const rows = await model.findAll({ raw: true, paranoid: false });
      dumps.push({
        key: `${folder}${name}.json`,
        body: Buffer.from(JSON.stringify(rows, null, 2), 'utf-8'),
        rows: rows.length,
      });
    }

    // 2. Upload every file and verify each one.
    for (const dump of dumps) {
      await uploadAndVerify(dump.key, dump.body);
      logger.info(`[db-backup] Uploaded ${dump.key} (${dump.rows} rows)`);
    }

    // 3. All uploads succeeded: now remove older backups.
    const oldFolders = (await listBackupFolders()).filter((f) => f !== folder);
    for (const old of oldFolders) {
      const count = await deleteFolder(old);
      logger.info(`[db-backup] Deleted old backup ${old} (${count} files)`);
    }

    logger.info(
      `[db-backup] Completed: ${dumps.length} tables in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
    );
  } catch (err) {
    // Old backups are left untouched when anything fails.
    logger.error(`[db-backup] Failed, previous backups kept: ${(err as Error).message}`, {
      stack: (err as Error).stack,
    });
  } finally {
    running = false;
  }
}

export function startDatabaseBackupCron(): void {
  cron.schedule(SCHEDULE, runDatabaseBackup, { timezone: TIMEZONE, name: 'db-backup', noOverlap: true });
  logger.info(`[db-backup] Scheduled daily at 05:00 ${TIMEZONE}`);
}
