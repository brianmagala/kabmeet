import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CaptionLine,
  ChatMessage,
  LivePoll,
  QaQuestion,
  RoomParticipant,
  SessionRealtimeState,
  SessionWorkspace,
  WaitingGuest,
} from '../types/kabmeet';
import { useKabmeet } from '../context/KabmeetContext';

export interface FloatingHeart {
  id: string;
  emoji: string;
  leftPercent: number;
  userName?: string;
}

export function useSessionRealtime(sessionId: string) {
  // Sign-in travels as the httpOnly cookie on the websocket handshake; `signedIn` only tells us to reconnect when it changes.
  const { signedIn, pushToast } = useKabmeet();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [state, setState] = useState<SessionRealtimeState | null>(null);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({ sessionId });
      const url = `${protocol}//${window.location.host}/ws?${params.toString()}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        setAccessDenied(null);
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        let msg: { event?: string; payload?: unknown };
        try {
          msg = JSON.parse(evt.data as string) as { event?: string; payload?: unknown };
        } catch {
          return;
        }
        const payload = msg.payload as Record<string, unknown>;

        switch (msg.event) {
          case 'session:init': {
            setClientId(String(payload.clientId ?? ''));
            setState(payload.snapshot as SessionRealtimeState);
            break;
          }
          case 'presence:update': {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    viewerCount: Number(payload.viewerCount ?? prev.viewerCount),
                    peakViewers: Number(payload.peakViewers ?? prev.peakViewers),
                  }
                : prev,
            );
            break;
          }
          case 'chat:message': {
            const incoming = payload as unknown as ChatMessage;
            setState((prev) => {
              if (!prev) return prev;
              if (prev.messages.some((m) => m.id === incoming.id)) return prev;
              return { ...prev, messages: [...prev.messages, incoming] };
            });
            break;
          }
          case 'chat:upvoted': {
            const id = String(payload.messageId ?? '');
            const upvotes = Number(payload.upvotes ?? 0);
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    messages: prev.messages.map((m) => (m.id === id ? { ...m, upvotes } : m)),
                  }
                : prev,
            );
            break;
          }
          case 'chat:deleted': {
            const id = String(payload.messageId ?? '');
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    messages: prev.messages.filter((m) => m.id !== id),
                    pinnedMessageId: prev.pinnedMessageId === id ? null : prev.pinnedMessageId,
                  }
                : prev,
            );
            break;
          }
          case 'moderation:update': {
            const mod = payload as {
              chatLocked: boolean;
              slowModeSeconds: number;
              blockedWords: string[];
              pinnedMessageId: string | null;
            };
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    chatLocked: mod.chatLocked,
                    slowModeSeconds: mod.slowModeSeconds,
                    blockedWords: mod.blockedWords,
                    pinnedMessageId: mod.pinnedMessageId,
                    messages: prev.messages.map((m) => ({
                      ...m,
                      pinned: m.id === mod.pinnedMessageId,
                    })),
                  }
                : prev,
            );
            break;
          }
          case 'reaction:heart': {
            const heartId = String(payload.id ?? `${Date.now()}-${Math.random()}`);
            const emoji = typeof payload.emoji === 'string' && payload.emoji ? payload.emoji : '❤️';
            const leftPercent =
              typeof payload.leftPercent === 'number' && Number.isFinite(payload.leftPercent)
                ? payload.leftPercent
                : 58 + Math.floor(Math.random() * 34);
            const userName = typeof payload.userName === 'string' ? payload.userName : undefined;
            setHearts((prev) => {
              if (prev.some((h) => h.id === heartId)) return prev;
              return [...prev.slice(-18), { id: heartId, emoji, leftPercent, userName }];
            });
            window.setTimeout(() => {
              setHearts((prev) => prev.filter((h) => h.id !== heartId));
            }, 1900);
            break;
          }
          case 'qa:updated': {
            const questions = payload as unknown as QaQuestion[];
            setState((prev) => (prev ? { ...prev, questions } : prev));
            break;
          }
          case 'polls:updated': {
            const polls = payload as unknown as LivePoll[];
            setState((prev) => (prev ? { ...prev, polls } : prev));
            break;
          }
          case 'room:state': {
            const roomPayload = payload as unknown as {
              participants: RoomParticipant[];
              waitingRoom: WaitingGuest[];
            };
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    participants: roomPayload.participants,
                    waitingRoom: roomPayload.waitingRoom,
                  }
                : prev,
            );
            break;
          }
          case 'room:ended': {
            setState((prev) => (prev ? { ...prev, endedForAll: true } : prev));
            pushToast('This session was ended by the host.', 'info');
            break;
          }
          case 'workspace:updated': {
            const workspace = payload as unknown as SessionWorkspace;
            setState((prev) => (prev ? { ...prev, workspace } : prev));
            break;
          }
          case 'captions:line': {
            const line = payload as unknown as CaptionLine;
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    captions: prev.captions.some((c) => c.id === line.id)
                      ? prev.captions
                      : [...prev.captions.slice(-49), line],
                  }
                : prev,
            );
            break;
          }
          case 'error': {
            const errMsg = String(payload.message ?? 'Action not permitted.');
            pushToast(errMsg, 'error');
            if (errMsg.toLowerCase().includes('permission')) {
              setAccessDenied(errMsg);
            }
            break;
          }
        }
      };

      ws.onclose = (ev) => {
        if (cancelled) return;
        setConnected(false);
        if (ev.code === 1008) {
          setAccessDenied('You do not have permission to access this private session.');
          return;
        }
        reconnectTimer = window.setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, signedIn, pushToast]);

  const emit = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
    }
  }, []);

  const triggerReaction = useCallback(
    (emoji: string, options?: { leftPercent?: number; userName?: string; broadcast?: boolean }) => {
      const heartId = `rxn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const leftPercent =
        typeof options?.leftPercent === 'number' && Number.isFinite(options.leftPercent)
          ? Math.max(8, Math.min(92, Math.round(options.leftPercent)))
          : 54 + Math.floor(Math.random() * 36);

      setHearts((prev) => [
        ...prev.slice(-18),
        { id: heartId, emoji, leftPercent, userName: options?.userName },
      ]);
      window.setTimeout(() => {
        setHearts((prev) => prev.filter((h) => h.id !== heartId));
      }, 1900);

      if (options?.broadcast !== false) {
        emit('reaction:heart', { id: heartId, emoji, leftPercent });
      }
    },
    [emit],
  );

  return {
    connected,
    accessDenied,
    clientId,
    state,
    hearts,
    emit,
    triggerReaction,
  };
}
