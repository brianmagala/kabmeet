// Connects the Room to the media server (LiveKit) and hands the page plain data to draw.
// The page keeps its own camera/mic/screen capture; this hook only publishes those tracks
// and gives back what other people send. Nothing here decides who may publish: the server does,
// through the token it issues and live rights updates. If the server refuses, publishing fails
// and we say so instead of pretending it worked.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client';

export type VideoStatus = 'idle' | 'connecting' | 'connected' | 'unconfigured' | 'error';
export type PublishSource = 'camera' | 'microphone' | 'screen';

export interface RemoteVideoTracks {
  camera?: RemoteTrack;
  screen?: RemoteTrack;
}

interface TokenResponse {
  configured: boolean;
  message?: string;
  url?: string;
  token?: string;
}

interface Options {
  sessionId: string;
  /** True once the person has a seat in the room (not while waiting, not before joining). */
  enabled: boolean;
  /** Data Saver: listen only, do not download other people's video. */
  audioOnly: boolean;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const SOURCE_MAP: Record<PublishSource, Track.Source> = {
  camera: Track.Source.Camera,
  microphone: Track.Source.Microphone,
  screen: Track.Source.ScreenShare,
};

export function useRoomVideo({ sessionId, enabled, audioOnly, apiFetch }: Options) {
  const [status, setStatus] = useState<VideoStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [remoteVideo, setRemoteVideo] = useState<Record<string, RemoteVideoTracks>>({});
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const audioOnlyRef = useRef(audioOnly);
  audioOnlyRef.current = audioOnly;
  const apiFetchRef = useRef(apiFetch);
  apiFetchRef.current = apiFetch;

  useEffect(() => {
    if (!enabled || !sessionId) return;
    let cancelled = false;
    let retryTimer: number | undefined;
    const audioElements = new Set<HTMLMediaElement>();
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const wantsTrack = (pub: RemoteTrackPublication) => !(audioOnlyRef.current && pub.kind === 'video');

    const refreshRemote = () => {
      const next: Record<string, RemoteVideoTracks> = {};
      room.remoteParticipants.forEach((p: RemoteParticipant) => {
        const entry: RemoteVideoTracks = {};
        const cam = p.getTrackPublication(Track.Source.Camera);
        const scr = p.getTrackPublication(Track.Source.ScreenShare);
        if (cam?.track && cam.kind === 'video' && !cam.isMuted) entry.camera = cam.track as RemoteTrack;
        if (scr?.track && scr.kind === 'video') entry.screen = scr.track as RemoteTrack;
        if (entry.camera || entry.screen) next[p.identity] = entry;
      });
      setRemoteVideo(next);
    };

    room
      .on(RoomEvent.TrackPublished, (pub: RemoteTrackPublication) => {
        if (wantsTrack(pub)) pub.setSubscribed(true);
      })
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElements.add(el);
        }
        refreshRemote();
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => {
          audioElements.delete(el);
          el.remove();
        });
        refreshRemote();
      })
      .on(RoomEvent.TrackMuted, refreshRemote)
      .on(RoomEvent.TrackUnmuted, refreshRemote)
      .on(RoomEvent.ParticipantDisconnected, refreshRemote)
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => setActiveSpeakers(speakers.map((s) => s.identity)))
      .on(RoomEvent.Reconnecting, () => setStatus('connecting'))
      .on(RoomEvent.Reconnected, () => setStatus('connected'))
      .on(RoomEvent.Disconnected, () => {
        if (cancelled) return;
        // Dropped for good (token expired, network gone): ask for a fresh token and try again.
        setStatus('connecting');
        retryTimer = window.setTimeout(connect, 3000);
      });

    async function connect() {
      if (cancelled) return;
      setStatus('connecting');
      try {
        const res = await apiFetchRef.current<TokenResponse>(`/api/sessions/${sessionId}/video-token`, {
          method: 'POST',
        });
        if (cancelled) return;
        if (!res.configured || !res.url || !res.token) {
          setStatus('unconfigured');
          setMessage(res.message ?? 'Video is not configured on this server.');
          return;
        }
        await room.connect(res.url, res.token, { autoSubscribe: false });
        if (cancelled) return;
        room.remoteParticipants.forEach((p) =>
          p.trackPublications.forEach((pub) => {
            if (wantsTrack(pub)) pub.setSubscribed(true);
          }),
        );
        setStatus('connected');
        setMessage(null);
        refreshRemote();
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not connect to video.');
        retryTimer = window.setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      audioElements.forEach((el) => el.remove());
      room.removeAllListeners();
      room.disconnect().catch(() => {});
      roomRef.current = null;
      setRemoteVideo({});
      setActiveSpeakers([]);
      setStatus('idle');
    };
  }, [enabled, sessionId]);

  // Data Saver can be switched while in the room.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    room.remoteParticipants.forEach((p) =>
      p.trackPublications.forEach((pub) => {
        if (pub.kind === 'video') pub.setSubscribed(!audioOnly);
      }),
    );
  }, [audioOnly]);

  const publish = useCallback(async (track: MediaStreamTrack, source: PublishSource): Promise<string | null> => {
    const room = roomRef.current;
    if (!room || room.state !== 'connected') return 'Video is not connected yet.';
    try {
      await room.localParticipant.publishTrack(track, {
        source: SOURCE_MAP[source],
        simulcast: source === 'camera',
        stopMicTrackOnMute: false,
      });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'The server did not allow this.';
    }
  }, []);

  const unpublish = useCallback(async (source: PublishSource) => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(SOURCE_MAP[source]);
    if (pub?.track) await room.localParticipant.unpublishTrack(pub.track, false).catch(() => {});
  }, []);

  return { status, message, remoteVideo, activeSpeakers, publish, unpublish };
}
