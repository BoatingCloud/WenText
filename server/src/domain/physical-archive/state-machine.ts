import type { ArchiveWorkflowStatus, PhysicalArchiveStatus } from '@prisma/client';
import { StateTransitionError } from '../../utils/errors.js';

/**
 * 工作流状态迁移矩阵
 * key: 当前状态, value: 允许的目标状态集合
 */
const WORKFLOW_TRANSITIONS: Record<ArchiveWorkflowStatus, ArchiveWorkflowStatus[]> = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['ARCHIVED', 'DRAFT'],
  ARCHIVED: ['MODIFIED', 'BORROWED', 'DESTROYED'],
  MODIFIED: ['PENDING_REVIEW'],
  BORROWED: ['RETURNED'],
  RETURNED: ['ARCHIVED', 'BORROWED'],
  DESTROYED: [],
};

/**
 * 库存状态迁移矩阵
 */
const INVENTORY_TRANSITIONS: Record<PhysicalArchiveStatus, PhysicalArchiveStatus[]> = {
  IN_STOCK: ['BORROWED', 'LOST', 'DESTROYED'],
  BORROWED: ['IN_STOCK', 'LOST', 'DESTROYED'],
  LOST: ['IN_STOCK', 'DESTROYED'],
  DESTROYED: [],
};

export function isValidWorkflowTransition(
  from: ArchiveWorkflowStatus,
  to: ArchiveWorkflowStatus,
): boolean {
  return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidInventoryTransition(
  from: PhysicalArchiveStatus,
  to: PhysicalArchiveStatus,
): boolean {
  return INVENTORY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertWorkflowTransition(
  from: ArchiveWorkflowStatus,
  to: ArchiveWorkflowStatus,
): void {
  if (!isValidWorkflowTransition(from, to)) {
    throw new StateTransitionError(
      `工作流状态不允许从 ${from} 转换到 ${to}`,
      from,
      to,
    );
  }
}

export function assertInventoryTransition(
  from: PhysicalArchiveStatus,
  to: PhysicalArchiveStatus,
): void {
  if (!isValidInventoryTransition(from, to)) {
    throw new StateTransitionError(
      `库存状态不允许从 ${from} 转换到 ${to}`,
      from,
      to,
    );
  }
}

export function getValidWorkflowTargets(from: ArchiveWorkflowStatus): ArchiveWorkflowStatus[] {
  return WORKFLOW_TRANSITIONS[from] ?? [];
}

export function getValidInventoryTargets(from: PhysicalArchiveStatus): PhysicalArchiveStatus[] {
  return INVENTORY_TRANSITIONS[from] ?? [];
}
