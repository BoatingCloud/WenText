import dayjs from 'dayjs';
import type {
  PhysicalArchive,
  PhysicalArchiveStatus,
  ArchiveWorkflowStatus,
  ArchiveVersionStatus,
  FondsCatalogItem,
} from '../../services/api';

export { type PhysicalArchive, type PhysicalArchiveStatus, type ArchiveWorkflowStatus, type ArchiveVersionStatus, type FondsCatalogItem };

export const statusOptions: { label: string; value: PhysicalArchiveStatus; color: string }[] = [
  { label: '在库', value: 'IN_STOCK', color: 'green' },
  { label: '借阅中', value: 'BORROWED', color: 'orange' },
  { label: '遗失', value: 'LOST', color: 'red' },
  { label: '销毁', value: 'DESTROYED', color: 'default' },
];

export const workflowOptions: { label: string; value: ArchiveWorkflowStatus; color: string }[] = [
  { label: '草稿', value: 'DRAFT', color: 'default' },
  { label: '待审核', value: 'PENDING_REVIEW', color: 'gold' },
  { label: '已归档', value: 'ARCHIVED', color: 'green' },
  { label: '已修改', value: 'MODIFIED', color: 'blue' },
  { label: '已借出', value: 'BORROWED', color: 'orange' },
  { label: '已归还', value: 'RETURNED', color: 'cyan' },
  { label: '已销毁', value: 'DESTROYED', color: 'red' },
];

export const versionStatusOptions: { label: string; value: ArchiveVersionStatus }[] = [
  { label: '草稿', value: 'DRAFT' },
  { label: '定稿', value: 'FINAL' },
  { label: '废止', value: 'ABOLISHED' },
];

export const retentionOptions = ['永久', '30年', '10年', '5年'];
export const securityOptions = ['绝密', '机密', '秘密', '内部公开'];
export const fileTypeOptions = ['通知', '报告', '合同', '会议纪要', '往来函件', '台账'];
export const archiveFormOptions = ['原件', '副本', '复印件'];
export const carrierTypeOptions = ['纸质', '电子文件', '胶片', '照片', '音视频'];
export const accessLevelOptions = ['公开', '内部', '保密'];
export const appraisalStatusOptions = ['已鉴定', '待鉴定'];
export const digitizationStatusOptions = ['已扫描', '待扫描'];
export const transferStatusOptions = ['已转存', '待转存'];

export const DEFAULT_FONDS_OPTIONS: FondsCatalogItem[] = [
  { name: '深圳文雨', code: 'SZ' },
  { name: '文雨集团', code: 'WY' },
  { name: '总部综合档案', code: 'HQ' },
];

// ── 表单日期转换工具 ──

export const toFormDate = (value?: string) => (value ? dayjs(value) : undefined);
export const toIso = (value?: dayjs.Dayjs | null) => (value ? value.toISOString() : undefined);

export const extractRetentionYears = (value?: string): number | null => {
  if (!value) return null;
  if (value.includes('永久')) return null;
  const matched = value.match(/(\d+)/);
  if (!matched) return null;
  return Number(matched[1]);
};

export const pickFields = <T extends object>(source: T, keys: Array<keyof T>): Partial<T> => {
  const result: Partial<T> = {};
  keys.forEach((key) => {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  });
  return result;
};

// 表单 dayjs 值类型
export type ArchiveFormValues = Omit<
  Partial<PhysicalArchive>,
  | 'title' | 'archiveNo' | 'categoryName' | 'fondsName' | 'fondsCode' | 'year' | 'shelfLocation'
  | 'formedAt' | 'expiresAt' | 'borrowedAt' | 'filingDate' | 'effectiveDate' | 'invalidDate'
  | 'transferDate' | 'receiveDate' | 'appraisalDate' | 'reviewedAt' | 'filedAt' | 'destroyedAt'
  | 'lastAccessedAt' | 'customDate' | 'extraJson'
> & {
  title?: string;
  archiveNo?: string;
  categoryName?: string;
  fondsName?: string;
  fondsCode?: string;
  year?: number;
  shelfLocation?: string;
  formedAt?: dayjs.Dayjs;
  expiresAt?: dayjs.Dayjs;
  borrowedAt?: dayjs.Dayjs;
  filingDate?: dayjs.Dayjs;
  effectiveDate?: dayjs.Dayjs;
  invalidDate?: dayjs.Dayjs;
  transferDate?: dayjs.Dayjs;
  receiveDate?: dayjs.Dayjs;
  appraisalDate?: dayjs.Dayjs;
  reviewedAt?: dayjs.Dayjs;
  filedAt?: dayjs.Dayjs;
  destroyedAt?: dayjs.Dayjs;
  lastAccessedAt?: dayjs.Dayjs;
  customDate?: dayjs.Dayjs;
  extraJson?: Record<string, any>;
  extraJsonText?: string;
};

export const toFormValues = (record: PhysicalArchive): ArchiveFormValues => ({
  ...record,
  formedAt: toFormDate(record.formedAt),
  expiresAt: toFormDate(record.expiresAt),
  borrowedAt: toFormDate(record.borrowedAt),
  filingDate: toFormDate(record.filingDate),
  effectiveDate: toFormDate(record.effectiveDate),
  invalidDate: toFormDate(record.invalidDate),
  transferDate: toFormDate(record.transferDate),
  receiveDate: toFormDate(record.receiveDate),
  appraisalDate: toFormDate(record.appraisalDate),
  reviewedAt: toFormDate(record.reviewedAt),
  filedAt: toFormDate(record.filedAt),
  destroyedAt: toFormDate(record.destroyedAt),
  lastAccessedAt: toFormDate(record.lastAccessedAt),
  customDate: toFormDate(record.customDate),
  extraJsonText: record.extraJson ? JSON.stringify(record.extraJson, null, 2) : undefined,
});

export const formValuesToPayload = (values: ArchiveFormValues): Partial<PhysicalArchive> => {
  let extraJson: Record<string, unknown> | undefined;
  if (values.extraJsonText && values.extraJsonText.trim()) {
    extraJson = JSON.parse(values.extraJsonText);
  }

  const payload: Partial<PhysicalArchive> = {
    ...values,
    formedAt: toIso(values.formedAt),
    expiresAt: toIso(values.expiresAt),
    borrowedAt: toIso(values.borrowedAt),
    filingDate: toIso(values.filingDate),
    effectiveDate: toIso(values.effectiveDate),
    invalidDate: toIso(values.invalidDate),
    transferDate: toIso(values.transferDate),
    receiveDate: toIso(values.receiveDate),
    appraisalDate: toIso(values.appraisalDate),
    reviewedAt: toIso(values.reviewedAt),
    filedAt: toIso(values.filedAt),
    destroyedAt: toIso(values.destroyedAt),
    lastAccessedAt: toIso(values.lastAccessedAt),
    customDate: toIso(values.customDate),
    extraJson,
    copies: values.copies || 1,
    tags: values.tags || [],
    keywords: values.keywords || [],
    versionHistory: values.versionHistory || [],
    relatedArchiveIds: values.relatedArchiveIds || [],
    revisionNo: values.revisionNo || 1,
    versionNo: values.versionNo || 'V1.0',
    workflowStatus: values.workflowStatus || 'DRAFT',
    status: values.status || 'IN_STOCK',
  };

  delete (payload as Record<string, unknown>).extraJsonText;
  return payload;
};

export const statusTagMap: Record<string, string> = Object.fromEntries(
  statusOptions.map((item) => [item.value, item.color])
);

export const workflowTagMap: Record<string, string> = Object.fromEntries(
  workflowOptions.map((item) => [item.value, item.color])
);

export const statusLabelMap: Record<string, string> = Object.fromEntries(
  statusOptions.map((item) => [item.value, item.label])
);

export const workflowLabelMap: Record<string, string> = Object.fromEntries(
  workflowOptions.map((item) => [item.value, item.label])
);
