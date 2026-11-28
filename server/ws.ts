import { isSameOrigin, sessionTokenFromCookies } from './session-cookie';
import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { hashToken, isStaffOrHost } from './auth';
import { notifyAward, notifyHandApproved, setNotificationListener } from './notifications';
import {
  presenceEnter,
  startPresenceCheckpoint,
  presenceLeave,
  recordChat,
  recordPollVote,
  recordQuestion,
  recordReaction,
  setAwardNotifier,
} from './engagement';
import { store, type StoredUser } from './store';
import { getVideoProvider, type PublishRights } from './video';
import type {
  KabSession,
  RoomParticipant,
  SessionRealtimeState,
  UserRole,
  WaitingGuest,
} from '../src/types/kabmeet';

interface ClientMeta {
  ws: WebSocket;
  clientId: string;
  sessionId: string;
  user: StoredUser | null;
  lastChatAt: number;
  /** Who engagement is counting this connection for (null = visitor). Kept in step with `user`. */
  presenceUserId: string | null;
  /** The Host Panel watches the room to moderate it. That is not the same as attending. */
  monitor: boolean;
}

const roomParticipants = new Map<string, Map<string, RoomParticipant>>();
const waitingRooms = new Map<string, Map<string, WaitingGuest>>();
const sessionClients = new Map<string, Set<ClientMeta>>();

function getSessionUsers(sessionId: string): Set<ClientMeta> {
  let set = sessionClients.get(sessionId);
  if (!set) {
    set = new Set();
    sessionClients.set(sessionId, set);
  }
  return set;
}

/** How many connections are open in a session right now. */
export function getLiveViewerCount(sessionId: string): number {
  let n = 0;
  for (const c of sessionClients.get(sessionId) ?? []) if (!c.monitor) n++;
  return n;
}

/** After sign-in or sign-out on an open connection, move engagement's count to the new person. */
function switchPresenceUser(meta: ClientMeta): void {
  if (meta.monitor) return;
  const next = meta.user?.id ?? null;
  if (meta.presenceUserId === next) return;
  const viewers = getLiveViewerCount(meta.sessionId);
  presenceLeave(meta.sessionId, meta.presenceUserId, viewers);
  presenceEnter(meta.sessionId, next, viewers);
  meta.presenceUserId = next;
}

function getRoomParticipants(sessionId: string): Map<string, RoomParticipant> {
  let map = roomParticipants.get(sessionId);
  if (!map) {
    map = new Map();
    roomParticipants.set(sessionId, map);
  }
  return map;
}

function getWaitingMap(sessionId: string): Map<string, WaitingGuest> {
  let map = waitingRooms.get(sessionId);
  if (!map) {
    map = new Map();
    waitingRooms.set(sessionId, map);
  }
  return map;
}

/**
 * Staff, approved speakers and everyone in a private class skip the waiting room.
 * Shared by the websocket (room:join) and the video token route, so both agree.
 */
export function isAutoAdmitted(user: StoredUser, session: KabSession | undefined): boolean {
  return isStaffOrHost(user.role) || user.role === 'SPEAKER' || Boolean(session?.isPrivateClass);
}

export type RoomSeat =
  | { state: 'waiting' }
  | { state: 'admitted'; isSpeaker: boolean; mutedByHost: boolean };

/** Where this person stands in the room right now. Null means they have not joined. */
export function getRoomSeat(sessionId: string, userId: string): RoomSeat | null {
  const seats = Array.from(getRoomParticipants(sessionId).values()).filter((p) => p.userId === userId);
  if (seats.length > 0) {
    return {
      state: 'admitted',
      isSpeaker: seats.some((p) => p.isSpeaker),
      mutedByHost: seats.some((p) => p.mutedByHost),
    };
  }
  const waiting = Array.from(getWaitingMap(sessionId).values()).some((g) => g.userId === userId);
  return waiting ? { state: 'waiting' } : null;
}

/** What this person may send to the video room, worked out from their seat. */
function publishRightsFor(sessionId: string, userId: string): PublishRights {
  const seat = getRoomSeat(sessionId, userId);
  if (!seat || seat.state !== 'admitted') return { canPublish: false, canUseMicrophone: false };
  return { canPublish: seat.isSpeaker, canUseMicrophone: !seat.mutedByHost };
}

/** Tell the media server what this person may now do. Runs in the background. */
function syncVideoRights(sessionId: string, userId: string): void {
  void getVideoProvider().updateRights(sessionId, userId, publishRightsFor(sessionId, userId));
}

export function canUserAccessSession(sessionId: string, user: StoredUser | null): boolean {
  const session = store.state.sessions.find((s) => s.id === sessionId);
  if (!session) return false;
  if (!session.isPrivateClass) return true;
  if (!user) return false;
  if (user.role === 'ADMIN' || user.id === session.hostId) return true;
  const emailMatch = session.allowedStudents.some(
    (entry) => entry.toLowerCase() === user.email.toLowerCase(),
  );
  const idMatch =
    Boolean(user.universityId) &&
    session.allowedStudents.some(
      (entry) => entry.toLowerCase() === user.universityId!.toLowerCase(),
    );
  return emailMatch || idMatch;
}

export function buildRealtimeSnapshot(sessionId: string): SessionRealtimeState {
  const clients = sessionClients.get(sessionId);
  const mod = store.getModeration(sessionId);
  const liveCount = Math.max(getLiveViewerCount(sessionId), 1);
  if (liveCount > mod.peakViewers) {
    mod.peakViewers = liveCount;
    const sess = store.state.sessions.find((s) => s.id === sessionId);
    if (sess) {
      sess.viewerCount = liveCount;
      sess.peakViewers = Math.max(sess.peakViewers, mod.peakViewers);
    }
    store.save();
  }

  return {
    sessionId,
    viewerCount: getLiveViewerCount(sessionId),
    peakViewers: mod.peakViewers,
    chatLocked: mod.chatLocked,
    slowModeSeconds: mod.slowModeSeconds,
    blockedWords: mod.blockedWords,
    endedForAll: mod.endedForAll,
    pinnedMessageId: mod.pinnedMessageId,
    messages: store.state.messages[sessionId] ?? [],
    questions: store.state.questions[sessionId] ?? [],
    polls: store.state.polls[sessionId] ?? [],
    workspace: store.getWorkspace(sessionId),
    captions: store.state.captions[sessionId] ?? [],
    participants: Array.from(getRoomParticipants(sessionId).values()),
    waitingRoom: Array.from(getWaitingMap(sessionId).values()),
  };
}

export function broadcastToSession(sessionId: string, event: string, payload: unknown): void {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const packet = JSON.stringify({ event, payload });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(packet);
    }
  }
}

function resolveUserFromToken(token: string | null): StoredUser | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const record = store.state.tokens.find(
    (t) => t.tokenHash === tokenHash && new Date(t.expiresAt) > new Date(),
  );
  if (!record) return null;
  const user = store.state.users.find((u) => u.id === record.userId && u.isActive);
  return user ?? null;
}

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event: 'error', payload: { message } }));
  }
}

export function attachWebSocketServer(httpServer: HttpServer): void {
  // Room slides are sent as images (up to 550 KB of text), so the limit sits just above that.
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 640 * 1024 });

  startPresenceCheckpoint();

  // The bell refreshes at once on any page that has a connection open (other pages poll).
  setNotificationListener((userId, n) => {
    const packet = JSON.stringify({ event: 'notification:new', payload: { id: n.id, kind: n.kind } });
    for (const set of sessionClients.values()) {
      for (const c of set) {
        if (c.user?.id === userId && c.ws.readyState === WebSocket.OPEN) c.ws.send(packet);
      }
    }
  });

  // Badges and streaks are told to the person on every connection they have open.
  setAwardNotifier((userId, notice) => {
    notifyAward(userId, notice); // also lands in the bell (and push, if allowed)
    const packet = JSON.stringify({ event: 'engagement:award', payload: notice });
    for (const set of sessionClients.values()) {
      for (const c of set) {
        if (c.user?.id === userId && c.ws.readyState === WebSocket.OPEN) c.ws.send(packet);
      }
    }
  });

  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url ?? '/ws', 'http://localhost');
    const sessionId = reqUrl.searchParams.get('sessionId') ?? '';
    // Sign-in comes from the ?token= query (old way, removed in Task 8) or the httpOnly session cookie.
    // A cookie is sent by the browser for any page, so a cookie sign-in is only accepted from our own origin
    // (otherwise another site could open a socket as the signed-in person).
    const queryToken = reqUrl.searchParams.get('token');
    const cookieToken = queryToken ? null : sessionTokenFromCookies(req.headers);
    const originOk = isSameOrigin(req.headers.origin, req.headers.host, req.headers['x-forwarded-host']);
    const user = resolveUserFromToken(queryToken ?? (originOk ? cookieToken : null));
    const monitor = reqUrl.searchParams.get('monitor') === '1';

    if (!sessionId || !canUserAccessSession(sessionId, user)) {
      sendError(ws, 'You do not have permission to enter this session.');
      ws.close(1008, 'Unauthorized');
      return;
    }

    const clientId = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const meta: ClientMeta = {
      ws,
      clientId,
      sessionId,
      user,
      lastChatAt: 0,
      presenceUserId: monitor ? null : (user?.id ?? null),
      monitor,
    };

    const clients = getSessionUsers(sessionId);
    clients.add(meta);
    if (!meta.monitor) presenceEnter(sessionId, meta.presenceUserId, getLiveViewerCount(sessionId));

    // Update session live viewer count
    const sess = store.state.sessions.find((s) => s.id === sessionId);
    const mod = store.getModeration(sessionId);
    if (sess) {
      const liveNow = getLiveViewerCount(sessionId);
      sess.viewerCount = liveNow;
      if (liveNow > mod.peakViewers) {
        mod.peakViewers = liveNow;
        sess.peakViewers = Math.max(sess.peakViewers, mod.peakViewers);
      }
      store.save();
    }

    // Send initial authoritative state to connecting client
    ws.send(
      JSON.stringify({
        event: 'session:init',
        payload: {
          clientId,
          snapshot: buildRealtimeSnapshot(sessionId),
        },
      }),
    );

    broadcastToSession(sessionId, 'presence:update', {
      viewerCount: getLiveViewerCount(sessionId),
      peakViewers: mod.peakViewers,
    });

    ws.on('message', (raw) => {
      let parsed: { event?: string; payload?: Record<string, unknown> };
      try {
        parsed = JSON.parse(raw.toString()) as { event?: string; payload?: Record<string, unknown> };
      } catch {
        return;
      }

      const event = parsed.event;
      const payload = parsed.payload ?? {};
      const actor = meta.user;
      const role: UserRole = actor?.role ?? 'VISITOR';

      if (event === 'auth:refresh') {
        meta.user = resolveUserFromToken(typeof payload.token === 'string' ? payload.token : null);
        switchPresenceUser(meta);
        return;
      }

      // Require authenticated Member+ for any mutation
      if (!actor || role === 'VISITOR') {
        sendError(ws, 'Please sign in as a member to participate.');
        return;
      }

      const currentMod = store.getModeration(sessionId);

      // Chat message
      if (event === 'chat:send') {
        if (currentMod.chatLocked && !isStaffOrHost(role)) {
          sendError(ws, 'Chat is currently locked by the host.');
          return;
        }
        const now = Date.now();
        if (
          currentMod.slowModeSeconds > 0 &&
          !isStaffOrHost(role) &&
          now - meta.lastChatAt < currentMod.slowModeSeconds * 1000
        ) {
          sendError(ws, `Slow mode is active (${currentMod.slowModeSeconds}s between messages).`);
          return;
        }
        let text = String(payload.text ?? '').trim().slice(0, 400);
        const stickerId = typeof payload.stickerId === 'string' ? payload.stickerId : undefined;
        if (!text && !stickerId) return;

        for (const word of currentMod.blockedWords) {
          if (word.trim()) {
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(escaped, 'gi'), '***');
          }
        }

        meta.lastChatAt = now;
        const displayName = actor.nickname?.trim() || actor.fullName;
        const msg = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          userId: actor.id,
          userName: displayName,
          userRole: actor.role,
          text,
          stickerId,
          upvotes: 0,
          createdAt: new Date().toISOString(),
        };
        if (!store.state.messages[sessionId]) store.state.messages[sessionId] = [];
        store.state.messages[sessionId].push(msg);
        recordChat(actor.id, sessionId);
        store.save();
        broadcastToSession(sessionId, 'chat:message', msg);
        return;
      }

      if (event === 'chat:upvote') {
        const msgId = String(payload.messageId ?? '');
        const list = store.state.messages[sessionId] ?? [];
        const target = list.find((m) => m.id === msgId);
        if (target) {
          target.upvotes += 1;
          store.save();
          broadcastToSession(sessionId, 'chat:upvoted', { messageId: msgId, upvotes: target.upvotes });
        }
        return;
      }

      if (event === 'reaction:heart') {
        const ALLOWED_REACTIONS = new Set(['❤️', '🔥', '👏', '🙌', '😂', '😮', '🚀', '💯']);
        const rawEmoji = typeof payload.emoji === 'string' ? payload.emoji.trim() : '❤️';
        const emoji = ALLOWED_REACTIONS.has(rawEmoji) ? rawEmoji : '❤️';
        const rawLeft =
          typeof payload.leftPercent === 'number' && Number.isFinite(payload.leftPercent)
            ? Math.max(8, Math.min(92, Math.round(payload.leftPercent)))
            : undefined;
        const burstId =
          typeof payload.id === 'string' && /^[a-zA-Z0-9_-]{4,48}$/.test(payload.id)
            ? payload.id
            : `rxn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        recordReaction(sessionId);
        broadcastToSession(sessionId, 'reaction:heart', {
          id: burstId,
          emoji,
          leftPercent: rawLeft,
          userName: actor.nickname?.trim() || actor.fullName,
        });
        return;
      }

      // Host / Moderator chat controls
      if (event === 'chat:pin') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts or moderators can pin messages.');
          return;
        }
        const messageId = typeof payload.messageId === 'string' ? payload.messageId : null;
        currentMod.pinnedMessageId = currentMod.pinnedMessageId === messageId ? null : messageId;
        const list = store.state.messages[sessionId] ?? [];
        for (const m of list) {
          m.pinned = m.id === currentMod.pinnedMessageId;
        }
        store.save();
        broadcastToSession(sessionId, 'moderation:update', currentMod);
        return;
      }

      if (event === 'chat:delete') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts or moderators can delete messages.');
          return;
        }
        const messageId = String(payload.messageId ?? '');
        store.state.messages[sessionId] = (store.state.messages[sessionId] ?? []).filter(
          (m) => m.id !== messageId,
        );
        if (currentMod.pinnedMessageId === messageId) currentMod.pinnedMessageId = null;
        store.save();
        broadcastToSession(sessionId, 'chat:deleted', { messageId });
        return;
      }

      if (event === 'host:moderation') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts or moderators can change room settings.');
          return;
        }
        if (typeof payload.chatLocked === 'boolean') currentMod.chatLocked = payload.chatLocked;
        if (typeof payload.slowModeSeconds === 'number') {
          currentMod.slowModeSeconds = Math.max(0, Math.min(120, payload.slowModeSeconds));
        }
        if (Array.isArray(payload.blockedWords)) {
          currentMod.blockedWords = payload.blockedWords
            .map((w) => String(w).trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 50);
        }
        store.save();
        broadcastToSession(sessionId, 'moderation:update', currentMod);
        return;
      }

      // Q&A
      if (event === 'qa:ask') {
        const text = String(payload.text ?? '').trim().slice(0, 320);
        if (!text) return;
        const q = {
          id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          authorId: actor.id,
          authorName: actor.nickname?.trim() || actor.fullName,
          text,
          upvoterIds: [actor.id],
          answered: false,
          createdAt: new Date().toISOString(),
        };
        if (!store.state.questions[sessionId]) store.state.questions[sessionId] = [];
        store.state.questions[sessionId].push(q);
        recordQuestion(actor.id, sessionId);
        store.save();
        broadcastToSession(sessionId, 'qa:updated', store.state.questions[sessionId]);
        return;
      }

      if (event === 'qa:upvote') {
        const qId = String(payload.questionId ?? '');
        const list = store.state.questions[sessionId] ?? [];
        const target = list.find((q) => q.id === qId);
        if (target) {
          if (target.upvoterIds.includes(actor.id)) {
            target.upvoterIds = target.upvoterIds.filter((id) => id !== actor.id);
          } else {
            target.upvoterIds.push(actor.id);
          }
          store.save();
          broadcastToSession(sessionId, 'qa:updated', list);
        }
        return;
      }

      if (event === 'qa:answer') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts or moderators can mark Q&A questions answered.');
          return;
        }
        const qId = String(payload.questionId ?? '');
        const list = store.state.questions[sessionId] ?? [];
        const target = list.find((q) => q.id === qId);
        if (target) {
          target.answered = !target.answered;
          store.save();
          broadcastToSession(sessionId, 'qa:updated', list);
        }
        return;
      }

      // Polls
      if (event === 'poll:create') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts or moderators can launch polls.');
          return;
        }
        const question = String(payload.question ?? '').trim().slice(0, 180);
        const rawOpts = Array.isArray(payload.options) ? payload.options : [];
        const options = rawOpts
          .map((o) => String(o).trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 5)
          .map((label, idx) => ({ id: `opt-${Date.now()}-${idx}`, label, voterIds: [] }));
        if (!question || options.length < 2) return;
        const poll = {
          id: `poll-${Date.now()}`,
          sessionId,
          question,
          options,
          closed: false,
          createdAt: new Date().toISOString(),
        };
        if (!store.state.polls[sessionId]) store.state.polls[sessionId] = [];
        store.state.polls[sessionId].unshift(poll);
        store.save();
        broadcastToSession(sessionId, 'polls:updated', store.state.polls[sessionId]);
        return;
      }

      if (event === 'poll:vote') {
        const pollId = String(payload.pollId ?? '');
        const optionId = String(payload.optionId ?? '');
        const list = store.state.polls[sessionId] ?? [];
        const poll = list.find((p) => p.id === pollId);
        if (poll && !poll.closed) {
          for (const opt of poll.options) {
            opt.voterIds = opt.voterIds.filter((id) => id !== actor.id);
            if (opt.id === optionId) {
              opt.voterIds.push(actor.id);
            }
          }
          recordPollVote(actor.id, sessionId, poll.id);
          store.save();
          broadcastToSession(sessionId, 'polls:updated', list);
        }
        return;
      }

      // Room participation, waiting room & raise-hand speaker flow
      if (event === 'room:join') {
        const participants = getRoomParticipants(sessionId);
        const waiting = getWaitingMap(sessionId);
        const autoAdmit = isAutoAdmitted(actor, sess);

        const displayName = actor.nickname?.trim() || actor.fullName;
        if (!autoAdmit && payload.requireWaitingRoom !== false && !participants.has(meta.clientId)) {
          waiting.set(meta.clientId, {
            clientId: meta.clientId,
            userId: actor.id,
            fullName: displayName,
            requestedAt: new Date().toISOString(),
          });
          broadcastToSession(sessionId, 'room:state', {
            participants: Array.from(participants.values()),
            waitingRoom: Array.from(waiting.values()),
          });
          return;
        }

        const isSpeaker = isStaffOrHost(role) || role === 'SPEAKER';
        participants.set(meta.clientId, {
          clientId: meta.clientId,
          userId: actor.id,
          fullName: displayName,
          role: actor.role,
          micOn: Boolean(payload.micOn) && isSpeaker,
          camOn: Boolean(payload.camOn) && isSpeaker,
          screenSharing: false,
          isSpeaker,
          handRaised: false,
          mutedByHost: false,
          speaking: false,
        });
        // A returning person may still be connected to the media server with old rights.
        syncVideoRights(sessionId, actor.id);
        broadcastToSession(sessionId, 'room:state', {
          participants: Array.from(participants.values()),
          waitingRoom: Array.from(waiting.values()),
        });
        return;
      }

      if (event === 'room:admit_guest' || event === 'room:deny_guest') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts can manage the waiting room.');
          return;
        }
        const targetClientId = String(payload.clientId ?? '');
        const waiting = getWaitingMap(sessionId);
        const guest = waiting.get(targetClientId);
        if (guest) {
          waiting.delete(targetClientId);
          const participants = getRoomParticipants(sessionId);
          if (event === 'room:admit_guest') {
            participants.set(guest.clientId, {
              clientId: guest.clientId,
              userId: guest.userId,
              fullName: guest.fullName,
              role: 'MEMBER',
              micOn: false,
              camOn: false,
              screenSharing: false,
              isSpeaker: false,
              handRaised: false,
              mutedByHost: false,
              speaking: false,
            });
          } else {
            const guestClient = Array.from(clients).find((c) => c.clientId === targetClientId);
            if (guestClient) sendError(guestClient.ws, 'The host declined your request to enter the room.');
          }
          broadcastToSession(sessionId, 'room:state', {
            participants: Array.from(participants.values()),
            waitingRoom: Array.from(waiting.values()),
          });
        }
        return;
      }

      if (event === 'room:media_state') {
        const participants = getRoomParticipants(sessionId);
        const p = participants.get(meta.clientId);
        if (p) {
          if (typeof payload.micOn === 'boolean') p.micOn = p.isSpeaker ? payload.micOn && !p.mutedByHost : false;
          if (typeof payload.camOn === 'boolean') p.camOn = p.isSpeaker ? payload.camOn : false;
          if (typeof payload.screenSharing === 'boolean') p.screenSharing = p.isSpeaker ? payload.screenSharing : false;
          if (typeof payload.speaking === 'boolean') p.speaking = payload.speaking && p.micOn;
          if (payload.sharedSlideUrl === null) {
            p.sharedSlideUrl = null;
          } else if (
            p.isSpeaker &&
            typeof payload.sharedSlideUrl === 'string' &&
            /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(payload.sharedSlideUrl) &&
            payload.sharedSlideUrl.length <= 550_000
          ) {
            p.sharedSlideUrl = payload.sharedSlideUrl;
          }
          broadcastToSession(sessionId, 'room:state', {
            participants: Array.from(participants.values()),
            waitingRoom: Array.from(getWaitingMap(sessionId).values()),
          });
        }
        return;
      }

      if (event === 'room:raise_hand') {
        const participants = getRoomParticipants(sessionId);
        const p = participants.get(meta.clientId);
        if (p) {
          p.handRaised = typeof payload.raised === 'boolean' ? payload.raised : !p.handRaised;
          broadcastToSession(sessionId, 'room:state', {
            participants: Array.from(participants.values()),
            waitingRoom: Array.from(getWaitingMap(sessionId).values()),
          });
        }
        return;
      }

      if (event === 'room:approve_speaker' || event === 'room:demote_speaker') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts can approve or remove speakers.');
          return;
        }
        const targetClientId = String(payload.clientId ?? '');
        const participants = getRoomParticipants(sessionId);
        const target = participants.get(targetClientId);
        if (target) {
          const promote = event === 'room:approve_speaker';
          const hadHandUp = target.handRaised;
          const targetSession = store.state.sessions.find((x) => x.id === sessionId);
          if (promote && hadHandUp && !target.isSpeaker && target.userId && targetSession) {
            notifyHandApproved(target.userId, targetSession);
          }
          target.isSpeaker = promote;
          target.handRaised = false;
          target.mutedByHost = false;
          if (!promote) {
            target.micOn = false;
            target.camOn = false;
            target.screenSharing = false;
            target.sharedSlideUrl = null;
            target.speaking = false;
          }
          // Camera, microphone and screen only flow while the media server says yes.
          syncVideoRights(sessionId, target.userId);
          broadcastToSession(sessionId, 'room:state', {
            participants: Array.from(participants.values()),
            waitingRoom: Array.from(getWaitingMap(sessionId).values()),
          });
        }
        return;
      }

      if (event === 'room:mute_peer' || event === 'room:remove_peer') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only hosts can control room participants.');
          return;
        }
        const targetClientId = String(payload.clientId ?? '');
        const participants = getRoomParticipants(sessionId);
        if (event === 'room:mute_peer') {
          const target = participants.get(targetClientId);
          if (target) {
            target.micOn = false;
            target.speaking = false;
            target.mutedByHost = true;
            // Take the microphone permission away so the person cannot simply unmute.
            syncVideoRights(sessionId, target.userId);
          }
        } else {
          const removed = participants.get(targetClientId);
          participants.delete(targetClientId);
          if (removed && getRoomSeat(sessionId, removed.userId) === null) {
            void getVideoProvider().removeParticipant(sessionId, removed.userId);
          }
          const targetConn = Array.from(clients).find((c) => c.clientId === targetClientId);
          if (targetConn) {
            sendError(targetConn.ws, 'You were removed from the room by the host.');
            targetConn.ws.close(4001, 'Removed by host');
          }
        }
        broadcastToSession(sessionId, 'room:state', {
          participants: Array.from(participants.values()),
          waitingRoom: Array.from(getWaitingMap(sessionId).values()),
        });
        return;
      }

      if (event === 'room:end_for_all') {
        if (!isStaffOrHost(role)) {
          sendError(ws, 'Only the host can end a session for everyone.');
          return;
        }
        currentMod.endedForAll = true;
        if (sess) sess.status = 'REPLAY';
        store.save();
        void getVideoProvider().closeRoom(sessionId);
        broadcastToSession(sessionId, 'room:ended', { endedBy: actor.fullName });
        return;
      }

      // Collaborative Workspace (Notes, Tasks, Code)
      if (event === 'workspace:update_notes') {
        const wsState = store.getWorkspace(sessionId);
        wsState.notes = String(payload.notes ?? '').slice(0, 20_000);
        store.save();
        broadcastToSession(sessionId, 'workspace:updated', wsState);
        return;
      }

      if (event === 'workspace:update_code') {
        const wsState = store.getWorkspace(sessionId);
        if (
          payload.codeLanguage === 'python' ||
          payload.codeLanguage === 'typescript' ||
          payload.codeLanguage === 'bash'
        ) {
          wsState.codeLanguage = payload.codeLanguage;
        }
        if (typeof payload.code === 'string') {
          wsState.code = payload.code.slice(0, 20_000);
        }
        store.save();
        broadcastToSession(sessionId, 'workspace:updated', wsState);
        return;
      }

      if (event === 'workspace:add_task') {
        const title = String(payload.title ?? '').trim().slice(0, 140);
        if (!title) return;
        const wsState = store.getWorkspace(sessionId);
        wsState.tasks.push({
          id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title,
          assignee: actor.fullName,
          done: false,
        });
        store.save();
        broadcastToSession(sessionId, 'workspace:updated', wsState);
        return;
      }

      if (event === 'workspace:toggle_task') {
        const taskId = String(payload.taskId ?? '');
        const wsState = store.getWorkspace(sessionId);
        const task = wsState.tasks.find((t) => t.id === taskId);
        if (task) {
          task.done = !task.done;
          store.save();
          broadcastToSession(sessionId, 'workspace:updated', wsState);
        }
        return;
      }

      if (event === 'workspace:delete_task') {
        const taskId = String(payload.taskId ?? '');
        const wsState = store.getWorkspace(sessionId);
        wsState.tasks = wsState.tasks.filter((t) => t.id !== taskId);
        store.save();
        broadcastToSession(sessionId, 'workspace:updated', wsState);
        return;
      }

      // Live captions broadcast (from SpeechRecognition on speaker/host browser)
      if (event === 'captions:append') {
        const text = String(payload.text ?? '').trim().slice(0, 280);
        if (!text) return;
        if (!store.state.captions[sessionId]) store.state.captions[sessionId] = [];
        const line = {
          id: `cap-${Date.now()}`,
          speakerName: actor.nickname?.trim() || actor.fullName,
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        store.state.captions[sessionId].push(line);
        if (store.state.captions[sessionId].length > 50) {
          store.state.captions[sessionId].shift();
        }
        store.save();
        broadcastToSession(sessionId, 'captions:line', line);
      }
    });

    ws.on('close', () => {
      clients.delete(meta);
      if (!meta.monitor) presenceLeave(sessionId, meta.presenceUserId, getLiveViewerCount(sessionId));
      meta.presenceUserId = null;
      const participants = getRoomParticipants(sessionId);
      const waiting = getWaitingMap(sessionId);
      const changedRoom = participants.delete(meta.clientId) || waiting.delete(meta.clientId);
      if (sess) {
        sess.viewerCount = getLiveViewerCount(sessionId);
        store.save();
      }
      broadcastToSession(sessionId, 'presence:update', {
        viewerCount: getLiveViewerCount(sessionId),
        peakViewers: mod.peakViewers,
      });
      if (changedRoom) {
        broadcastToSession(sessionId, 'room:state', {
          participants: Array.from(participants.values()),
          waitingRoom: Array.from(waiting.values()),
        });
      }
    });
  });
}
