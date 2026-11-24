// Video behind one small interface, so Kabmeet never talks to LiveKit directly anywhere else.
// To change provider later, write another class that implements VideoProvider and return it
// from getVideoProvider(). Nothing in server.ts or server/ws.ts has to change.
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';

/** How long a join token is valid. It is only needed to connect, not to stay connected. */
const TOKEN_TTL_SECONDS = 10 * 60;
/** Server-to-LiveKit calls must never hold up a Room action for long. */
const ADMIN_CALL_TIMEOUT_MS = 4000;

export interface RoomTokenRequest {
  sessionId: string;
  /** Stable id of the person. Two tabs of one person replace each other instead of doubling up. */
  userId: string;
  displayName: string;
  /** May this person send camera, microphone or screen? Decided by the server, never by the browser. */
  canPublish: boolean;
  /** False after a host mutes someone: they can still use camera and screen, but not the microphone. */
  canUseMicrophone: boolean;
}

export interface RoomToken {
  /** Browser-facing address of the media server (ws:// or wss://). */
  url: string;
  token: string;
  expiresAt: string;
}

export interface PublishRights {
  canPublish: boolean;
  canUseMicrophone: boolean;
}

export interface VideoProvider {
  readonly name: string;
  isConfigured(): boolean;
  createRoomToken(request: RoomTokenRequest): Promise<RoomToken>;
  /** Change what an already-connected person may send. Best effort: errors are logged, not thrown. */
  updateRights(sessionId: string, userId: string, rights: PublishRights): Promise<void>;
  /** Disconnect one person from the room. Best effort. */
  removeParticipant(sessionId: string, userId: string): Promise<void>;
  /** Close the room for everyone. Best effort. */
  closeRoom(sessionId: string): Promise<void>;
}

/** One LiveKit room per Kabmeet session. */
export function roomNameFor(sessionId: string): string {
  return `kabmeet-${sessionId}`;
}

function publishSources(rights: PublishRights): TrackSource[] {
  if (!rights.canPublish) return [];
  const sources = [TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];
  if (rights.canUseMicrophone) sources.push(TrackSource.MICROPHONE);
  return sources;
}

/** Races a promise against a timeout, so a dead media server cannot stall a host's click. */
function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ADMIN_CALL_TIMEOUT_MS} ms`)),
      ADMIN_CALL_TIMEOUT_MS,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

class LiveKitProvider implements VideoProvider {
  readonly name = 'livekit';
  private admin: RoomServiceClient | null = null;

  constructor(
    private readonly publicUrl: string,
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  isConfigured(): boolean {
    return true;
  }

  async createRoomToken(request: RoomTokenRequest): Promise<RoomToken> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: request.userId,
      name: request.displayName,
      ttl: TOKEN_TTL_SECONDS,
    });
    token.addGrant({
      roomJoin: true,
      room: roomNameFor(request.sessionId),
      canSubscribe: true,
      canPublish: request.canPublish,
      // Chat, hands and polls already travel over Kabmeet's own websocket.
      canPublishData: false,
      canPublishSources: publishSources(request),
    });
    return {
      url: this.publicUrl,
      token: await token.toJwt(),
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async updateRights(sessionId: string, userId: string, rights: PublishRights): Promise<void> {
    try {
      await withTimeout(
        this.client().updateParticipant(roomNameFor(sessionId), userId, undefined, {
          canSubscribe: true,
          canPublish: rights.canPublish,
          canPublishData: false,
          canPublishSources: publishSources(rights),
        }),
        'updateParticipant',
      );
    } catch (err) {
      this.logIgnored('update rights', err);
    }
  }

  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    try {
      await withTimeout(this.client().removeParticipant(roomNameFor(sessionId), userId), 'removeParticipant');
    } catch (err) {
      this.logIgnored('remove participant', err);
    }
  }

  async closeRoom(sessionId: string): Promise<void> {
    try {
      await withTimeout(this.client().deleteRoom(roomNameFor(sessionId)), 'deleteRoom');
    } catch (err) {
      this.logIgnored('close room', err);
    }
  }

  private client(): RoomServiceClient {
    this.admin ??= new RoomServiceClient(this.apiUrl, this.apiKey, this.apiSecret);
    return this.admin;
  }

  // "Not found" is normal here: the person or room may not have connected yet.
  private logIgnored(action: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (/not.?found|does not exist/i.test(message)) return;
    console.warn(`[kabmeet] Video: could not ${action}: ${message}`);
  }
}

/** Used when no media server is set up. Rooms still work for chat, hands and workspace. */
class NoVideoProvider implements VideoProvider {
  readonly name = 'none';
  isConfigured(): boolean {
    return false;
  }
  async createRoomToken(): Promise<RoomToken> {
    throw new Error('Video is not configured on this server.');
  }
  async updateRights(): Promise<void> {}
  async removeParticipant(): Promise<void> {}
  async closeRoom(): Promise<void> {}
}

let cached: VideoProvider | null = null;

export function getVideoProvider(): VideoProvider {
  if (cached) return cached;

  const url = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !key || !secret) {
    if (url || key || secret) {
      console.warn('[kabmeet] Video: LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must all be set. Video is off.');
    }
    cached = new NoVideoProvider();
    return cached;
  }

  // Browsers connect over ws(s)://, but the server's own calls to LiveKit use http(s)://.
  const apiUrl = process.env.LIVEKIT_API_URL?.trim() || url.replace(/^ws/i, 'http');
  cached = new LiveKitProvider(url, apiUrl, key, secret);
  return cached;
}
