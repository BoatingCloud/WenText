import type { DocumentReviewType, ReviewStatus } from '../../../services/api';

// 文档类型选项
export const documentTypeOptions: { label: string; value: DocumentReviewType }[] = [
  { label: '合同', value: 'CONTRACT' },
  { label: '律师函', value: 'LAWYER_LETTER' },
  { label: '催收函', value: 'COLLECTION_LETTER' },
  { label: '协议', value: 'AGREEMENT' },
  { label: '通知', value: 'NOTICE' },
  { label: '其他', value: 'OTHER' },
];

// 审查状态选项
export const reviewStatusOptions: { label: string; value: ReviewStatus }[] = [
  { label: '草稿', value: 'DRAFT' },
  { label: 'AI审查中', value: 'AI_REVIEWING' },
  { label: '待审批', value: 'PENDING' },
  { label: '审批中', value: 'IN_PROGRESS' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已取消', value: 'CANCELLED' },
];

// 文档类型标签映射
export const documentTypeTagMap: Record<DocumentReviewType, string> = {
  CONTRACT: 'blue',
  LAWYER_LETTER: 'purple',
  COLLECTION_LETTER: 'orange',
  AGREEMENT: 'cyan',
  NOTICE: 'geekblue',
  OTHER: 'default',
};

// 审查状态标签映射
export const reviewStatusTagMap: Record<ReviewStatus, string> = {
  DRAFT: 'default',
  AI_REVIEWING: 'processing',
  PENDING: 'warning',
  IN_PROGRESS: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

// 文档类型标签文本
export const documentTypeLabelMap: Record<DocumentReviewType, string> = {
  CONTRACT: '合同',
  LAWYER_LETTER: '律师函',
  COLLECTION_LETTER: '催收函',
  AGREEMENT: '协议',
  NOTICE: '通知',
  OTHER: '其他',
};

// 审查状态标签文本
export const reviewStatusLabelMap: Record<ReviewStatus, string> = {
  DRAFT: '草稿',
  AI_REVIEWING: 'AI审查中',
  PENDING: '待审批',
  IN_PROGRESS: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
};
