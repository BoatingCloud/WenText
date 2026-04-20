import type { Prisma } from '@prisma/client';

export const toJsonStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

export const asInputJsonArray = (value: string[] | undefined | null): Prisma.InputJsonValue => {
  return Array.isArray(value) ? value : [];
};
