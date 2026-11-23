-- Kabmeet Initial PostgreSQL Migration (Phase 1: User, Role, Session & RBAC)

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM (
  'VISITOR',
  'MEMBER',
  'SPEAKER',
  'MODERATOR',
  'HOST',
  'LECTURER',
  'ADMIN'
);

-- CreateEnum
CREATE TYPE "RoleScopeType" AS ENUM (
  'GLOBAL',
  'COMMUNITY',
  'SESSION'
);

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM (
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET'
);

-- CreateTable
CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "key" "UserRole" NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "universityId" TEXT,
  "fullName" TEXT NOT NULL,
  "department" TEXT,
  "avatarUrl" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "emailVerifiedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "AuthTokenPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "scopeType" "RoleScopeType" NOT NULL DEFAULT 'GLOBAL',
  "scopeId" TEXT,
  "grantedById" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAuditLog" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "previousRole" "UserRole" NOT NULL,
  "newRole" "UserRole" NOT NULL,
  "scopeType" "RoleScopeType" NOT NULL DEFAULT 'GLOBAL',
  "scopeId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RoleAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "accentColor" TEXT NOT NULL DEFAULT '#065A4B',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_universityId_key" ON "User"("universityId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

CREATE INDEX "UserRoleAssignment_userId_scopeType_idx" ON "UserRoleAssignment"("userId", "scopeType");
CREATE UNIQUE INDEX "UserRoleAssignment_userId_role_scopeType_scopeId_key" ON "UserRoleAssignment"("userId", "role", "scopeType", "scopeId");

CREATE INDEX "RoleAuditLog_targetUserId_idx" ON "RoleAuditLog"("targetUserId");
CREATE INDEX "RoleAuditLog_actorUserId_idx" ON "RoleAuditLog"("actorUserId");

CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

CREATE INDEX "CommunityMembership_communityId_idx" ON "CommunityMembership"("communityId");
CREATE UNIQUE INDEX "CommunityMembership_userId_communityId_key" ON "CommunityMembership"("userId", "communityId");

-- AddForeignKey
ALTER TABLE "User"
  ADD CONSTRAINT "User_role_fkey"
  FOREIGN KEY ("role") REFERENCES "Role"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthToken"
  ADD CONSTRAINT "AuthToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_role_fkey"
  FOREIGN KEY ("role") REFERENCES "Role"("key") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RoleAuditLog"
  ADD CONSTRAINT "RoleAuditLog_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleAuditLog"
  ADD CONSTRAINT "RoleAuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership"
  ADD CONSTRAINT "CommunityMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership"
  ADD CONSTRAINT "CommunityMembership_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Baseline Role catalog rows so User.role foreign key is valid immediately after migration
INSERT INTO "Role" ("id", "key", "displayName", "description", "rank")
VALUES
  ('role_visitor', 'VISITOR', 'Visitor', 'Browse Discover and public community pages', 0),
  ('role_member', 'MEMBER', 'Member', 'Watch sessions, chat, vote in polls, and join open rooms', 1),
  ('role_speaker', 'SPEAKER', 'Speaker', 'Approved to publish camera, mic, and screen share', 2),
  ('role_moderator', 'MODERATOR', 'Moderator', 'Moderate chat, pin/delete messages, and manage slow mode', 3),
  ('role_host', 'HOST', 'Host', 'Run sessions, promote speakers, and manage room controls', 4),
  ('role_lecturer', 'LECTURER', 'Lecturer', 'Create private virtual classes and export attendance CSVs', 4),
  ('role_admin', 'ADMIN', 'Admin', 'Manage all users, roles, communities, and platform reports', 5)
ON CONFLICT ("key") DO NOTHING;
