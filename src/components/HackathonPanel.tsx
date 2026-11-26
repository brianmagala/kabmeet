import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Github, Gavel, LogOut, Trophy, UserMinus, UserPlus, Users } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useLoadingStage } from '../hooks/useLoadingStage';
import { PillPulseButton, SlowStageNotice } from './KabmeetMoments';
import { formatDayShort, formatTime, toLocalInput } from '../lib/eventFormat';
import {
  CRITERION_LABELS,
  JUDGE_CRITERIA,
  TEAM_MAX_MEMBERS,
  type EventView,
  type JudgeCriterion,
  type ResultsView,
  type TeamView,
} from '../shared/events';

interface JudgingScore {
  teamId: string;
  judge: string;
  idea: number;
  build: number;
  demo: number;
  impact: number;
  comment: string;
}

interface HackathonData {
  teams: TeamView[];
  myTeamId: string | null;
  judges: Array<{ userId?: string; name: string }>;
  isJudge: boolean;
  canManage: boolean;
  signupOpen: boolean;
  resultsRevealed: boolean;
  results: ResultsView | null;
  myScores: Array<{ teamId: string; idea: number; build: number; demo: number; impact: number; comment: string }>;
  judging: { scores: JudgingScore[]; progress: Array<{ judge: string; scored: number; of: number }> } | null;
}

const input = 'mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-signal-green';
const primaryBtn = 'h-10 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest transition-transform active:scale-95 disabled:opacity-60';
const ghostBtn = 'inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold transition-transform active:scale-95 [@media(hover:hover)]:hover:border-signal-green';
const card = 'rounded-xl border border-border bg-surface p-4 sm:p-5';

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
      <span className="text-kab-blue dark:text-signal-green">{icon}</span>
      {children}
    </h3>
  );
}

/** Teams, submissions, judging and results for an event that switched hackathon mode on. */
export function HackathonPanel({ event }: { event: EventView }) {
  const { apiFetch, pushToast, role, navigate } = useKabmeet();
  const [data, setData] = useState<HackathonData | null>(null);
  const [loading, setLoading] = useState(true);
  const stage = useLoadingStage(loading);
  const signedIn = role !== 'VISITOR';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<HackathonData>(`/api/events/${event.id}/hackathon`));
    } catch {
      pushToast('Could not load the hackathon.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, event.id, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs a save, reports the server's own message when it refuses, and reloads. */
  const act = useCallback(
    async (path: string, init: RequestInit, success: string): Promise<boolean> => {
      try {
        await apiFetch(path, init);
        if (success) pushToast(success, 'success');
        await load();
        return true;
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'That did not work.', 'error');
        return false;
      }
    },
    [apiFetch, load, pushToast],
  );

  if (loading && !data) {
    return (
      <section aria-label="Hackathon" className="mt-10" role="status">
        <div className="kab-shimmer h-8 w-48 rounded-xl" />
        <div className="kab-shimmer mt-3 h-40 rounded-xl" />
        <SlowStageNotice stage={stage} onRetry={load} />
      </section>
    );
  }
  if (!data) return null;

  const myTeam = data.teams.find((t) => t.id === data.myTeamId) ?? null;
  const base = `/api/events/${event.id}`;

  return (
    <section aria-labelledby="hack-heading" className="mt-12 border-t border-border pt-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">Hackathon</p>
      <h2 id="hack-heading" className="mt-1 font-display text-3xl font-bold uppercase tracking-wide">
        Teams and judging
      </h2>

      {data.results && <Results results={data.results} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {!signedIn ? (
            <div className={card}>
              <p className="text-sm">Sign in to create a team or join one with a code.</p>
              <button type="button" onClick={() => navigate('auth')} className={`${primaryBtn} mt-3`}>
                Sign in
              </button>
            </div>
          ) : myTeam ? (
            <MyTeam team={myTeam} base={base} locked={data.resultsRevealed} act={act} />
          ) : data.signupOpen ? (
            <JoinOrCreate base={base} act={act} />
          ) : (
            <p className={`${card} text-sm text-muted`}>Team sign-up is closed.</p>
          )}

          {data.canManage && <HostTools base={base} data={data} act={act} />}
        </div>

        <div className="space-y-6">
          <TeamList teams={data.teams} canManage={data.canManage} base={base} act={act} />
          {data.isJudge && !data.resultsRevealed && <JudgePanel base={base} data={data} act={act} />}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function JoinOrCreate({ base, act }: { base: string; act: (p: string, i: RequestInit, s: string) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  return (
    <div className="space-y-4">
      <form
        className={card}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy('create');
          const ok = await act(`${base}/teams`, { method: 'POST', body: JSON.stringify({ name, idea }) }, 'Team created. Share its code with your team mates.');
          setBusy(null);
          if (ok) {
            setName('');
            setIdea('');
          }
        }}
      >
        <SectionTitle icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}>Start a team</SectionTitle>
        <label className="mt-3 block text-xs font-medium">
          Team name
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} className={input} placeholder="Kabale Coders" />
        </label>
        <label className="mt-3 block text-xs font-medium">
          Project idea (one or two lines)
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} required maxLength={300} rows={2} className={input} />
        </label>
        <PillPulseButton type="submit" busy={busy === 'create'} busyLabel="Creating..." className={`${primaryBtn} mt-4`}>
          Create team
        </PillPulseButton>
        <p className="mt-2 text-[11px] text-muted">You get a 6-character code. Up to {TEAM_MAX_MEMBERS} people per team, one team each.</p>
      </form>

      <form
        className={card}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy('join');
          const ok = await act(`${base}/teams/join`, { method: 'POST', body: JSON.stringify({ code }) }, 'You joined the team.');
          setBusy(null);
          if (ok) setCode('');
        }}
      >
        <SectionTitle icon={<Users className="h-5 w-5" aria-hidden="true" />}>Join with a code</SectionTitle>
        <label className="mt-3 block text-xs font-medium">
          Team code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            minLength={6}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={`${input} font-mono text-lg uppercase tracking-[0.3em]`}
            placeholder="ABC234"
          />
        </label>
        <PillPulseButton type="submit" busy={busy === 'join'} busyLabel="Joining..." className={`${primaryBtn} mt-4`}>
          Join team
        </PillPulseButton>
      </form>
    </div>
  );
}

function MyTeam({
  team,
  base,
  locked,
  act,
}: {
  team: TeamView;
  base: string;
  locked: boolean;
  act: (p: string, i: RequestInit, s: string) => Promise<boolean>;
}) {
  const { user } = useKabmeet();
  const [name, setName] = useState(team.name);
  const [repoUrl, setRepoUrl] = useState(team.repoUrl ?? '');
  const [summary, setSummary] = useState(team.summary ?? '');
  const [busy, setBusy] = useState<'rename' | 'submit' | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(team.joinCode ?? '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the code is on screen, people can read it out */
    }
  };

  return (
    <div className={card}>
      <SectionTitle icon={<Users className="h-5 w-5" aria-hidden="true" />}>Your team</SectionTitle>
      <p className="mt-2 font-semibold">{team.name}</p>
      <p className="text-xs text-muted">{team.idea}</p>

      {team.joinCode && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-signal-green/60 bg-signal-green/5 p-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Team code</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em]" aria-label={`Team code ${team.joinCode.split('').join(' ')}`}>
              {team.joinCode}
            </p>
          </div>
          <button type="button" onClick={copy} className={ghostBtn}>
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {team.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {m.name}
              {m.isCreator && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Creator</span>}
              {m.userId === user?.id && <span className="ml-2 text-[11px] text-muted">(you)</span>}
            </span>
            {team.isCreator && m.userId !== user?.id && !locked && (
              <button type="button" onClick={() => act(`${base}/teams/${team.id}/members/${m.userId}`, { method: 'DELETE' }, `${m.name} was removed.`)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-live-red" aria-label={`Remove ${m.name}`}>
                <UserMinus className="h-3.5 w-3.5" aria-hidden="true" /> Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-muted">
        {team.members.length} of {TEAM_MAX_MEMBERS} places filled
      </p>

      {!locked && team.isCreator && (
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy('rename');
            await act(`${base}/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }, 'Team renamed.');
            setBusy(null);
          }}
        >
          <label className="block flex-1 text-xs font-medium">
            Rename team
            <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required className={input} />
          </label>
          <PillPulseButton type="submit" busy={busy === 'rename'} busyLabel="Saving..." disabled={name.trim() === team.name} className={ghostBtn}>
            Save
          </PillPulseButton>
        </form>
      )}

      {!locked ? (
        <form
          className="mt-5 border-t border-border pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy('submit');
            await act(`${base}/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify({ repoUrl: repoUrl.trim() || null, summary: summary.trim() || null }) }, 'Submission saved.');
            setBusy(null);
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider">Your submission</p>
          <label className="mt-2 block text-xs font-medium">
            Repository or demo link (https)
            <input type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} maxLength={500} className={input} placeholder="https://github.com/your-team/project" />
          </label>
          <label className="mt-3 block text-xs font-medium">
            Summary (two sentences)
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={400} rows={3} className={input} />
          </label>
          <PillPulseButton type="submit" busy={busy === 'submit'} busyLabel="Saving..." className={`${primaryBtn} mt-3`}>
            Save submission
          </PillPulseButton>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted">Results are out, so your team is locked.</p>
      )}

      {!locked && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Leave this team? You can join another one with a code.')) void act(`${base}/teams/${team.id}/members/${user?.id}`, { method: 'DELETE' }, 'You left the team.');
          }}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-live-red"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Leave team
        </button>
      )}
    </div>
  );
}

function TeamList({
  teams,
  canManage,
  base,
  act,
}: {
  teams: TeamView[];
  canManage: boolean;
  base: string;
  act: (p: string, i: RequestInit, s: string) => Promise<boolean>;
}) {
  const withDemo = teams.filter((t) => t.demoAt).sort((a, b) => new Date(a.demoAt!).getTime() - new Date(b.demoAt!).getTime());
  return (
    <div className={card}>
      <SectionTitle icon={<Users className="h-5 w-5" aria-hidden="true" />}>Teams ({teams.length})</SectionTitle>
      {withDemo.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Demo slots</p>
          <ol className="mt-2 space-y-1 text-sm">
            {withDemo.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 font-mono tabular-nums">
                  {formatDayShort(t.demoAt!)}, {formatTime(t.demoAt!)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {teams.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No teams yet. Be the first to start one.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {teams.map((t) => (
            <li key={t.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{t.name}</p>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                  {t.members.length}/{TEAM_MAX_MEMBERS}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{t.idea}</p>
              {t.summary && <p className="mt-2 text-xs">{t.summary}</p>}
              {t.repoUrl && (
                <a href={t.repoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-kab-blue underline-offset-2 hover:underline dark:text-signal-green">
                  <Github className="h-3.5 w-3.5" aria-hidden="true" /> Repository or demo
                </a>
              )}
              {canManage && (
                <label className="mt-3 block text-[11px] font-medium text-muted">
                  Demo time
                  <input
                    type="datetime-local"
                    defaultValue={t.demoAt ? toLocalInput(t.demoAt) : ''}
                    onBlur={(e) => {
                      const next = e.target.value ? new Date(e.target.value).toISOString() : null;
                      if (next !== t.demoAt) void act(`${base}/teams/${t.id}/demo`, { method: 'PUT', body: JSON.stringify({ demoAt: next }) }, 'Demo time saved.');
                    }}
                    className={input}
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HostTools({ base, data, act }: { base: string; data: HackathonData; act: (p: string, i: RequestInit, s: string) => Promise<boolean> }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'judge' | 'reveal' | null>(null);
  const progress = data.judging?.progress ?? [];

  return (
    <div className={card}>
      <SectionTitle icon={<Gavel className="h-5 w-5" aria-hidden="true" />}>Judges and results</SectionTitle>
      {!data.resultsRevealed && (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy('judge');
            const ok = await act(`${base}/judges`, { method: 'POST', body: JSON.stringify({ email }) }, 'Judge added.');
            setBusy(null);
            if (ok) setEmail('');
          }}
        >
          <label className="block flex-1 text-xs font-medium">
            Add a judge (email of a Kabmeet account)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} />
          </label>
          <PillPulseButton type="submit" busy={busy === 'judge'} busyLabel="Adding..." className={ghostBtn}>
            Add
          </PillPulseButton>
        </form>
      )}

      {data.judges.length === 0 ? (
        <p className="mt-3 text-xs text-muted">No judges yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.judges.map((j) => {
            const p = progress.find((x) => x.judge === j.name);
            return (
              <li key={j.userId ?? j.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{j.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  {p && (
                    <span className="font-mono text-[11px] tabular-nums text-muted">
                      {p.scored}/{p.of} scored
                    </span>
                  )}
                  {!data.resultsRevealed && j.userId && (
                    <button type="button" onClick={() => act(`${base}/judges/${j.userId}`, { method: 'DELETE' }, `${j.name} was removed as a judge.`)} className="text-[11px] font-semibold text-live-red" aria-label={`Remove judge ${j.name}`}>
                      Remove
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!data.resultsRevealed ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted">Scores stay private to the judges and to you until you reveal. Revealing cannot be undone and locks teams and scores.</p>
          <PillPulseButton
            type="button"
            busy={busy === 'reveal'}
            busyLabel="Revealing..."
            onClick={async () => {
              if (!window.confirm('Reveal the results to everyone? This cannot be undone.')) return;
              setBusy('reveal');
              await act(`${base}/reveal`, { method: 'POST', body: '{}' }, 'Results revealed.');
              setBusy(null);
            }}
            className={`${primaryBtn} mt-3 inline-flex items-center gap-2`}
          >
            <Trophy className="h-4 w-4" aria-hidden="true" /> Reveal results
          </PillPulseButton>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">Results are public. Teams, judges and scores are locked.</p>
      )}
    </div>
  );
}

function JudgePanel({ base, data, act }: { base: string; data: HackathonData; act: (p: string, i: RequestInit, s: string) => Promise<boolean> }) {
  const teams = data.teams.filter((t) => !t.isMine);
  return (
    <div className={card}>
      <SectionTitle icon={<Gavel className="h-5 w-5" aria-hidden="true" />}>Your scores</SectionTitle>
      <p className="mt-2 text-xs text-muted">Score each team from 1 to 5 on four things. Only you and the host can see your scores until the results are revealed. You cannot score your own team.</p>
      {teams.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No teams to score yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {teams.map((t) => (
            <ScoreForm key={t.id} team={t} saved={data.myScores.find((s) => s.teamId === t.id)} base={base} act={act} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreForm({
  team,
  saved,
  base,
  act,
}: {
  team: TeamView;
  saved?: { idea: number; build: number; demo: number; impact: number; comment: string };
  base: string;
  act: (p: string, i: RequestInit, s: string) => Promise<boolean>;
}) {
  const [values, setValues] = useState<Record<JudgeCriterion, number>>({
    idea: saved?.idea ?? 0,
    build: saved?.build ?? 0,
    demo: saved?.demo ?? 0,
    impact: saved?.impact ?? 0,
  });
  const [comment, setComment] = useState(saved?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const complete = JUDGE_CRITERIA.every((c) => values[c] >= 1);

  return (
    <li className="rounded-xl border border-border p-3">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await act(`${base}/scores/${team.id}`, { method: 'PUT', body: JSON.stringify({ ...values, comment }) }, `Scores saved for ${team.name}.`);
          setBusy(false);
        }}
      >
        <p className="flex items-center justify-between gap-2 font-semibold">
          {team.name}
          {saved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-kab-blue dark:text-signal-green">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved
            </span>
          )}
        </p>
        {JUDGE_CRITERIA.map((c) => (
          <fieldset key={c} className="mt-2">
            <legend className="text-xs font-medium">{CRITERION_LABELS[c]}</legend>
            <div className="mt-1 flex gap-1.5" role="radiogroup" aria-label={`${CRITERION_LABELS[c]} score for ${team.name}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={values[c] === n}
                  onClick={() => setValues((v) => ({ ...v, [c]: n }))}
                  className={`h-10 w-10 rounded-full border font-mono text-sm font-bold tabular-nums transition-colors active:scale-95 ${
                    values[c] === n ? 'border-signal-green bg-signal-green text-night-forest' : 'border-border bg-background'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="mt-3 block text-xs font-medium">
          Comment (optional, private)
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} className={input} />
        </label>
        <PillPulseButton type="submit" busy={busy} busyLabel="Saving..." disabled={!complete} className={`${primaryBtn} mt-3`}>
          {saved ? 'Update scores' : 'Save scores'}
        </PillPulseButton>
      </form>
    </li>
  );
}

function Results({ results }: { results: ResultsView }) {
  const medal = (rank: number) => (rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);
  return (
    <div className="mt-5 rounded-xl border border-amber-gold/60 bg-surface p-4 sm:p-6">
      <h3 className="font-display text-2xl font-bold uppercase tracking-wide">Results</h3>
      {results.ranking.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No scores were recorded.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {results.ranking.map((r) => (
            <li key={r.teamId} className={`rounded-xl border p-3 ${r.rank === 1 ? 'border-amber-gold bg-amber-gold/10' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-center font-mono text-lg font-bold tabular-nums">
                  {medal(r.rank) ? (
                    <>
                      <span aria-hidden="true" className="text-2xl">{medal(r.rank)}</span>
                      <span className="sr-only">Rank {r.rank}</span>
                    </>
                  ) : (
                    r.rank
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.teamName}</span>
                  <span className="block text-[11px] text-muted">{r.rank === 1 ? 'Winner' : r.rank === 2 ? 'Runner-up' : `Rank ${r.rank}`} · scored by {r.judges} {r.judges === 1 ? 'judge' : 'judges'}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-xl font-bold tabular-nums">{r.total.toFixed(2)}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-muted">out of 5</span>
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                {JUDGE_CRITERIA.map((c) => (
                  <div key={c}>
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">{CRITERION_LABELS[c]}</dt>
                    <dd className="font-mono text-sm font-bold tabular-nums">{r.average[c].toFixed(1)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
