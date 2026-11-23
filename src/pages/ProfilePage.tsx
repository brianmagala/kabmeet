import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Camera,
  Clock,
  Pencil,
  Play,
  ShieldCheck,
  Trash2,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { KabmeetLoadingCard, KabmeetSignalPrism } from '../components/KabmeetLoader';
import type { AttendanceRecord, AuthUser, Community, KabSession } from '../types/kabmeet';

interface DashboardAttendance extends AttendanceRecord {
  classTitle: string;
}

interface DashboardResponse {
  user: AuthUser;
  myCommunities: Community[];
  mySessions: KabSession[];
  myAttendance: DashboardAttendance[];
}

function resizeAvatarToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a supported image.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser image processing is unavailable.'));
          return;
        }
        // Center-crop square thumbnail
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { apiFetch, navigate, user, updateUserProfile, pushToast, isSlowNetwork } = useKabmeet();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [department, setDepartment] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardResponse>('/api/profile/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [user, loadProfile]);

  const openEditModal = () => {
    const current = data?.user ?? user;
    if (!current) return;
    setFullName(current.fullName);
    setNickname(current.nickname ?? '');
    setDepartment(current.department ?? '');
    setAvatarUrl(current.avatarUrl ?? null);
    setEditOpen(true);
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('Please select a PNG, JPEG, WebP, or GIF image.', 'error');
      return;
    }
    try {
      const dataUrl = await resizeAvatarToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not process that image.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      pushToast('Full name must be at least 2 characters.', 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateUserProfile({
        fullName: fullName.trim(),
        nickname: nickname.trim() || null,
        department: department.trim() || null,
        avatarUrl,
      });
      setData((prev) => (prev ? { ...prev, user: updated } : prev));
      setEditOpen(false);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not save profile changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-surface p-8">
          <UserCircle2 className="mx-auto h-10 w-10 text-kab-blue dark:text-signal-green" />
          <h1 className="mt-4 font-display text-2xl font-bold uppercase">
            Sign in to view your dashboard
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your followed clubs, session reminders, and virtual class attendance stay linked to
            your Kabmeet account.
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
          label="Loading your dashboard"
          sublabel="Gathering your sessions, attendance history, and followed communities."
          slowHint={isSlowNetwork ? 'Slow connection — retrieving your profile cleanly.' : null}
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-live-red/40 bg-surface p-8">
          <p className="text-sm text-live-red">{error || 'Dashboard unavailable.'}</p>
          <button
            type="button"
            onClick={loadProfile}
            className="mt-4 h-10 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const profileUser = data.user;
  const initials = profileUser.fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header Card */}
      <section className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-border bg-indaba-deep-green p-6 text-white sm:p-8">
        <div className="flex items-center gap-4 sm:gap-5">
          <button
            type="button"
            onClick={openEditModal}
            aria-label="Change profile picture"
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-signal-green font-display text-2xl font-bold uppercase text-night-forest ring-2 ring-signal-green/70 sm:h-20 sm:w-20"
          >
            {profileUser.avatarUrl ? (
              <img
                src={profileUser.avatarUrl}
                alt={profileUser.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5" strokeWidth={2} />
            </span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
                {profileUser.fullName}
              </h1>
              {profileUser.nickname && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-mist">
                  @{profileUser.nickname}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-sun-yellow px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-night-forest">
                <ShieldCheck className="h-3 w-3" />
                <span>{profileUser.role}</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-mist/85">
              {profileUser.email}
              {profileUser.universityId ? ` · ID: ${profileUser.universityId}` : ''}
              {profileUser.department ? ` · ${profileUser.department}` : ''}
            </p>
            <button
              type="button"
              onClick={openEditModal}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-semibold text-white transition-colors hover:border-sun-yellow hover:bg-white/15"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Edit profile</span>
            </button>
          </div>
        </div>

        <div className="flex gap-3 text-center">
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5">
            <p className="font-mono text-xl font-bold tabular-nums">{data.myCommunities.length}</p>
            <p className="text-[11px] uppercase tracking-wider text-mist/80">Clubs</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5">
            <p className="font-mono text-xl font-bold tabular-nums">{data.mySessions.length}</p>
            <p className="text-[11px] uppercase tracking-wider text-mist/80">Sessions</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5">
            <p className="font-mono text-xl font-bold tabular-nums">{data.myAttendance.length}</p>
            <p className="text-[11px] uppercase tracking-wider text-mist/80">Classes</p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* My Sessions & Reminders */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase">
            <CalendarDays className="h-5 w-5 text-kab-blue dark:text-signal-green" />
            <span>My Sessions &amp; Reminders</span>
          </h2>
          {data.mySessions.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-xs text-muted">
              Set a reminder on any upcoming session in Discover to see it here.
            </div>
          ) : (
            <div className="space-y-3">
              {data.mySessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      {s.status} · {s.communityName}
                    </p>
                    <p className="truncate font-display text-base font-semibold">{s.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(s.mode === 'ROOM' || s.mode === 'CLASS' ? 'room' : 'watch', {
                        sessionId: s.id,
                      })
                    }
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-signal-green px-3.5 text-xs font-semibold text-night-forest"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Open</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Virtual Class Attendance */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase">
            <Clock className="h-5 w-5 text-kab-blue dark:text-signal-green" />
            <span>My Attendance</span>
          </h2>
          {data.myAttendance.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-xs text-muted">
              Attendance is recorded automatically whenever you join a private virtual class.
            </div>
          ) : (
            <div className="space-y-3">
              {data.myAttendance.map((att) => (
                <div key={att.id} className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-display text-base font-semibold">{att.classTitle}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>Joined {new Date(att.joinedAt).toLocaleDateString()}</span>
                    <span className="rounded-full bg-signal-green/20 px-2.5 py-0.5 font-mono font-semibold text-indaba-deep-green dark:text-signal-green">
                      {Math.max(1, Math.round(att.durationSeconds / 60))} min logged
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Followed Communities */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase">
            <Users className="h-5 w-5 text-kab-blue dark:text-signal-green" />
            <span>My Communities</span>
          </h2>
          {data.myCommunities.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-xs text-muted">
              Follow IndabaX, KAB AI, or campus tech clubs from the Communities tab.
            </div>
          ) : (
            <div className="space-y-3">
              {data.myCommunities.map((comm) => (
                <button
                  key={comm.id}
                  type="button"
                  onClick={() => navigate('communities', { communitySlug: comm.slug })}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-4 text-left hover:border-amber-gold"
                >
                  <div>
                    <p className="font-display text-base font-semibold">{comm.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">{comm.description}</p>
                  </div>
                  <span className="text-xs font-semibold text-kab-blue dark:text-signal-green">
                    View
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit your profile"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 text-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                Edit profile
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-background"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
              {/* Avatar picker */}
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-signal-green font-display text-2xl font-bold uppercase text-night-forest ring-2 ring-border">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleAvatarPick}
                    className="sr-only"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-kab-blue px-3.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      <Camera className="h-3.5 w-3.5" strokeWidth={2} />
                      <span>{avatarUrl ? 'Change photo' : 'Upload photo'}</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl(null)}
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium text-muted hover:text-live-red"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted">
                    PNG, JPEG, or WebP. Automatically cropped to a crisp square avatar.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="prof-fullname" className="block text-xs font-medium">
                  Full name
                </label>
                <input
                  id="prof-fullname"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="prof-nickname" className="block text-xs font-medium">
                  Nickname (optional)
                </label>
                <input
                  id="prof-nickname"
                  type="text"
                  maxLength={40}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. BrianDev"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Shown in the top bar, live session chat, and interactive rooms.
                </p>
              </div>

              <div>
                <label htmlFor="prof-dept" className="block text-xs font-medium">
                  Department
                </label>
                <input
                  id="prof-dept"
                  type="text"
                  maxLength={80}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="h-10 rounded-full border border-border px-5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-signal-green px-5 text-xs font-semibold uppercase tracking-wider text-night-forest disabled:opacity-70"
                >
                  {saving && <KabmeetSignalPrism size="xs" label="Saving profile" />}
                  <span>{saving ? 'Saving...' : 'Save profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
