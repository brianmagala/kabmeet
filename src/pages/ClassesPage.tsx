import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  Lock,
  Plus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { KabmeetLoadingCard, KabmeetSignalPrism } from '../components/KabmeetLoader';
import type { AttendanceRecord, Community, KabSession } from '../types/kabmeet';

interface VirtualClassItem extends KabSession {
  attendanceCount?: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (mins === 0) return `${rem}s`;
  return `${mins}m ${rem}s`;
}

export function ClassesPage() {
  const { apiFetch, signedIn, navigate, user, role, pushToast, isSlowNetwork } = useKabmeet();
  const [classes, setClasses] = useState<VirtualClassItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [communitySlug, setCommunitySlug] = useState('kab-ai');
  const [studentsInput, setStudentsInput] = useState('');
  const [creating, setCreating] = useState(false);

  const [attendanceModalClass, setAttendanceModalClass] = useState<VirtualClassItem | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const canCreateClass = role === 'LECTURER' || role === 'ADMIN';

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clsRes, commRes] = await Promise.all([
        apiFetch<{ classes: VirtualClassItem[] }>('/api/classes'),
        apiFetch<{ communities: Community[] }>('/api/communities'),
      ]);
      setClasses(clsRes.classes);
      setCommunities(commRes.communities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load virtual classes right now.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const allowedStudents = studentsInput
      .split(/[\n,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (allowedStudents.length === 0) {
      pushToast('Enter at least one student email or Kabale University ID.', 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch<{ classSession: VirtualClassItem }>('/api/classes', {
        method: 'POST',
        body: JSON.stringify({
          courseCode: courseCode.trim(),
          title: title.trim(),
          description: description.trim(),
          communitySlug,
          allowedStudents,
        }),
      });
      setClasses((prev) => [res.classSession, ...prev]);
      setCreateOpen(false);
      setCourseCode('');
      setTitle('');
      setDescription('');
      setStudentsInput('');
      pushToast('Private virtual class created. Only allowed students can join.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not create virtual class.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openAttendance = async (cls: VirtualClassItem) => {
    setAttendanceModalClass(cls);
    setAttendanceLoading(true);
    try {
      const res = await apiFetch<{ records: AttendanceRecord[] }>(
        `/api/classes/${cls.id}/attendance`,
      );
      setAttendanceRecords(res.records);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to fetch attendance.', 'error');
      setAttendanceModalClass(null);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleExportCsv = async (cls: VirtualClassItem) => {
    if (!signedIn) {
      pushToast('Please sign in first to export CSV attendance.', 'error');
      return;
    }
    setExportingId(cls.id);
    try {
      const response = await fetch(`/api/classes/${cls.id}/attendance.csv`, { credentials: 'same-origin' });
      if (!response.ok) {
        let message = 'Unable to export attendance CSV.';
        try {
          const data = (await response.json()) as { message?: string };
          if (data.message) message = data.message;
        } catch {
          // Fallback message
        }
        throw new Error(message);
      }
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const safeCode = (cls.courseCode ?? 'class').replace(/[^a-zA-Z0-9_-]/g, '_');
      anchor.href = url;
      anchor.download = `${safeCode}_attendance.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      pushToast(`Exported ${safeCode} attendance CSV.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'CSV export failed.', 'error');
    } finally {
      setExportingId(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-surface p-8">
          <Lock className="mx-auto h-10 w-10 text-kab-blue dark:text-signal-green" strokeWidth={2} />
          <h1 className="mt-4 font-display text-2xl font-bold uppercase">
            Sign in for private classes
          </h1>
          <p className="mt-2 text-sm text-muted">
            Kabale University virtual classes restrict access to enrolled students and track
            attendance automatically on your account.
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">
            Private Lecture Rooms &amp; Automatic Attendance
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide">
            Virtual Classes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Only students selected by the course lecturer receive the Join button and server
            permission to enter.
          </p>
        </div>

        {canCreateClass && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-signal-green px-5 text-xs font-semibold uppercase tracking-wider text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            <span>Create private class</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-6">
          <KabmeetLoadingCard
            label="Loading private virtual classes"
            sublabel="Checking enrolled courses and lecturer attendance rosters."
            slowHint={isSlowNetwork ? 'Weak network detected — syncing your class list.' : null}
          />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-live-red/40 bg-live-red/10 p-6 text-center">
          <p className="text-sm font-medium text-live-red">{error}</p>
          <button
            type="button"
            onClick={loadClasses}
            className="mt-4 h-10 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest"
          >
            Try again
          </button>
        </div>
      ) : classes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-10 text-center">
          <BookOpen className="mx-auto h-9 w-9 text-muted" strokeWidth={2} />
          <h2 className="mt-3 font-display text-xl font-semibold uppercase">
            No virtual classes scheduled
          </h2>
          <p className="mt-1 text-sm text-muted">
            When a lecturer creates a private class for your course, it will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {classes.map((cls) => {
            const isManager = role === 'ADMIN' || cls.hostId === user.id;
            return (
              <article
                key={cls.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-indaba-deep-green px-3 py-1 font-mono text-xs font-semibold text-white">
                      {cls.courseCode || 'COURSE'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                      {cls.canJoin ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-signal-green" />
                          <span>Enrolled</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5 text-amber-gold" />
                          <span>Restricted roster</span>
                        </>
                      )}
                    </span>
                  </div>

                  <h2 className="mt-3 font-display text-2xl font-bold leading-snug">{cls.title}</h2>
                  <p className="mt-1 text-xs text-muted">
                    Lecturer: <strong className="text-foreground">{cls.hostName}</strong> ·{' '}
                    {cls.communityName}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{cls.description}</p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
                  {cls.canJoin ? (
                    <button
                      type="button"
                      onClick={() => navigate('room', { sessionId: cls.id })}
                      className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
                    >
                      <Video className="h-4 w-4" strokeWidth={2} />
                      <span>Join class</span>
                    </button>
                  ) : (
                    <div className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-xs font-medium text-muted">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Not on student roster</span>
                    </div>
                  )}

                  {isManager && (
                    <>
                      <button
                        type="button"
                        onClick={() => openAttendance(cls)}
                        className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background px-4 text-xs font-semibold hover:border-amber-gold"
                      >
                        <ClipboardList className="h-4 w-4" strokeWidth={2} />
                        <span>
                          Attendance ({cls.attendanceCount ?? 0})
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={exportingId === cls.id}
                        onClick={() => handleExportCsv(cls)}
                        className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-kab-blue px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" strokeWidth={2} />
                        <span>{exportingId === cls.id ? 'Exporting...' : 'Export CSV'}</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Private Class Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create private virtual class"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 text-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                New private virtual class
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cls-code" className="block text-xs font-medium">
                    Course code
                  </label>
                  <input
                    id="cls-code"
                    type="text"
                    required
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSC 3204"
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cls-comm" className="block text-xs font-medium">
                    Department / Club
                  </label>
                  <select
                    id="cls-comm"
                    value={communitySlug}
                    onChange={(e) => setCommunitySlug(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    {communities.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="cls-title" className="block text-xs font-medium">
                  Class topic
                </label>
                <input
                  id="cls-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Neural Networks & Backpropagation Lab"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="cls-desc" className="block text-xs font-medium">
                  Brief syllabus note
                </label>
                <textarea
                  id="cls-desc"
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Lab instructions and attendance requirements."
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
                />
              </div>

              <div>
                <label htmlFor="cls-roster" className="block text-xs font-medium">
                  Allowed students (emails or KAB registration IDs, separated by comma or new line)
                </label>
                <textarea
                  id="cls-roster"
                  required
                  rows={3}
                  value={studentsInput}
                  onChange={(e) => setStudentsInput(e.target.value)}
                  placeholder="student1@kab.ac.ug, 2023/BIT/014"
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="h-10 rounded-full border border-border px-5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="h-10 rounded-full bg-signal-green px-5 text-xs font-semibold uppercase tracking-wider text-night-forest"
                >
                  {creating ? 'Creating...' : 'Create class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Drawer / Modal */}
      {attendanceModalClass && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Class attendance roster"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface-elevated p-6 text-foreground shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                  Attendance · {attendanceModalClass.courseCode}
                </h2>
                <p className="text-xs text-muted">{attendanceModalClass.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportCsv(attendanceModalClass)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-kab-blue px-4 text-xs font-semibold text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceModalClass(null)}
                  aria-label="Close attendance"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {attendanceLoading ? (
                <KabmeetLoadingCard
                  compact
                  label="Loading attendance roster"
                  sublabel="Fetching student check-in times and duration."
                />
              ) : attendanceRecords.length === 0 ? (
                <div className="rounded-xl border border-border bg-background p-8 text-center">
                  <Users className="mx-auto h-7 w-7 text-muted" />
                  <p className="mt-2 text-sm text-muted">
                    No students have checked into this virtual class yet.
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="py-2.5 pr-3 font-semibold uppercase tracking-wider">Reg ID</th>
                      <th className="py-2.5 pr-3 font-semibold uppercase tracking-wider">Student</th>
                      <th className="py-2.5 pr-3 font-semibold uppercase tracking-wider">Joined</th>
                      <th className="py-2.5 font-semibold uppercase tracking-wider">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((rec) => (
                      <tr key={rec.id} className="border-b border-border/60">
                        <td className="py-2.5 pr-3 font-mono">{rec.universityId}</td>
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold">{rec.fullName}</div>
                          <div className="text-[11px] text-muted">{rec.email}</div>
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-muted">
                          {new Date(rec.joinedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 font-mono font-semibold tabular-nums text-indaba-deep-green dark:text-signal-green">
                          {formatDuration(rec.durationSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
