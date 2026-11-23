import { createHmac } from 'node:crypto';

export interface VideoRoomTokenRequest {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  canPublish: boolean;
  canSubscribe?: boolean;
  ttlSeconds?: number;
}

export interface VideoRoomTokenResult {
  token: string;
  roomName: string;
  wsUrl: string;
  expiresAt: string;
}

export interface VideoProvider {
  createRoomToken(req: VideoRoomTokenRequest): Promise<VideoRoomTokenResult>;
  promoteSpeaker(roomName: string, participantIdentity: string): Promise<void>;
  demoteSpeaker(roomName: string, participantIdentity: string): Promise<void>;
  muteParticipant(roomName: string, participantIdentity: string): Promise<void>;
  removeParticipant(roomName: string, participantIdentity: string): Promise<void>;
  endRoom(roomName: string): Promise<void>;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export class LiveKitVideoProvider implements VideoProvider {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly serverUrl: string,
  ) {}

  private signJwt(payload: Record<string, unknown>): string {
    const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64Url(JSON.stringify(payload));
    const sig = base64Url(
      createHmac('sha256', this.apiSecret).update(`${header}.${body}`).digest(),
    );
    return `${header}.${body}.${sig}`;
  }

  async createRoomToken(req: VideoRoomTokenRequest): Promise<VideoRoomTokenResult> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (req.ttlSeconds ?? 3600);
    const token = this.signJwt({
      iss: this.apiKey,
      sub: req.participantIdentity,
      name: req.participantName,
      nbf: now,
      exp,
      video: {
        room: req.roomName,
        roomJoin: true,
        canPublish: req.canPublish,
        canSubscribe: req.canSubscribe ?? true,
        canPublishData: true,
      },
    });

    return {
      token,
      roomName: req.roomName,
      wsUrl: this.serverUrl.replace(/^http/, 'ws'),
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  private async postTwirp(method: string, body: Record<string, unknown>): Promise<void> {
    const token = this.signJwt({
      iss: this.apiKey,
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      video: { roomAdmin: true, room: body.room },
    });

    const base = this.serverUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/twirp/livekit.RoomService/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LiveKit ${method} failed (${res.status}): ${text}`);
    }
  }

  async promoteSpeaker(roomName: string, participantIdentity: string): Promise<void> {
    await this.postTwirp('UpdateParticipant', {
      room: roomName,
      identity: participantIdentity,
      permission: { canPublish: true, canSubscribe: true, canPublishData: true },
    });
  }

  async demoteSpeaker(roomName: string, participantIdentity: string): Promise<void> {
    await this.postTwirp('UpdateParticipant', {
      room: roomName,
      identity: participantIdentity,
      permission: { canPublish: false, canSubscribe: true, canPublishData: true },
    });
  }

  async muteParticipant(roomName: string, participantIdentity: string): Promise<void> {
    await this.postTwirp('MutePublishedTrack', {
      room: roomName,
      identity: participantIdentity,
      muted: true,
    });
  }

  async removeParticipant(roomName: string, participantIdentity: string): Promise<void> {
    await this.postTwirp('RemoveParticipant', {
      room: roomName,
      identity: participantIdentity,
    });
  }

  async endRoom(roomName: string): Promise<void> {
    await this.postTwirp('DeleteRoom', { room: roomName });
  }
}
