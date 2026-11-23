import React, { useCallback, useEffect, useState } from 'react';
import {
  Flag,
  History,
  Plus,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { KabmeetLoadingCard } from '../components/KabmeetLoader';
import { SiteFooterEditorForm } from '../components/SiteFooter';
import type {
  AuthUser,
  Community,
  ModerationReport,
  RoleAuditEntry,
  UserRole,
} from '../types/kabmeet';

const ALL_ROLES: UserRole[] = [
  'VISITOR',
  'MEMBER',
  'SPEAKER',
  'MODERATOR',
  'HOST',
  'LECTURER',
  'ADMIN',
];

export function AdminPage() {
  const {
    apiFetch,
    navigate,
    role,
    user,
    pushToast,
    isSlowNetwork,
    siteFooter,
    updateSiteFooter,
  } = useKabmeet();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [auditLog, setAuditLog] = useState<RoleAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'users' | 'communities' | 'reports' | 'footer' | 'audit'>('users');

  const [commName, setCommName] = useState('');
  const [commSlug, setCommSlug] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [commAccent, setCommAccent] = useState<'deep-green' | 'kab-blue'>('deep-green');

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        users: AuthUser[];
        communities: Community[];
        reports: ModerationReport[];
        roleAuditLog: RoleAuditEntry[];
      }>('/api/admin/overview');
      setUsers(res.users);
      setCommunities(res.communities);
      setReports(res.reports);
      setAuditLog(res.roleAuditLog);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (role === 'ADMIN') {
      loadAdmin();
    } else {
      setLoading(false);
    }
  }, [role, loadAdmin]);

  if (role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-live-red/40 bg-surface p-8">
          <ShieldAlert className="mx-auto h-10 w-10 text-live-red" />
          <h1 className="mt-4 font-display text-2xl font-bold uppercase">Admin access required</h1>
          <p className="mt-2 text-sm text-muted">
            Only Kabmeet administrators can manage user roles, communities, and moderation reports.
          </p>
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

  const handleRoleChange = async (targetUserId: string, nextRole: UserRole) => {
    try {
      const res = await apiFetch<{ user: AuthUser }>(`/api/admin/users/${targetUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === targetUserId ? res.user : u)));
      pushToast(`Updated ${res.user.fullName} to ${nextRole}.`, 'success');
      loadAdmin();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not update role.', 'error');
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ community: Community }>('/api/admin/communities', {
        method: 'POST',
        body: JSON.stringify({
          name: commName.trim(),
          slug: commSlug.trim().toLowerCase(),
          description: commDesc.trim(),
          accentColor: commAccent,
        }),
      });
      setCommunities((prev) => [...prev, res.community]);
      setCommName('');
      setCommSlug('');
      setCommDesc('');
      pushToast(`${res.community.name} added to Communities.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not add community.', 'error');
    }
  };

  const handleReportStatus = async (
    reportId: string,
    status: 'RESOLVED' | 'DISMISSED',
  ) => {
    try {
      const res = await apiFetch<{ report: ModerationReport }>(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? res.report : r)));
      pushToast(`Report marked ${status.toLowerCase()}.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not update report.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">
            Kabale University Governance
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide">
            Admin Console
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'users', label: `Users (${users.length})` },
              { key: 'communities', label: `Communities (${communities.length})` },
              {
                key: 'reports',
                label: `Reports (${reports.filter((r) => r.status === 'OPEN').length})`,
              },
              { key: 'footer', label: 'Site Footer' },
              { key: 'audit', label: 'Role Audit' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`h-10 rounded-full px-4 text-xs font-semibold ${
                tab === t.key
                  ? 'bg-signal-green text-night-forest'
                  : 'border border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-6">
          <KabmeetLoadingCard
            label="Loading admin console"
            sublabel="Retrieving user directory, communities, and moderation reports."
            slowHint={isSlowNetwork ? 'Weak network detected — still syncing.' : null}
          />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-live-red/40 bg-live-red/10 p-6 text-center">
          <p className="text-sm text-live-red">{error}</p>
        </div>
      ) : (
        <div className="mt-6">
          {tab === 'users' && (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface p-5">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2.5 pr-4 uppercase tracking-wider">Member</th>
                    <th className="py-2.5 pr-4 uppercase tracking-wider">University ID</th>
                    <th className="py-2.5 pr-4 uppercase tracking-wider">Department</th>
                    <th className="py-2.5 uppercase tracking-wider">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60">
                      <td className="py-3 pr-4">
                        <div className="font-semibold">{u.fullName}</div>
                        <div className="text-[11px] text-muted">{u.email}</div>
                      </td>
                      <td className="py-3 pr-4 font-mono">{u.universityId || '—'}</td>
                      <td className="py-3 pr-4 text-muted">{u.department || 'Kabale University'}</td>
                      <td className="py-3">
                        <select
                          aria-label={`Role for ${u.fullName}`}
                          value={u.role}
                          disabled={u.id === user?.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="h-9 rounded-full border border-border bg-background px-3 text-xs font-semibold disabled:opacity-60"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'communities' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-7">
                {communities.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-kab-blue dark:text-signal-green" />
                        <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                        <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[11px] text-muted">
                          /{c.slug}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{c.description}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                      {c.memberCount} members
                    </span>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleCreateCommunity}
                className="space-y-4 rounded-xl border border-border bg-surface p-6 lg:col-span-5"
              >
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
                  <Plus className="h-4 w-4 text-signal-green" />
                  <span>Add campus community</span>
                </h2>
                <div>
                  <label htmlFor="adm-cname" className="block text-xs font-medium">
                    Community name
                  </label>
                  <input
                    id="adm-cname"
                    type="text"
                    required
                    value={commName}
                    onChange={(e) => setCommName(e.target.value)}
                    placeholder="e.g. Kabale Robotics Society"
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="adm-cslug" className="block text-xs font-medium">
                    URL slug
                  </label>
                  <input
                    id="adm-cslug"
                    type="text"
                    required
                    value={commSlug}
                    onChange={(e) => setCommSlug(e.target.value)}
                    placeholder="kabale-robotics"
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="adm-cdesc" className="block text-xs font-medium">
                    Description
                  </label>
                  <textarea
                    id="adm-cdesc"
                    required
                    rows={3}
                    value={commDesc}
                    onChange={(e) => setCommDesc(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="adm-caccent" className="block text-xs font-medium">
                    Header theme
                  </label>
                  <select
                    id="adm-caccent"
                    value={commAccent}
                    onChange={(e) =>
                      setCommAccent(e.target.value as 'deep-green' | 'kab-blue')
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="deep-green">Indaba Deep Green</option>
                    <option value="kab-blue">KAB Blue</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="h-10 w-full rounded-full bg-signal-green text-xs font-semibold uppercase tracking-wider text-night-forest"
                >
                  Create community
                </button>
              </form>
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-10 text-center">
                  <Flag className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-2 text-sm text-muted">No moderation reports submitted yet.</p>
                </div>
              ) : (
                reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-semibold ${
                            rep.status === 'OPEN'
                              ? 'bg-live-red text-white'
                              : 'bg-background text-muted'
                          }`}
                        >
                          {rep.status}
                        </span>
                        <span className="font-semibold">{rep.sessionTitle}</span>
                        <span className="text-muted">· Reported by {rep.reporterName}</span>
                      </div>
                      <p className="mt-2 text-sm">{rep.reason}</p>
                    </div>
                    {rep.status === 'OPEN' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReportStatus(rep.id, 'RESOLVED')}
                          className="h-9 rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportStatus(rep.id, 'DISMISSED')}
                          className="h-9 rounded-full border border-border px-4 text-xs font-semibold"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'footer' && (
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-6">
              <div className="mb-4 border-b border-border pb-3">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                  Site Footer Links &amp; Contact Information
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Changes made here update the SiteFooter displayed at the bottom of the HomePage and across Kabmeet.
                </p>
              </div>
              <SiteFooterEditorForm
                initialValue={siteFooter}
                onSave={async (next) => {
                  await updateSiteFooter(next);
                }}
              />
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-3">
              {auditLog.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-10 text-center">
                  <History className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-2 text-sm text-muted">No role changes have been recorded yet.</p>
                </div>
              ) : (
                auditLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-xs"
                  >
                    <span>
                      <strong>{entry.actorName}</strong> changed{' '}
                      <strong>{entry.targetName}</strong> from{' '}
                      <span className="font-mono">{entry.previousRole}</span> to{' '}
                      <span className="font-mono font-bold text-indaba-deep-green dark:text-signal-green">
                        {entry.newRole}
                      </span>
                    </span>
                    <span className="font-mono text-muted">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
