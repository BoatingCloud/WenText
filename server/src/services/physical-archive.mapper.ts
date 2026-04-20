import type { PhysicalArchive } from '@prisma/client';
import { toJsonStringArray } from '../utils/json-array.js';

type SerializedPhysicalArchive = Omit<PhysicalArchive, 'fileSizeBytes'> & {
  fileSizeBytes: string | null;
};

export function serializePhysicalArchive<T extends PhysicalArchive>(
  archive: T,
): Omit<T, 'fileSizeBytes'> & { fileSizeBytes: string | null } {
  return {
    ...archive,
    keywords: toJsonStringArray(archive.keywords),
    tags: toJsonStringArray(archive.tags),
    versionHistory: toJsonStringArray(archive.versionHistory),
    relatedArchiveIds: toJsonStringArray(archive.relatedArchiveIds),
    fileSizeBytes: archive.fileSizeBytes != null
      ? archive.fileSizeBytes.toString()
      : null,
  };
}

export function serializePhysicalArchiveList<T extends PhysicalArchive>(
  archives: T[],
): Array<Omit<T, 'fileSizeBytes'> & { fileSizeBytes: string | null }> {
  return archives.map(serializePhysicalArchive);
}

export function normalizeFileSizeBytes(
  value: string | number | bigint | null | undefined,
): bigint | null {
  if (value == null) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') {
    const parsed = BigInt(value);
    return parsed;
  }
  return BigInt(value);
}
