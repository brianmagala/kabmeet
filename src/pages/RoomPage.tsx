import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Captions,
  ExternalLink,
  Hand,
  ImagePlus,
  LayoutPanelLeft,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  Video,
  VideoOff,
  VolumeX,
} from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { WorkspacePanel } from '../components/WorkspacePanel';
import { KabmeetLoadingCard } from '../components/KabmeetLoader';
import { HopDots, LensLoader, SignalBars } from '../components/KabmeetMoments';
import {
  FloatingReactionsOverlay,
  ReactionBar,
  useDoubleTapLike,
} from '../components/EmojiReactions';
import type { KabSession } from '../types/kabmeet';
import { useRoomVideo } from '../video/useRoomVideo';
import { RemoteVideo } from '../video/RemoteVideo';

export function RoomPage() {
  const {
    activeSessionId,
    apiFetch,
    navigate,
    user,
    role,
    dataSaver,
    pushToast,
    isSlowNetwork,
  } = useKabmeet();
  const [session, setSession] = useState<KabSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { connected, accessDenied, clientId, state, hearts, emit, triggerReaction } =
    useSessionRealtime(activeSessionId);

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'workspace' | 'people'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [activeVideoStream, setActiveVideoStream] = useState<MediaStream | null>(null);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [mediaActionOpenTab, setMediaActionOpenTab] = useState(false);
  const [mediaActionWork, setMediaActionWork] = useState(false);
  const [mobileShareMenuOpen, setMobileShareMenuOpen] = useState(false);
  const [sharedSlideUrl, setSharedSlideUrl] = useState<string | null>(null);
  const [speakingLocal, setSpeakingLocal] = useState(false);
  const [mediaStarting, setMediaStarting] = useState<null | 'camera' | 'screen'>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const slideInputRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const isStaff =
    role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER' || role === 'ADMIN';

  const sendReaction = useCallback(
    (emoji: string, leftPercent?: number) => {
      const displayName = user?.nickname?.trim() || user?.fullName;
      triggerReaction(emoji, {
        leftPercent,
        userName: displayName,
        broadcast: Boolean(user),
      });
    },
    [triggerReaction, user],
  );

  const { tapBursts, doubleTapHandlers } = useDoubleTapLike((xPercent) => {
    sendReaction('❤️', xPercent);
  });

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ session: KabSession }>(`/api/sessions/${activeSessionId}`);
      setSession(res.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open this room.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, activeSessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Enter room once WebSocket connects (guests go to waiting room automatically on server)
  useEffect(() => {
    if (connected && user && session) {
      emit('room:join', {
        micOn: false,
        camOn: false,
        requireWaitingRoom: !session.isPrivateClass,
      });
    }
  }, [connected, user, session, emit]);

  // Automatic attendance tracking when inside a private class room
  useEffect(() => {
    if (!session?.isPrivateClass || !user) return;
    const ping = () => {
      apiFetch(`/api/classes/${session.id}/attendance/ping`, { method: 'POST' }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 15_000);
    return () => window.clearInterval(id);
  }, [session?.id, session?.isPrivateClass, user, apiFetch]);

  const myParticipant = useMemo(() => {
    if (!state || !clientId) return null;
    return state.participants.find((p) => p.clientId === clientId) ?? null;
  }, [state, clientId]);

  const amWaiting = useMemo(() => {
    if (!state || !clientId) return false;
    return state.waitingRoom.some((w) => w.clientId === clientId);
  }, [state, clientId]);

  // Real video: connect once we hold a seat in the room (never while waiting to be admitted).
  const video = useRoomVideo({
    sessionId: activeSessionId,
    enabled: Boolean(session && myParticipant && !amWaiting),
    audioOnly: dataSaver,
    apiFetch,
  });

  // With no media server, camera/mic/screen still start locally. Say once that nobody else can see or hear them.
  const localOnlyToldRef = useRef(false);
  const tellIfLocalOnly = useCallback(() => {
    if (video.status !== 'unconfigured' || localOnlyToldRef.current) return;
    localOnlyToldRef.current = true;
    pushToast('Video is not set up on this server, so others cannot see or hear you.', 'info');
  }, [video.status, pushToast]);

  const explainMediaError = (err: unknown, deviceLabel: 'Camera' | 'Microphone'): string => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return `${deviceLabel} access requires a secure HTTPS browser context.`;
    }
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return `${deviceLabel} access was blocked by your browser. Click the camera/lock icon in your address bar (or reload after granting frame permission) and allow ${deviceLabel.toLowerCase()}.`;
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return `No ${deviceLabel.toLowerCase()} hardware was found on this device.`;
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return `Your ${deviceLabel.toLowerCase()} is currently busy in another app or browser tab.`;
    }
    return `Unable to start ${deviceLabel.toLowerCase()} right now. Please check device permissions and try again.`;
  };

  // Attach active camera or screen stream AFTER <video> element mounts in the DOM
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;
    if (activeVideoStream) {
      videoEl.srcObject = activeVideoStream;
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [activeVideoStream, camOn, screenSharing]);

  // Real Web Audio volume meter when mic is enabled so Sun Yellow speaker ring responds to voice
  useEffect(() => {
    const stream = audioStreamRef.current;
    if (!micOn || !stream) {
      setSpeakingLocal(false);
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext | null = null;
    let timerId: number | undefined;
    try {
      ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let prevSpeaking = false;

      timerId = window.setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        const nowSpeaking = avg > 14;
        if (nowSpeaking !== prevSpeaking) {
          prevSpeaking = nowSpeaking;
          setSpeakingLocal(nowSpeaking);
          emit('room:media_state', { speaking: nowSpeaking });
        }
      }, 220);
    } catch {
      // Ignore AudioContext restriction errors
    }

    return () => {
      if (timerId) window.clearInterval(timerId);
      ctx?.close().catch(() => {});
    };
  }, [micOn, emit]);

  // Toggle Camera independently with relaxed constraints & fallback
  const toggleCamera = useCallback(async () => {
    if (!myParticipant?.isSpeaker) {
      pushToast('Raise your hand and wait for the host to approve you as a speaker.', 'info');
      return;
    }
    setMediaNotice(null);
    if (!camOn) {
      if (!navigator.mediaDevices?.getUserMedia) {
        const msg = explainMediaError(null, 'Camera');
        setMediaNotice(msg);
        pushToast(msg, 'error');
        return;
      }
      setMediaStarting('camera');
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: dataSaver
              ? { width: { ideal: 640 }, height: { ideal: 360 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch (constraintErr) {
          if (constraintErr instanceof DOMException && constraintErr.name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw constraintErr;
          }
        }
        const publishError = await video.publish(stream.getVideoTracks()[0], 'camera');
        if (publishError) {
          stream.getTracks().forEach((t) => t.stop());
          const msg = `Camera could not be shared: ${publishError}`;
          setMediaNotice(msg);
          pushToast(msg, 'error');
          return;
        }
        tellIfLocalOnly();
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = stream;
        if (!screenSharing) {
          setActiveVideoStream(stream);
        }
        setCamOn(true);
        emit('room:media_state', { camOn: true });
      } catch (err) {
        const msg = explainMediaError(err, 'Camera');
        setMediaNotice(msg);
        pushToast(msg, 'error');
      } finally {
        setMediaStarting(null);
      }
    } else {
      await video.unpublish('camera');
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      if (!screenSharing) {
        setActiveVideoStream(null);
      }
      setCamOn(false);
      emit('room:media_state', { camOn: false });
    }
  }, [camOn, screenSharing, dataSaver, myParticipant?.isSpeaker, emit, pushToast, video, tellIfLocalOnly]);

  // Toggle Microphone independently of Camera
  const toggleMic = useCallback(async () => {
    if (!myParticipant?.isSpeaker) {
      pushToast('Raise your hand first so the host can invite you to speak.', 'info');
      return;
    }
    if (myParticipant.mutedByHost && !micOn) {
      pushToast('You were muted by the host.', 'info');
      return;
    }
    setMediaNotice(null);
    const next = !micOn;
    if (next) {
      const existingTracks = audioStreamRef.current?.getAudioTracks() ?? [];
      if (existingTracks.length === 0 || existingTracks.every((t) => t.readyState === 'ended')) {
        if (!navigator.mediaDevices?.getUserMedia) {
          const msg = explainMediaError(null, 'Microphone');
          setMediaNotice(msg);
          pushToast(msg, 'error');
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
          const publishError = await video.publish(stream.getAudioTracks()[0], 'microphone');
          if (publishError) {
            stream.getTracks().forEach((t) => t.stop());
            const msg = `Microphone could not be shared: ${publishError}`;
            setMediaNotice(msg);
            pushToast(msg, 'error');
            return;
          }
          tellIfLocalOnly();
          audioStreamRef.current = stream;
        } catch (err) {
          const msg = explainMediaError(err, 'Microphone');
          setMediaNotice(msg);
          pushToast(msg, 'error');
          return;
        }
      } else {
        existingTracks.forEach((t) => {
          t.enabled = true;
        });
      }
    } else {
      await video.unpublish('microphone');
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    setMicOn(next);
    emit('room:media_state', { micOn: next, speaking: false });
  }, [micOn, myParticipant?.isSpeaker, myParticipant?.mutedByHost, emit, pushToast, video, tellIfLocalOnly]);

  const handlePickSlideImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        pushToast('Please choose an image file (PNG, JPG, or WebP).', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 960;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setSharedSlideUrl(dataUrl);
          setMobileShareMenuOpen(false);
          emit('room:media_state', { sharedSlideUrl: dataUrl });
          pushToast('Slide is now live on the room stage.', 'success');
        };
        img.src = String(reader.result ?? '');
      };
      reader.readAsDataURL(file);
    },
    [emit, pushToast],
  );

  const toggleScreenShare = useCallback(async () => {
    if (!myParticipant?.isSpeaker) {
      pushToast('Only approved speakers or hosts can share.', 'info');
      return;
    }
    setMediaNotice(null);
    setMediaActionOpenTab(false);
    setMediaActionWork(false);

    if (sharedSlideUrl) {
      setSharedSlideUrl(null);
      setMobileShareMenuOpen(false);
      emit('room:media_state', { sharedSlideUrl: null });
      return;
    }

    if (!screenSharing) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setMobileShareMenuOpen((prev) => !prev);
        return;
      }

      try {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const publishError = await video.publish(display.getVideoTracks()[0], 'screen');
        if (publishError) {
          display.getTracks().forEach((t) => t.stop());
          const msg = `Screen could not be shared: ${publishError}`;
          setMediaNotice(msg);
          pushToast(msg, 'error');
          return;
        }
        tellIfLocalOnly();
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = display;
        setActiveVideoStream(display);
        display.getVideoTracks()[0].onended = () => {
          void video.unpublish('screen');
          screenStreamRef.current = null;
          setScreenSharing(false);
          setActiveVideoStream(cameraStreamRef.current);
          emit('room:media_state', { screenSharing: false });
        };
        setScreenSharing(true);
        emit('room:media_state', { screenSharing: true });
      } catch (err) {
        const domErr = err instanceof DOMException ? err : null;
        const errName = domErr?.name ?? '';
        const errMsg = domErr?.message?.toLowerCase() ?? '';
        const inIframe = typeof window !== 'undefined' && window.self !== window.top;
        const policyBlocked =
          errMsg.includes('permissions policy') ||
          errMsg.includes('disallowed by') ||
          (errName === 'NotAllowedError' && inIframe);

        if (policyBlocked) {
          setMobileShareMenuOpen(true);
          setMediaNotice(
            'Live screen capture is blocked inside embedded preview frames. Share a Slide/Photo or Code & Notes directly below, or open Kabmeet in its own browser tab.',
          );
          setMediaActionOpenTab(true);
        } else if (errName === 'NotFoundError' || errName === 'NotReadableError') {
          const msg =
            'No display capture source is available (on Linux Wayland, ensure xdg-desktop-portal is running).';
          setMediaNotice(msg);
          pushToast(msg, 'error');
        } else if (errName === 'NotAllowedError') {
          const msg =
            'Screen recording permission was denied by your browser or OS. Allow screen capture and try again.';
          setMediaNotice(msg);
          pushToast(msg, 'error');
        } else {
          pushToast('Screen sharing picker was closed.', 'info');
        }
      }
    } else {
      await video.unpublish('screen');
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setActiveVideoStream(cameraStreamRef.current);
      setScreenSharing(false);
      emit('room:media_state', { screenSharing: false });
    }
  }, [screenSharing, sharedSlideUrl, myParticipant?.isSpeaker, emit, pushToast, video, tellIfLocalOnly]);

  const toggleRaiseHand = useCallback(() => {
    if (!myParticipant) return;
    const next = !myParticipant.handRaised;
    emit('room:raise_hand', { raised: next });
    pushToast(next ? 'Hand raised. The host has been notified.' : 'Hand lowered.', 'info');
  }, [myParticipant, emit, pushToast]);

  // Cleanup hardware streams on unmount
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Room keyboard shortcuts: M (mic), V (video), H (raise hand)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'm') toggleMic();
      if (key === 'v') toggleCamera();
      if (key === 'h') toggleRaiseHand();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMic, toggleCamera, toggleRaiseHand]);

  // Optional Web Speech API Live Captions
  useEffect(() => {
    if (!captionsOn || !micOn) return;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) return;

    const rec = new SpeechRec() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
      start: () => void;
      stop: () => void;
    };
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (last && last[0]?.transcript) {
        emit('captions:append', { text: last[0].transcript });
      }
    };
    try {
      rec.start();
    } catch {
      // Ignore if already started
    }
    return () => {
      try {
        rec.stop();
      } catch {
        // Ignore
      }
    };
  }, [captionsOn, micOn, emit]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-surface p-8">
          <h1 className="font-display text-2xl font-bold uppercase">Sign in to join this room</h1>
          <p className="mt-2 text-sm text-muted">
            Interactive rooms require a Kabmeet account so hosts can verify participants and manage speakers.
          </p>
          <button
            type="button"
            onClick={() => navigate('auth')}
            className="mt-5 h-11 rounded-full bg-signal-green px-6 text-xs font-semibold uppercase tracking-wider text-night-forest"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <KabmeetLoadingCard
          variant="thread"
          fromLabel="YOU"
          toLabel="ROOM"
          label="Joining interactive room"
          sublabel="Preparing participant grid, host controls, and shared workspace."
          slowHint={
            isSlowNetwork
              ? 'Weak network detected. Audio-first 360p mode is recommended.'
              : null
          }
          onRetry={loadSession}
        />
      </div>
    );
  }

  if (error || accessDenied || !session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-live-red/40 bg-surface p-8">
          <h1 className="font-display text-2xl font-bold uppercase text-live-red">
            Room access denied
          </h1>
          <p className="mt-2 text-sm text-muted">{accessDenied || error || 'Session not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="mt-5 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest"
          >
            Back to Discover
          </button>
        </div>
      </div>
    );
  }

  if (state?.endedForAll) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-surface p-8">
          <h1 className="font-display text-2xl font-bold uppercase">Session ended</h1>
          <p className="mt-2 text-sm text-muted">
            The host ended this room for everyone. You can still view the replay and workspace notes.
          </p>
          <button
            type="button"
            onClick={() => navigate('watch', { sessionId: session.id })}
            className="mt-5 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest"
          >
            Open replay &amp; notes
          </button>
        </div>
      </div>
    );
  }

  if (amWaiting) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-surface p-8">
          <Users className="mx-auto h-10 w-10 text-sun-yellow" strokeWidth={2} />
          <h1 className="mt-4 font-display text-2xl font-bold uppercase">Waiting room</h1>
          <p className="mt-2 text-sm text-muted">
            You asked to join <strong>{session.title}</strong>. Hang tight—the host will let you in
            shortly.
          </p>
        </div>
      </div>
    );
  }

  const participants = state?.participants ?? [];
  const waitingRoom = state?.waitingRoom ?? [];
  const raisedHands = participants.filter((p) => p.handRaised);
  const latestCaption = state?.captions[state.captions.length - 1];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      {/* Top Room Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
            <SignalBars
              level={!connected ? 'reconnecting' : isSlowNetwork ? 'weak' : 'strong'}
              label={!connected ? 'Reconnecting' : isSlowNetwork ? 'Weak signal' : 'Connected'}
            />
            <span>
              {session.communityName}
              {dataSaver ? ' · Data saver (360p)' : ''}
            </span>
          </p>
          <h1 className="font-display text-xl font-bold tracking-wide">{session.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-night-forest px-3 py-1 font-mono tabular-nums text-mist">
            {participants.length} in room
          </span>
          {isStaff && waitingRoom.length > 0 && (
            <button
              type="button"
              onClick={() => setSidePanel('people')}
              className="rounded-full bg-sun-yellow px-3 py-1 font-semibold text-night-forest"
            >
              {waitingRoom.length} waiting
            </button>
          )}
        </div>
      </div>

      {/* Main Stage + Side Panel */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Reflowing Video Grid */}
        <div
          className={`${
            sidePanel === 'none' ? 'lg:col-span-12' : 'lg:col-span-8'
          } flex flex-col gap-3`}
        >
          <div
            {...doubleTapHandlers}
            className="relative select-none"
          >
            <div
              className={`grid gap-3 ${
                participants.length <= 1
                  ? 'grid-cols-1'
                  : participants.length <= 4
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-2 md:grid-cols-3'
              }`}
            >
              {participants.map((p) => {
                const isMe = p.clientId === clientId;
                const remote = isMe ? undefined : video.remoteVideo[p.userId];
                const remoteTrack = remote?.screen ?? remote?.camera;
                const isSpeakingNow = isMe
                  ? speakingLocal || p.speaking
                  : p.speaking || video.activeSpeakers.includes(p.userId);
                return (
                  <div
                    key={p.clientId}
                    className={`relative aspect-video overflow-hidden rounded-xl border-2 bg-night-forest ${
                      isSpeakingNow
                        ? 'border-sun-yellow'
                        : 'border-border'
                    }`}
                  >
                    {isMe && (camOn || screenSharing) ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`h-full w-full object-cover ${!screenSharing ? '-scale-x-100' : ''}`}
                      />
                    ) : remoteTrack ? (
                      <RemoteVideo
                        track={remoteTrack}
                        label={`${p.fullName} ${remote?.screen ? 'screen' : 'camera'}`}
                        contain={Boolean(remote?.screen)}
                      />
                    ) : (isMe ? sharedSlideUrl : p.sharedSlideUrl) ? (
                      <img
                        src={(isMe ? sharedSlideUrl : p.sharedSlideUrl) ?? ''}
                        alt={`${p.fullName} shared slide`}
                        className="h-full w-full bg-night-forest object-contain"
                      />
                    ) : isMe && mediaStarting ? (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indaba-deep-green/80 to-night-forest">
                        <LensLoader label={mediaStarting === 'screen' ? 'Starting screen share' : 'Starting your camera'} />
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indaba-deep-green/80 to-night-forest text-white">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 font-display text-2xl font-bold uppercase">
                          {p.fullName
                            .split(' ')
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <span className="mt-2 text-xs text-mist/80">
                          {p.camOn ? 'Video active' : p.isSpeaker ? 'Audio speaker' : 'Viewer'}
                        </span>
                      </div>
                    )}

                    {/* Participant Corner Nameplate */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                        {p.micOn ? (
                          <Mic className="h-3.5 w-3.5 text-signal-green" />
                        ) : (
                          <MicOff className="h-3.5 w-3.5 text-live-red" />
                        )}
                        <span>
                          {p.fullName}
                          {isMe ? ' (You)' : ''}
                        </span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {((isMe && (screenSharing || Boolean(sharedSlideUrl))) ||
                          Boolean(p.sharedSlideUrl)) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-kab-blue px-2.5 py-1 text-[11px] font-semibold text-white">
                            <MonitorUp className="h-3 w-3" />
                            <span>Sharing</span>
                          </span>
                        )}
                        {p.handRaised && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sun-yellow px-2.5 py-1 text-[11px] font-bold text-night-forest">
                            <Hand className="h-3 w-3" />
                            <span>Hand</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <FloatingReactionsOverlay hearts={hearts} tapBursts={tapBursts} />

            {/* Floating Emoji Reaction Bar inside Video Stage */}
            <div
              data-no-doubletap="true"
              className="absolute right-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-1"
            >
              <ReactionBar compact collapsible onReact={(emoji) => sendReaction(emoji)} />
            </div>
          </div>

          {video.status !== 'idle' && video.status !== 'connected' && (
            <p
              role="status"
              className="rounded-xl border border-border bg-surface px-4 py-2 text-xs text-muted"
            >
              {video.status === 'connecting'
                ? 'Connecting video...'
                : video.message ?? 'Video is unavailable. Chat and the workspace still work.'}
            </p>
          )}

          {mediaNotice && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-gold/60 bg-amber-gold/10 px-4 py-3 text-xs text-foreground"
            >
              <p className="flex-1 leading-relaxed">{mediaNotice}</p>
              <div className="flex shrink-0 items-center gap-2">
                {mediaActionWork && (
                  <button
                    type="button"
                    onClick={() => {
                      setSidePanel('workspace');
                      setMediaNotice(null);
                      setMediaActionWork(false);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-signal-green px-3.5 text-[11px] font-semibold text-night-forest"
                  >
                    <LayoutPanelLeft className="h-3 w-3" strokeWidth={2} />
                    <span>Open Work</span>
                  </button>
                )}
                {mediaActionOpenTab && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-signal-green px-3.5 text-[11px] font-semibold text-night-forest"
                  >
                    <span>Open in full tab</span>
                    <ExternalLink className="h-3 w-3" strokeWidth={2} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMediaNotice(null);
                    setMediaActionOpenTab(false);
                    setMediaActionWork(false);
                  }}
                  className="h-8 rounded-full border border-border px-3 text-[11px] font-semibold hover:border-amber-gold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {captionsOn && latestCaption && (
            <div className="rounded-xl bg-black/85 px-4 py-2 text-center text-xs text-white">
              <span className="font-semibold text-sun-yellow">{latestCaption.speakerName}: </span>
              <span>{latestCaption.text}</span>
            </div>
          )}

          <input
            ref={slideInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickSlideImage}
            className="hidden"
          />

          {mobileShareMenuOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indaba-deep-green/45 bg-night-forest px-4 py-3 text-xs text-white">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => slideInputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-signal-green px-3.5 font-semibold text-night-forest"
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={2} />
                  <span>Share Slide / Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidePanel('workspace');
                    setMobileShareMenuOpen(false);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 font-semibold text-white hover:border-amber-gold"
                >
                  <LayoutPanelLeft className="h-4 w-4" strokeWidth={2} />
                  <span>Share Code &amp; Notes</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMobileShareMenuOpen(false)}
                className="h-8 rounded-full border border-white/25 px-3 text-[11px] font-semibold text-mist/85 hover:border-amber-gold"
              >
                Close
              </button>
            </div>
          )}

          {/* Room Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                title="Toggle microphone (M)"
                className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                  micOn
                    ? 'bg-signal-green text-night-forest'
                    : 'bg-night-forest text-white'
                }`}
              >
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-live-red" />}
                <span>Mic (M)</span>
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                title="Toggle camera (V)"
                className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                  camOn
                    ? 'bg-signal-green text-night-forest'
                    : 'bg-night-forest text-white'
                }`}
              >
                {camOn ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4 text-live-red" />
                )}
                <span>Cam (V)</span>
              </button>

              <button
                type="button"
                onClick={toggleScreenShare}
                title="Share screen, slide, or workspace"
                className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                  screenSharing || Boolean(sharedSlideUrl)
                    ? 'bg-kab-blue text-white'
                    : 'border border-border text-foreground hover:border-amber-gold'
                }`}
              >
                <MonitorUp className="h-4 w-4" />
                <span>{screenSharing || sharedSlideUrl ? 'Stop share' : 'Share'}</span>
              </button>

              <button
                type="button"
                onClick={toggleRaiseHand}
                title="Raise hand (H)"
                className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                  myParticipant?.handRaised
                    ? 'bg-sun-yellow text-night-forest'
                    : 'border border-border text-foreground hover:border-amber-gold'
                }`}
              >
                <Hand className="h-4 w-4" />
                <span>{myParticipant?.handRaised ? 'Lower (H)' : 'Raise hand (H)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCaptionsOn((p) => !p)}
                className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold ${
                  captionsOn
                    ? 'bg-sun-yellow text-night-forest'
                    : 'border border-border text-foreground'
                }`}
              >
                <Captions className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSidePanel(sidePanel === 'chat' ? 'none' : 'chat')}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold ${
                  sidePanel === 'chat'
                    ? 'bg-indaba-deep-green text-white'
                    : 'border border-border'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setSidePanel(sidePanel === 'workspace' ? 'none' : 'workspace')}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold ${
                  sidePanel === 'workspace'
                    ? 'bg-indaba-deep-green text-white'
                    : 'border border-border'
                }`}
              >
                <LayoutPanelLeft className="h-4 w-4" />
                <span>Work</span>
              </button>

              <button
                type="button"
                onClick={() => setSidePanel(sidePanel === 'people' ? 'none' : 'people')}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold ${
                  sidePanel === 'people'
                    ? 'bg-indaba-deep-green text-white'
                    : 'border border-border'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>People</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('discover')}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-live-red px-4 text-xs font-semibold text-white"
              >
                <PhoneOff className="h-4 w-4" />
                <span>Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Side Drawer: Chat / Workspace / People & Host Controls */}
        {sidePanel !== 'none' && (
          <aside className="flex h-[540px] flex-col rounded-xl border border-border bg-surface p-4 lg:col-span-4">
            {sidePanel === 'chat' && (
              <>
                <h2 className="mb-3 font-display text-lg font-semibold uppercase">Room chat</h2>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {(state?.messages ?? []).map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-border/70 bg-background p-2.5 text-xs"
                    >
                      <span className="font-semibold">{m.userName}</span>
                      <p className="mt-1 text-foreground/90">{m.text}</p>
                    </div>
                  ))}
                </div>
                {!connected && (
                  <div className="mt-3">
                    <HopDots label="Connecting to chat. Messages will send when it is ready." />
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatInput.trim()) return;
                    emit('chat:send', { text: chatInput.trim() });
                    setChatInput('');
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="text"
                    disabled={Boolean(state?.chatLocked && !isStaff)}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={state?.chatLocked && !isStaff ? 'Chat locked' : 'Message room...'}
                    className="h-10 flex-1 rounded-full border border-border bg-background px-3.5 text-xs"
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-signal-green text-night-forest"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}

            {sidePanel === 'workspace' && state && (
              <WorkspacePanel
                workspace={state.workspace}
                canEdit={true}
                onUpdateNotes={(notes) => emit('workspace:update_notes', { notes })}
                onUpdateCode={(code, codeLanguage) =>
                  emit('workspace:update_code', { code, codeLanguage })
                }
                onAddTask={(title) => emit('workspace:add_task', { title })}
                onToggleTask={(taskId) => emit('workspace:toggle_task', { taskId })}
                onDeleteTask={(taskId) => emit('workspace:delete_task', { taskId })}
              />
            )}

            {sidePanel === 'people' && (
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
                {isStaff && (
                  <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-kab-blue dark:text-signal-green">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Host controls</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          emit('host:moderation', { chatLocked: !state?.chatLocked })
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-[11px] font-semibold"
                      >
                        <Lock className="h-3 w-3" />
                        <span>{state?.chatLocked ? 'Unlock chat' : 'Lock chat'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => emit('room:end_for_all')}
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-live-red px-3 text-[11px] font-semibold text-white"
                      >
                        <PhoneOff className="h-3 w-3" />
                        <span>End for all</span>
                      </button>
                    </div>
                  </div>
                )}

                {isStaff && waitingRoom.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-sun-yellow">
                      Waiting room ({waitingRoom.length})
                    </h3>
                    <div className="mt-2 space-y-2">
                      {waitingRoom.map((g) => (
                        <div
                          key={g.clientId}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2.5 text-xs"
                        >
                          <span>{g.fullName}</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => emit('room:admit_guest', { clientId: g.clientId })}
                              className="rounded-full bg-signal-green px-2.5 py-1 text-[11px] font-semibold text-night-forest"
                            >
                              Admit
                            </button>
                            <button
                              type="button"
                              onClick={() => emit('room:deny_guest', { clientId: g.clientId })}
                              className="rounded-full border border-border px-2.5 py-1 text-[11px]"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isStaff && raisedHands.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-sun-yellow">
                      Raised hands ({raisedHands.length})
                    </h3>
                    <div className="mt-2 space-y-2">
                      {raisedHands.map((p) => (
                        <div
                          key={p.clientId}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2.5 text-xs"
                        >
                          <span>{p.fullName}</span>
                          <button
                            type="button"
                            onClick={() =>
                              emit('room:approve_speaker', { clientId: p.clientId })
                            }
                            className="rounded-full bg-signal-green px-2.5 py-1 text-[11px] font-semibold text-night-forest"
                          >
                            Approve speaker
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    In room ({participants.length})
                  </h3>
                  <div className="mt-2 space-y-2">
                    {participants.map((p) => (
                      <div
                        key={p.clientId}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2.5 text-xs"
                      >
                        <div>
                          <p className="font-semibold">{p.fullName}</p>
                          <p className="text-[11px] text-muted">
                            {p.isSpeaker ? 'Speaker' : 'Viewer'} · {p.role}
                          </p>
                        </div>

                        {isStaff && p.clientId !== clientId && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                emit(
                                  p.isSpeaker ? 'room:demote_speaker' : 'room:approve_speaker',
                                  { clientId: p.clientId },
                                )
                              }
                              title={p.isSpeaker ? 'Send back to viewers' : 'Make speaker'}
                              className="rounded-full border border-border p-1.5 text-muted hover:text-foreground"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => emit('room:mute_peer', { clientId: p.clientId })}
                              title="Mute participant"
                              className="rounded-full border border-border p-1.5 text-muted hover:text-amber-gold"
                            >
                              <VolumeX className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => emit('room:remove_peer', { clientId: p.clientId })}
                              title="Remove from room"
                              className="rounded-full border border-border p-1.5 text-muted hover:text-live-red"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
