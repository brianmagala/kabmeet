export type UserRole =
  | 'VISITOR'
  | 'MEMBER'
  | 'SPEAKER'
  | 'MODERATOR'
  | 'HOST'
  | 'LECTURER'
  | 'ADMIN';

export type SessionStatus = 'LIVE' | 'UPCOMING' | 'REPLAY';
export type SessionMode = 'WATCH' | 'ROOM' | 'CLASS';

export interface AuthUser {
  id: string;
  email: string;
  universityId: string | null;
  fullName: string;
  nickname?: string | null;
  department: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  createdAt: string;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  accentColor: 'deep-green' | 'kab-blue';
  memberCount: number;
  isFollowing?: boolean;
}

export interface CommunityPost {
  id: string;
  communitySlug: string;
  authorName: string;
  authorRole: UserRole;
  title: string;
  body: string;
  createdAt: string;
}

export interface KabSession {
  id: string;
  title: string;
  description: string;
  communitySlug: string;
  communityName: string;
  hostId: string;
  hostName: string;
  status: SessionStatus;
  mode: SessionMode;
  scheduledAt: string;
  startedAt: string | null;
  thumbnailUrl: string;
  viewerCount: number;
  peakViewers: number;
  isPrivateClass: boolean;
  courseCode: string | null;
  allowedStudents: string[];
  canJoin?: boolean;
  reminded?: boolean;
  replayDurationSec?: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  text: string;
  stickerId?: string;
  pinned?: boolean;
  upvotes: number;
  createdAt: string;
}

export interface QaQuestion {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  text: string;
  upvoterIds: string[];
  answered: boolean;
  createdAt: string;
}

export interface PollOption {
  id: string;
  label: string;
  voterIds: string[];
}

export interface LivePoll {
  id: string;
  sessionId: string;
  question: string;
  options: PollOption[];
  closed: boolean;
  createdAt: string;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  assignee: string;
  done: boolean;
}

export interface SessionWorkspace {
  notes: string;
  codeLanguage: 'python' | 'typescript' | 'bash';
  code: string;
  tasks: WorkspaceTask[];
}

export interface CaptionLine {
  id: string;
  speakerName: string;
  text: string;
  timestamp: string;
}

export interface RoomParticipant {
  clientId: string;
  userId: string;
  fullName: string;
  role: UserRole;
  micOn: boolean;
  camOn: boolean;
  screenSharing: boolean;
  sharedSlideUrl?: string | null;
  isSpeaker: boolean;
  handRaised: boolean;
  mutedByHost: boolean;
  speaking: boolean;
}

export interface WaitingGuest {
  clientId: string;
  userId: string;
  fullName: string;
  requestedAt: string;
}

export interface SessionRealtimeState {
  sessionId: string;
  viewerCount: number;
  peakViewers: number;
  chatLocked: boolean;
  slowModeSeconds: number;
  blockedWords: string[];
  endedForAll: boolean;
  pinnedMessageId: string | null;
  messages: ChatMessage[];
  questions: QaQuestion[];
  polls: LivePoll[];
  workspace: SessionWorkspace;
  captions: CaptionLine[];
  participants: RoomParticipant[];
  waitingRoom: WaitingGuest[];
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  userId: string;
  universityId: string;
  fullName: string;
  email: string;
  joinedAt: string;
  lastSeenAt: string;
  durationSeconds: number;
}

export interface ModerationReport {
  id: string;
  sessionId: string;
  sessionTitle: string;
  reporterName: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
}

export interface RoleAuditEntry {
  id: string;
  targetName: string;
  actorName: string;
  previousRole: UserRole;
  newRole: UserRole;
  createdAt: string;
}
