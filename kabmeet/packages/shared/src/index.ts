export const USER_ROLES = [
  'VISITOR',
  'MEMBER',
  'SPEAKER',
  'MODERATOR',
  'HOST',
  'LECTURER',
  'ADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  VISITOR: 0,
  MEMBER: 1,
  SPEAKER: 2,
  MODERATOR: 3,
  HOST: 4,
  LECTURER: 4,
  ADMIN: 5,
};

export interface AuthUserProfile {
  id: string;
  email: string;
  universityId: string | null;
  fullName: string;
  department: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
}

export function getAllowedNavPaths(role: UserRole): string[] {
  const base = ['/', '/communities'];
  if (role === 'VISITOR') {
    return base;
  }

  const memberPaths = [...base, '/watch', '/room', '/classes', '/profile'];
  if (role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER') {
    return [...memberPaths, '/host-panel'];
  }
  if (role === 'ADMIN') {
    return [...memberPaths, '/host-panel', '/admin'];
  }
  return memberPaths;
}
