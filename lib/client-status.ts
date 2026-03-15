export const CLIENT_STATUSES = ['LEAD', 'ACTIVE', 'INACTIVE', 'ON_HOLD', 'ARCHIVED'] as const

export type ClientStatus = (typeof CLIENT_STATUSES)[number]
