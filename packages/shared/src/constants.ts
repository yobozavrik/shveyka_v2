/**
 * Статуси виробничих замовлень (Production Orders)
 */
export const ORDER_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  LAUNCHED: 'launched',
  IN_PRODUCTION: 'in_production',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

/**
 * Статуси партій (Batches)
 */
export const BATCH_STATUS = {
  CREATED: 'created',
  CUTTING: 'cutting',
  SEWING: 'sewing',
  OVERLOCK: 'overlock',
  STRAIGHT_STITCH: 'straight_stitch',
  COVERLOCK: 'coverlock',
  PACKAGING: 'packaging',
  READY: 'ready',
  SHIPPED: 'shipped',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export type BatchStatus = typeof BATCH_STATUS[keyof typeof BATCH_STATUS];

/**
 * Коди етапів виробництва
 */
export const STAGE_CODES = {
  CUTTING: 'cutting',
  SEWING: 'sewing',
  OVERLOCK: 'overlock',
  STRAIGHT_STITCH: 'straight_stitch',
  COVERLOCK: 'coverlock',
  PACKAGING: 'packaging',
  READY: 'ready',
} as const;

export type StageCode = typeof STAGE_CODES[keyof typeof STAGE_CODES];

/**
 * Ролі користувачів
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  MASTER: 'master',
  WORKER: 'worker',
  HR: 'hr',
  QUALITY: 'quality',
  PRODUCTION_HEAD: 'production_head',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
