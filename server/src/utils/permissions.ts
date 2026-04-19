export const PERMISSION_ALIASES: Record<string, string[]> = {
  'system:manage': ['system:config', 'role:view', 'user:view'],
  'system:config': ['system:manage'],
  'audit:view': ['system:audit'],
  'system:audit': ['audit:view'],

  'user:view': ['user:read'],
  'user:read': ['user:view'],

  'role:view': ['role:read'],
  'role:read': ['role:view'],
  'role:manage': ['role:view', 'role:read', 'role:create', 'role:update', 'role:delete'],

  'repo:view': ['repo:read'],
  'repo:read': ['repo:view'],
  'repo:manage': ['repo:read', 'repo:create', 'repo:update', 'repo:delete'],
  'repo:update': ['repo:manage'],
  'repo:create': ['repo:manage'],
  'repo:delete': ['repo:manage'],

  'doc:view': ['doc:read'],
  'doc:read': ['doc:view'],
  'doc:upload': ['doc:create'],
  'doc:create': ['doc:upload'],
  'doc:edit': ['doc:update'],
  'doc:update': ['doc:edit'],

  'search:all': ['search:basic'],

  'user:manage': ['user:view', 'user:read', 'user:create', 'user:update', 'user:delete'],
  'user:update': ['user:view', 'user:read'],
  'user:create': ['user:view', 'user:read'],
};

export const normalizePermissionCodes = (codes: string[]): string[] => {
  const normalized = new Set<string>();

  for (const code of codes) {
    normalized.add(code);

    const aliases = PERMISSION_ALIASES[code] || [];
    for (const alias of aliases) {
      normalized.add(alias);
    }
  }

  return [...normalized];
};
