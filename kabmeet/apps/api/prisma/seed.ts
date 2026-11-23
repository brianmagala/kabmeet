import { PrismaClient, RoleScopeType, UserRole } from '@prisma/client';
import { hashPassword } from '@/modules/auth/password.util';

const prisma = new PrismaClient();

const PERMISSION_CATALOG: Array<{ key: string; description: string }> = [
  { key: 'discover:browse', description: 'Browse live, upcoming, and replay sessions' },
  { key: 'session:watch', description: 'Watch live sessions and replays' },
  { key: 'chat:send', description: 'Send chat messages, Q&A questions, and poll votes' },
  { key: 'room:raise_hand', description: 'Raise hand in interactive rooms' },
  { key: 'room:publish_media', description: 'Publish camera, microphone, and screen share' },
  { key: 'chat:moderate', description: 'Pin/delete messages, toggle slow mode, manage blocked words' },
  { key: 'session:host', description: 'Start/end sessions, approve speakers, mute/remove guests' },
  { key: 'class:manage', description: 'Create private virtual classes and restrict allowed students' },
  { key: 'attendance:export', description: 'Export virtual class attendance records as CSV' },
  { key: 'admin:manage_roles', description: 'Assign platform roles and manage communities' },
];

const ROLE_PERMISSION_MAP: Record<UserRole, string[]> = {
  VISITOR: ['discover:browse'],
  MEMBER: ['discover:browse', 'session:watch', 'chat:send', 'room:raise_hand'],
  SPEAKER: [
    'discover:browse',
    'session:watch',
    'chat:send',
    'room:raise_hand',
    'room:publish_media',
  ],
  MODERATOR: [
    'discover:browse',
    'session:watch',
    'chat:send',
    'room:raise_hand',
    'room:publish_media',
    'chat:moderate',
  ],
  HOST: [
    'discover:browse',
    'session:watch',
    'chat:send',
    'room:raise_hand',
    'room:publish_media',
    'chat:moderate',
    'session:host',
  ],
  LECTURER: [
    'discover:browse',
    'session:watch',
    'chat:send',
    'room:raise_hand',
    'room:publish_media',
    'chat:moderate',
    'session:host',
    'class:manage',
    'attendance:export',
  ],
  ADMIN: PERMISSION_CATALOG.map((item) => item.key),
};

export async function seed(): Promise<void> {
  const seedPassword = process.env.KABMEET_SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 8) {
    throw new Error(
      'Set KABMEET_SEED_PASSWORD (at least 8 characters) in your environment before running prisma db seed.',
    );
  }

  const passwordHash = await hashPassword(seedPassword);

  const roleCatalog: Array<{
    key: UserRole;
    displayName: string;
    description: string;
    rank: number;
  }> = [
    { key: UserRole.VISITOR, displayName: 'Visitor', description: 'Browse Discover and public community pages', rank: 0 },
    { key: UserRole.MEMBER, displayName: 'Member', description: 'Watch sessions, chat, vote in polls, and join open rooms', rank: 1 },
    { key: UserRole.SPEAKER, displayName: 'Speaker', description: 'Approved to publish camera, mic, and screen share', rank: 2 },
    { key: UserRole.MODERATOR, displayName: 'Moderator', description: 'Moderate chat, pin/delete messages, and manage slow mode', rank: 3 },
    { key: UserRole.HOST, displayName: 'Host', description: 'Run sessions, promote speakers, and manage room controls', rank: 4 },
    { key: UserRole.LECTURER, displayName: 'Lecturer', description: 'Create private virtual classes and export attendance CSVs', rank: 4 },
    { key: UserRole.ADMIN, displayName: 'Admin', description: 'Manage all users, roles, communities, and platform reports', rank: 5 },
  ];

  for (const roleDef of roleCatalog) {
    await prisma.role.upsert({
      where: { key: roleDef.key },
      update: {
        displayName: roleDef.displayName,
        description: roleDef.description,
        rank: roleDef.rank,
      },
      create: roleDef,
    });
  }

  // 1. Seed Permission catalog & RolePermission matrix
  const permissionIds = new Map<string, string>();
  for (const perm of PERMISSION_CATALOG) {
    const saved = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: perm,
    });
    permissionIds.set(perm.key, saved.id);
  }

  for (const [role, keys] of Object.entries(ROLE_PERMISSION_MAP) as Array<[UserRole, string[]]>) {
    for (const key of keys) {
      const permissionId = permissionIds.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role,
            permissionId,
          },
        },
        update: {},
        create: {
          role,
          permissionId,
        },
      });
    }
  }

  // 2. Seed Communities
  const communities = [
    {
      slug: 'indabax',
      name: 'IndabaX Kabale',
      description:
        'Machine learning research talks, paper reading groups, and annual IndabaX workshops at Kabale University.',
      accentColor: '#065A4B',
    },
    {
      slug: 'kab-ai',
      name: 'KAB AI Club',
      description:
        'Student-led Python, data science, and applied AI builders at Kabale University.',
      accentColor: '#0072BB',
    },
    {
      slug: 'huawei-student-club',
      name: 'Huawei Student Club',
      description: 'Networking, cloud infrastructure, and ICT competition prep sessions.',
      accentColor: '#065A4B',
    },
    {
      slug: 'aws-cloud-club',
      name: 'AWS Cloud Club Kabale',
      description: 'Cloud architecture labs, serverless study jams, and Linux fundamentals.',
      accentColor: '#0072BB',
    },
  ];

  for (const community of communities) {
    await prisma.community.upsert({
      where: { slug: community.slug },
      update: {
        name: community.name,
        description: community.description,
        accentColor: community.accentColor,
      },
      create: community,
    });
  }

  // 3. Seed Kabale University Accounts across all roles
  const seedUsers: Array<{
    email: string;
    universityId: string;
    fullName: string;
    department: string;
    role: UserRole;
  }> = [
    {
      email: 'admin@ai.kab.ac.ug',
      universityId: 'KAB/STAFF/001',
      fullName: 'Grace Tumusiime',
      department: 'Computer Science',
      role: UserRole.ADMIN,
    },
    {
      email: 'lecturer@ai.kab.ac.ug',
      universityId: 'KAB/LEC/014',
      fullName: 'Dr. Samuel Byamukama',
      department: 'Artificial Intelligence',
      role: UserRole.LECTURER,
    },
    {
      email: 'host@ai.kab.ac.ug',
      universityId: '2024/BCS/012',
      fullName: 'Aisha Namukasa',
      department: 'Computer Science',
      role: UserRole.HOST,
    },
    {
      email: 'moderator@ai.kab.ac.ug',
      universityId: '2024/BIT/038',
      fullName: 'Brian Mugisha',
      department: 'Information Technology',
      role: UserRole.MODERATOR,
    },
    {
      email: 'speaker@ai.kab.ac.ug',
      universityId: '2023/BCS/045',
      fullName: 'Sarah Katushabe',
      department: 'Data Science',
      role: UserRole.SPEAKER,
    },
    {
      email: 'member@ai.kab.ac.ug',
      universityId: '2025/BCS/104',
      fullName: 'Daniel Twinomujuni',
      department: 'Computer Science',
      role: UserRole.MEMBER,
    },
  ];

  for (const account of seedUsers) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        fullName: account.fullName,
        universityId: account.universityId,
        department: account.department,
        role: account.role,
      },
      create: {
        ...account,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });

    const existingGlobalAssignment = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: user.id,
        role: account.role,
        scopeType: RoleScopeType.GLOBAL,
        scopeId: null,
      },
    });

    if (!existingGlobalAssignment) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          role: account.role,
          scopeType: RoleScopeType.GLOBAL,
          scopeId: null,
        },
      });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
