import fs from 'node:fs';
import path from 'node:path';
import type {
  AttendanceRecord,
  AuthUser,
  CaptionLine,
  ChatMessage,
  Community,
  CommunityPost,
  KabSession,
  LivePoll,
  ModerationReport,
  QaQuestion,
  RoleAuditEntry,
  SessionWorkspace,
  SiteFooterConfig,
  UserRole,
} from '../src/types/kabmeet';

export interface StoredUser extends AuthUser {
  passwordHash: string | null;
  isActive: boolean;
}

export interface StoredSessionToken {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

export interface SessionModerationState {
  chatLocked: boolean;
  slowModeSeconds: number;
  blockedWords: string[];
  pinnedMessageId: string | null;
  peakViewers: number;
  endedForAll: boolean;
}

export interface KabmeetStoreData {
  adminClaimed: boolean;
  users: StoredUser[];
  tokens: StoredSessionToken[];
  communities: Community[];
  communityFollows: Record<string, string[]>; // slug -> userIds
  posts: CommunityPost[];
  sessions: KabSession[];
  reminders: Record<string, string[]>; // sessionId -> userIds
  moderation: Record<string, SessionModerationState>;
  messages: Record<string, ChatMessage[]>;
  questions: Record<string, QaQuestion[]>;
  polls: Record<string, LivePoll[]>;
  workspaces: Record<string, SessionWorkspace>;
  captions: Record<string, CaptionLine[]>;
  attendance: AttendanceRecord[];
  reports: ModerationReport[];
  roleAuditLog: RoleAuditEntry[];
  siteFooter: SiteFooterConfig;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'kabmeet-store.json');

export function createDefaultSiteFooter(): SiteFooterConfig {
  return {
    tagline:
      'Kabale University AI Club & IndabaX · Self-hosted live sessions and labs at ai.kab.ac.ug/indabax',
    docsLabel: 'KAB AI Docs',
    docsUrl: 'https://ai.kab.ac.ug/indabax',
    githubLabel: 'GitHub Repository',
    githubUrl: 'https://github.com/kabale-ai/kabmeet',
    contactEmail: 'indabax@kab.ac.ug',
    contactPhone: '+256 392 890 120',
    campusLocation: 'Kikungiri Hill, Kabale University, Uganda',
    updatedAt: new Date().toISOString(),
  };
}

function createInitialStore(): KabmeetStoreData {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

  return {
    adminClaimed: false,
    users: [
      {
        id: 'usr-lecturer-1',
        email: 'samuel.byamukama@kab.ac.ug',
        universityId: 'KAB/LEC/014',
        fullName: 'Dr. Samuel Byamukama',
        department: 'Artificial Intelligence',
        role: 'LECTURER',
        passwordHash: null,
        isActive: true,
        createdAt: iso(-86400_000 * 30),
      },
      {
        id: 'usr-host-1',
        email: 'aisha.namukasa@kab.ac.ug',
        universityId: '2024/BCS/012',
        fullName: 'Aisha Namukasa',
        department: 'Computer Science',
        role: 'HOST',
        passwordHash: null,
        isActive: true,
        createdAt: iso(-86400_000 * 24),
      },
      {
        id: 'usr-mod-1',
        email: 'brian.mugisha@kab.ac.ug',
        universityId: '2024/BIT/038',
        fullName: 'Brian Mugisha',
        department: 'Information Technology',
        role: 'MODERATOR',
        passwordHash: null,
        isActive: true,
        createdAt: iso(-86400_000 * 20),
      },
      {
        id: 'usr-member-1',
        email: 'sarah.katushabe@kab.ac.ug',
        universityId: '2023/BCS/045',
        fullName: 'Sarah Katushabe',
        department: 'Data Science',
        role: 'SPEAKER',
        passwordHash: null,
        isActive: true,
        createdAt: iso(-86400_000 * 14),
      },
      {
        id: 'usr-member-2',
        email: 'daniel.twinomujuni@kab.ac.ug',
        universityId: '2025/BCS/104',
        fullName: 'Daniel Twinomujuni',
        department: 'Computer Science',
        role: 'MEMBER',
        passwordHash: null,
        isActive: true,
        createdAt: iso(-86400_000 * 10),
      },
    ],
    tokens: [],
    communities: [
      {
        id: 'com-indabax',
        slug: 'indabax',
        name: 'IndabaX Kabale',
        description:
          'Deep Learning IndabaX chapter at Kabale University. Weekly paper reading groups, Python labs, and research talks.',
        accentColor: 'deep-green',
        memberCount: 248,
      },
      {
        id: 'com-kabai',
        slug: 'kab-ai',
        name: 'KAB AI Club',
        description:
          'Student builders shipping practical AI, computer vision, and agricultural ML tools in southwestern Uganda.',
        accentColor: 'kab-blue',
        memberCount: 312,
      },
      {
        id: 'com-huawei',
        slug: 'huawei-student-club',
        name: 'Huawei Student Club',
        description:
          'HCIA routing, switching, 5G fundamentals, and ICT competition study circles.',
        accentColor: 'deep-green',
        memberCount: 164,
      },
      {
        id: 'com-aws',
        slug: 'aws-cloud-club',
        name: 'AWS Cloud Club Kabale',
        description:
          'Hands-on cloud engineering, Linux systems, containers, and deployment clinics.',
        accentColor: 'kab-blue',
        memberCount: 195,
      },
    ],
    communityFollows: {
      indabax: ['usr-host-1', 'usr-member-1', 'usr-member-2'],
      'kab-ai': ['usr-host-1', 'usr-mod-1', 'usr-member-2'],
    },
    posts: [
      {
        id: 'post-1',
        communitySlug: 'indabax',
        authorName: 'Aisha Namukasa',
        authorRole: 'HOST',
        title: 'IndabaX Kabale Call for Lightning Demos',
        body: 'Bring a 5-minute notebook or local dataset demo for Friday afternoon. Beginners welcome—we will pair you with a mentor.',
        createdAt: iso(-3600_000 * 18),
      },
      {
        id: 'post-2',
        communitySlug: 'kab-ai',
        authorName: 'Brian Mugisha',
        authorRole: 'MODERATOR',
        title: 'Campus Wi-Fi Tip: Turn on Data Saver in Kabmeet',
        body: 'If you are joining from Kikungiri campus on mobile data, click Data saver in the top bar to switch rooms to audio-only / 360p.',
        createdAt: iso(-3600_000 * 42),
      },
    ],
    sessions: [
      {
        id: 'sess-ml-python',
        title: 'Intro to machine learning with Python',
        description:
          'Hands-on walkthrough of scikit-learn pipelines, train/test splits, and evaluating crop-disease classifiers with Kabale datasets.',
        communitySlug: 'indabax',
        communityName: 'IndabaX Kabale',
        hostId: 'usr-host-1',
        hostName: 'Aisha Namukasa',
        status: 'LIVE',
        mode: 'WATCH',
        contentType: 'ML_AI',
        scheduledAt: iso(-1800_000),
        startedAt: iso(-1800_000),
        thumbnailUrl: '/src/assets/images/session_ml_python_1795385728974.jpg',
        viewerCount: 1,
        peakViewers: 42,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
      },
      {
        id: 'sess-git-workshop',
        title: 'Git workshop for beginners',
        description:
          'Interactive room for first-year students: branching, pull requests, resolving merge conflicts, and pushing your first club project.',
        communitySlug: 'kab-ai',
        communityName: 'KAB AI Club',
        hostId: 'usr-host-1',
        hostName: 'Aisha Namukasa',
        status: 'LIVE',
        mode: 'ROOM',
        contentType: 'CODING_JAM',
        scheduledAt: iso(-900_000),
        startedAt: iso(-900_000),
        thumbnailUrl: '/src/assets/images/session_git_workshop_1795385728390.jpg',
        viewerCount: 1,
        peakViewers: 27,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
      },
      {
        id: 'sess-indabax-vision',
        title: 'Applied Computer Vision for East African Crops',
        description:
          'IndabaX Kabale hands-on seminar on leaf-disease detection, dataset augmentation, and lightweight edge inference for campus researchers.',
        communitySlug: 'indabax',
        communityName: 'IndabaX Kabale',
        hostId: 'usr-lecturer-1',
        hostName: 'Dr. Samuel Byamukama',
        status: 'UPCOMING',
        mode: 'WATCH',
        contentType: 'ML_AI',
        scheduledAt: iso(3600_000 * 4 + 25 * 60_000),
        startedAt: null,
        thumbnailUrl: '/src/assets/images/session_ml_python_1795385728974.jpg',
        viewerCount: 0,
        peakViewers: 0,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
      },
      {
        id: 'sess-kabai-pytorch',
        title: 'PyTorch Study Jam: Building Your First Classifier',
        description:
          'Collaborative KAB AI Club coding room covering tensors, autograd, and training loops from scratch.',
        communitySlug: 'kab-ai',
        communityName: 'KAB AI Club',
        hostId: 'usr-host-1',
        hostName: 'Aisha Namukasa',
        status: 'UPCOMING',
        mode: 'ROOM',
        contentType: 'CODING_JAM',
        scheduledAt: iso(3600_000 * 18),
        startedAt: null,
        thumbnailUrl: '/src/assets/images/session_git_workshop_1795385728390.jpg',
        viewerCount: 0,
        peakViewers: 0,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
      },
      {
        id: 'sess-cloud-jam',
        title: 'Deploying self-hosted apps with Docker & Nginx',
        description:
          'Learn how ai.kab.ac.ug routes Next.js, NestJS, and LiveKit behind HTTPS reverse proxies on university servers.',
        communitySlug: 'aws-cloud-club',
        communityName: 'AWS Cloud Club Kabale',
        hostId: 'usr-mod-1',
        hostName: 'Brian Mugisha',
        status: 'UPCOMING',
        mode: 'WATCH',
        contentType: 'CLOUD_INFRA',
        scheduledAt: iso(3600_000 * 24),
        startedAt: null,
        thumbnailUrl: '/src/assets/images/session_cloud_lab_1795385729506.jpg',
        viewerCount: 0,
        peakViewers: 0,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
      },
      {
        id: 'sess-community-townhall',
        title: 'Kabale Tech Clubs Open Townhall & Lightning Talks',
        description:
          'Open community meetup across IndabaX, KAB AI, and Huawei Student Club to pitch project ideas and welcome new members.',
        communitySlug: 'huawei-student-club',
        communityName: 'Huawei Student Club',
        hostId: 'usr-member-1',
        hostName: 'Sarah Katushabe',
        status: 'UPCOMING',
        mode: 'WATCH',
        contentType: 'COMMUNITY_TALK',
        scheduledAt: iso(3600_000 * 30),
        startedAt: null,
        thumbnailUrl: '/src/assets/images/hero_indabax_campus_1795385728289.jpg',
        viewerCount: 0,
        peakViewers: 0,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
      },
      {
        id: 'sess-indaba-replay',
        title: 'Neural networks from scratch — Lab Replay',
        description:
          'Full recording with synced code notes and Q&A from last week’s IndabaX Kabale foundations seminar.',
        communitySlug: 'indabax',
        communityName: 'IndabaX Kabale',
        hostId: 'usr-lecturer-1',
        hostName: 'Dr. Samuel Byamukama',
        status: 'REPLAY',
        mode: 'WATCH',
        contentType: 'ML_AI',
        scheduledAt: iso(-86400_000 * 3),
        startedAt: iso(-86400_000 * 3),
        thumbnailUrl: '/src/assets/images/hero_indabax_campus_1795385728289.jpg',
        viewerCount: 0,
        peakViewers: 68,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
        replayDurationSec: 2740,
      },
      {
        id: 'class-bcs-3104',
        title: 'BCS 3104 — Applied Machine Learning Seminar',
        description:
          'Restricted virtual class for enrolled Year 3 BCS students. Attendance is logged automatically for coursework credit.',
        communitySlug: 'kab-ai',
        communityName: 'KAB AI Club',
        hostId: 'usr-lecturer-1',
        hostName: 'Dr. Samuel Byamukama',
        status: 'LIVE',
        mode: 'CLASS',
        scheduledAt: iso(-1200_000),
        startedAt: iso(-1200_000),
        thumbnailUrl: '/src/assets/images/hero_indabax_campus_1795385728289.jpg',
        viewerCount: 0,
        peakViewers: 18,
        isPrivateClass: true,
        courseCode: 'BCS 3104',
        allowedStudents: [
          'sarah.katushabe@kab.ac.ug',
          'daniel.twinomujuni@kab.ac.ug',
          '2023/BCS/045',
          '2025/BCS/104',
        ],
      },
    ],
    reminders: {},
    moderation: {
      'sess-ml-python': {
        chatLocked: false,
        slowModeSeconds: 0,
        blockedWords: ['spamword'],
        pinnedMessageId: 'msg-1',
        peakViewers: 42,
        endedForAll: false,
      },
      'sess-git-workshop': {
        chatLocked: false,
        slowModeSeconds: 0,
        blockedWords: [],
        pinnedMessageId: null,
        peakViewers: 27,
        endedForAll: false,
      },
      'class-bcs-3104': {
        chatLocked: false,
        slowModeSeconds: 0,
        blockedWords: [],
        pinnedMessageId: null,
        peakViewers: 18,
        endedForAll: false,
      },
    },
    messages: {
      'sess-ml-python': [
        {
          id: 'msg-1',
          sessionId: 'sess-ml-python',
          userId: 'usr-host-1',
          userName: 'Aisha Namukasa',
          userRole: 'HOST',
          text: 'Welcome to IndabaX Kabale! Open the Workspace tab on the right to follow the scikit-learn notebook live.',
          pinned: true,
          upvotes: 14,
          createdAt: iso(-1200_000),
        },
        {
          id: 'msg-2',
          sessionId: 'sess-ml-python',
          userId: 'usr-member-1',
          userName: 'Sarah Katushabe',
          userRole: 'SPEAKER',
          text: 'Audio is super clear from Kikungiri lab. Ready for the feature scaling demo!',
          upvotes: 6,
          createdAt: iso(-600_000),
        },
        {
          id: 'msg-3',
          sessionId: 'sess-ml-python',
          userId: 'usr-member-2',
          userName: 'Daniel Twinomujuni',
          userRole: 'MEMBER',
          text: 'Question: should we normalize pixel values before splitting train and validation sets?',
          upvotes: 9,
          createdAt: iso(-240_000),
        },
      ],
      'sess-git-workshop': [
        {
          id: 'msg-git-1',
          sessionId: 'sess-git-workshop',
          userId: 'usr-host-1',
          userName: 'Aisha Namukasa',
          userRole: 'HOST',
          text: 'Raise your hand if you want to share your terminal on stage to debug a merge conflict.',
          pinned: true,
          upvotes: 5,
          createdAt: iso(-420_000),
        },
      ],
    },
    questions: {
      'sess-ml-python': [
        {
          id: 'qa-1',
          sessionId: 'sess-ml-python',
          authorId: 'usr-member-2',
          authorName: 'Daniel Twinomujuni',
          text: 'How do we avoid data leakage when using StandardScaler in scikit-learn?',
          upvoterIds: ['usr-host-1', 'usr-member-1'],
          answered: false,
          createdAt: iso(-500_000),
        },
      ],
    },
    polls: {
      'sess-ml-python': [
        {
          id: 'poll-1',
          sessionId: 'sess-ml-python',
          question: 'Which topic should IndabaX cover next Friday?',
          options: [
            { id: 'opt-1', label: 'Computer vision for leaf disease detection', voterIds: ['usr-host-1', 'usr-member-1'] },
            { id: 'opt-2', label: 'Fine-tuning small Luganda/Runyankole NLP models', voterIds: ['usr-member-2'] },
            { id: 'opt-3', label: 'Deploying FastAPI models on campus servers', voterIds: [] },
          ],
          closed: false,
          createdAt: iso(-800_000),
        },
      ],
    },
    workspaces: {
      'sess-ml-python': {
        notes:
          '# IndabaX Lab Notes: Crop Classifier\n\n- Always fit `StandardScaler` ONLY on `X_train` inside a `Pipeline`.\n- Compare F1-score alongside accuracy when classes are imbalanced.\n- Next session: export ONNX weights for low-bandwidth campus inference.',
        codeLanguage: 'python',
        code: `from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

# Fit scaling strictly inside training folds to prevent leakage
model = make_pipeline(
    StandardScaler(),
    LogisticRegression(max_iter=500, class_weight="balanced"),
)
print("Pipeline ready for Kabale dataset training")`,
        tasks: [
          { id: 'task-1', title: 'Clone indabax-kabale/ml-starter repo', assignee: 'All members', done: true },
          { id: 'task-2', title: 'Build stratified 80/20 train-test split', assignee: 'Sarah Katushabe', done: false },
          { id: 'task-3', title: 'Plot confusion matrix in notebook', assignee: 'Daniel Twinomujuni', done: false },
        ],
      },
      'sess-indaba-replay': {
        notes:
          '# Replay Notes: Neural Networks from Scratch\n\n- Backpropagation chain rule step-by-step.\n- Cross-entropy loss stability with log-sum-exp.',
        codeLanguage: 'python',
        code: `import numpy as np

def relu(x):
    return np.maximum(0, x)

def softmax(logits):
    shifted = logits - np.max(logits, axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=-1, keepdims=True)`,
        tasks: [
          { id: 'task-r1', title: 'Review matrix shapes in backward pass', assignee: 'Cohort A', done: true },
        ],
      },
    },
    captions: {
      'sess-indaba-replay': [
        {
          id: 'cap-1',
          speakerName: 'Dr. Samuel Byamukama',
          text: 'Notice how keeping our preprocessing inside a scikit-learn Pipeline guarantees zero leakage during cross-validation.',
          timestamp: '04:12',
        },
        {
          id: 'cap-2',
          speakerName: 'Dr. Samuel Byamukama',
          text: 'Let us inspect the validation F1 score on our highland maize leaf samples before tuning regularization.',
          timestamp: '04:28',
        },
      ],
    },
    attendance: [
      {
        id: 'att-1',
        classId: 'class-bcs-3104',
        userId: 'usr-member-1',
        universityId: '2023/BCS/045',
        fullName: 'Sarah Katushabe',
        email: 'sarah.katushabe@kab.ac.ug',
        joinedAt: iso(-1150_000),
        lastSeenAt: iso(-60_000),
        durationSeconds: 1090,
      },
      {
        id: 'att-2',
        classId: 'class-bcs-3104',
        userId: 'usr-member-2',
        universityId: '2025/BCS/104',
        fullName: 'Daniel Twinomujuni',
        email: 'daniel.twinomujuni@kab.ac.ug',
        joinedAt: iso(-900_000),
        lastSeenAt: iso(-30_000),
        durationSeconds: 870,
      },
    ],
    reports: [
      {
        id: 'rep-1',
        sessionId: 'sess-ml-python',
        sessionTitle: 'Intro to machine learning with Python',
        reporterName: 'Brian Mugisha',
        reason: 'Off-topic promotional link posted in chat (already removed by moderator).',
        status: 'RESOLVED',
        createdAt: iso(-3600_000 * 5),
      },
    ],
    roleAuditLog: [
      {
        id: 'audit-1',
        targetName: 'Aisha Namukasa',
        actorName: 'Dr. Samuel Byamukama',
        previousRole: 'MEMBER',
        newRole: 'HOST',
        createdAt: iso(-86400_000 * 12),
      },
    ],
    siteFooter: createDefaultSiteFooter(),
  };
}

class StoreManager {
  private data: KabmeetStoreData;

  constructor() {
    this.data = this.load();
  }

  private load(): KabmeetStoreData {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as KabmeetStoreData;
        let dirty = false;
        if (!parsed.siteFooter) {
          parsed.siteFooter = createDefaultSiteFooter();
          dirty = true;
        }
        const now = Date.now();
        const hasUpcomingIndabaOrKabAi = parsed.sessions.some(
          (s) =>
            (s.communitySlug === 'indabax' || s.communitySlug === 'kab-ai') &&
            s.status === 'UPCOMING' &&
            !s.isPrivateClass &&
            new Date(s.scheduledAt).getTime() > now,
        );
        if (!hasUpcomingIndabaOrKabAi) {
          const fresh = createInitialStore();
          const defaultsToAdd = fresh.sessions.filter(
            (s) =>
              (s.id === 'sess-indabax-vision' || s.id === 'sess-kabai-pytorch') &&
              !parsed.sessions.some((existing) => existing.id === s.id),
          );
          if (defaultsToAdd.length > 0) {
            parsed.sessions.push(...defaultsToAdd);
            dirty = true;
          }
        }
        const hasCommunityTalkSeed = parsed.sessions.some(
          (s) => s.id === 'sess-community-townhall',
        );
        if (!hasCommunityTalkSeed) {
          const fresh = createInitialStore();
          const townhall = fresh.sessions.find((s) => s.id === 'sess-community-townhall');
          if (townhall) {
            parsed.sessions.push(townhall);
            dirty = true;
          }
        }
        if (dirty) {
          this.save(parsed);
        }
        return parsed;
      }
    } catch {
      // Fallback to fresh store if corrupted
    }
    const fresh = createInitialStore();
    this.save(fresh);
    return fresh;
  }

  get state(): KabmeetStoreData {
    return this.data;
  }

  save(next?: KabmeetStoreData): void {
    if (next) this.data = next;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf8');
  }

  getModeration(sessionId: string): SessionModerationState {
    if (!this.data.moderation[sessionId]) {
      this.data.moderation[sessionId] = {
        chatLocked: false,
        slowModeSeconds: 0,
        blockedWords: [],
        pinnedMessageId: null,
        peakViewers: 0,
        endedForAll: false,
      };
    }
    return this.data.moderation[sessionId];
  }

  getWorkspace(sessionId: string): SessionWorkspace {
    if (!this.data.workspaces[sessionId]) {
      this.data.workspaces[sessionId] = {
        notes: '# Shared Session Notes\n\nCollaborate here in real time with participants.',
        codeLanguage: 'python',
        code: '# Shared code pad\nprint("Hello from Kabale University!")\n',
        tasks: [],
      };
    }
    return this.data.workspaces[sessionId];
  }
}

export const store = new StoreManager();
export type { UserRole };
