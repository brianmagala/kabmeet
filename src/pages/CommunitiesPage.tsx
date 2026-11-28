import React, { useCallback, useEffect, useState } from 'react';
import { announceFollow } from '../lib/push';
import { ArrowLeft, CalendarDays, MessageSquare, Play, Users } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { ShimmerGrid, SlowStageNotice } from '../components/KabmeetMoments';
import { useLoadingStage } from '../hooks/useLoadingStage';
import type { Community, CommunityPost, KabSession } from '../types/kabmeet';

export function CommunitiesPage() {
  const { apiFetch, activeCommunitySlug, navigate, user, role, pushToast, isSlowNetwork } =
    useKabmeet();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [detail, setDetail] = useState<{
    community: Community;
    sessions: KabSession[];
    posts: CommunityPost[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const loadStage = useLoadingStage(loading);
  const [error, setError] = useState<string | null>(null);

  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [posting, setPosting] = useState(false);

  const canPost =
    role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER' || role === 'ADMIN';

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeCommunitySlug) {
        const data = await apiFetch<{
          community: Community;
          sessions: KabSession[];
          posts: CommunityPost[];
        }>(`/api/communities/${activeCommunitySlug}`);
        setDetail(data);
      } else {
        const res = await apiFetch<{ communities: Community[] }>('/api/communities');
        setCommunities(res.communities);
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load communities.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, activeCommunitySlug]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const handleFollow = async (slug: string) => {
    if (!user) {
      pushToast('Sign in to follow communities.', 'info');
      navigate('auth');
      return;
    }
    try {
      const res = await apiFetch<{ isFollowing: boolean; memberCount: number }>(
        `/api/communities/${slug}/follow`,
        { method: 'POST' },
      );
      if (res.isFollowing) announceFollow();
      if (detail && detail.community.slug === slug) {
        setDetail({
          ...detail,
          community: {
            ...detail.community,
            isFollowing: res.isFollowing,
            memberCount: res.memberCount,
          },
        });
      }
      setCommunities((prev) =>
        prev.map((c) =>
          c.slug === slug
            ? { ...c, isFollowing: res.isFollowing, memberCount: res.memberCount }
            : c,
        ),
      );
      pushToast(res.isFollowing ? 'Community followed.' : 'Unfollowed community.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setPosting(true);
    try {
      const res = await apiFetch<{ post: CommunityPost }>(
        `/api/communities/${detail.community.slug}/posts`,
        {
          method: 'POST',
          body: JSON.stringify({ title: postTitle, body: postBody }),
        },
      );
      setDetail({ ...detail, posts: [res.post, ...detail.posts] });
      setPostTitle('');
      setPostBody('');
      pushToast('Announcement posted to community.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not publish post.', 'error');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loadStage === 0 ? (
          <div aria-hidden="true" className="min-h-[320px]" />
        ) : (
          <>
            <ShimmerGrid
              count={4}
              className="grid gap-6 md:grid-cols-2"
              label="Loading Kabale communities"
            />
            <div className="flex justify-center">
              <SlowStageNotice
                stage={loadStage}
                extraHint={isSlowNetwork ? 'Weak network. Community feeds will fill in as they arrive.' : null}
                onRetry={loadCommunities}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm font-medium text-live-red">{error}</p>
        <button
          type="button"
          onClick={loadCommunities}
          className="mt-4 h-10 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest"
        >
          Retry
        </button>
      </div>
    );
  }

  if (detail) {
    const { community, sessions, posts } = detail;
    const upcoming = sessions.filter((s) => s.status !== 'REPLAY');
    const replays = sessions.filter((s) => s.status === 'REPLAY');

    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('communities', { communitySlug: null })}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-kab-blue hover:underline dark:text-signal-green"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          <span>All communities</span>
        </button>

        {/* Community Header */}
        <section
          className={`rounded-xl border border-border p-6 text-white sm:p-8 ${
            community.accentColor === 'kab-blue' ? 'bg-kab-blue' : 'bg-indaba-deep-green'
          }`}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-sun-yellow">
                Kabale University Community
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
                {community.name}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-white/90">{community.description}</p>
              <p className="mt-3 font-mono text-xs tabular-nums text-white/85">
                {community.memberCount} members
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleFollow(community.slug)}
              className={`h-11 shrink-0 whitespace-nowrap rounded-full px-6 text-xs font-semibold uppercase tracking-wider transition-transform active:scale-[0.98] ${
                community.isFollowing
                  ? 'border border-white/40 bg-white/15 text-white'
                  : 'bg-signal-green text-night-forest'
              }`}
            >
              {community.isFollowing ? 'Following' : 'Follow community'}
            </button>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Left 2 Columns: Upcoming/Live & Past Replays */}
          <div className="space-y-8 lg:col-span-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase tracking-wide">
                <CalendarDays className="h-5 w-5 text-indaba-deep-green dark:text-signal-green" />
                <span>Live &amp; upcoming sessions</span>
              </h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 rounded-xl border border-border bg-surface p-6 text-sm text-muted">
                  No upcoming sessions scheduled right now. Follow this community to get notified.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {upcoming.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-border bg-surface p-4"
                    >
                      <p className="text-xs text-muted">
                        {s.status} · {s.hostName}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-semibold">{s.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{s.description}</p>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(s.mode === 'ROOM' ? 'room' : 'watch', { sessionId: s.id })
                        }
                        className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>{s.status === 'LIVE' ? 'Open now' : 'View details'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase tracking-wide">
                <Play className="h-5 w-5 text-kab-blue" />
                <span>Past replays</span>
              </h2>
              {replays.length === 0 ? (
                <p className="mt-3 rounded-xl border border-border bg-surface p-6 text-sm text-muted">
                  Replays will appear here once a session finishes recording.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {replays.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-xs text-muted">
                          Replay · {r.hostName} · Peak {r.peakViewers} viewers
                        </p>
                        <h3 className="font-display text-lg font-semibold">{r.title}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('watch', { sessionId: r.id })}
                        className="h-9 shrink-0 rounded-full border border-border px-4 text-xs font-semibold hover:border-amber-gold"
                      >
                        Watch replay
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Community Posts */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase tracking-wide">
              <MessageSquare className="h-5 w-5 text-indaba-deep-green dark:text-signal-green" />
              <span>Club posts</span>
            </h2>

            {canPost && (
              <form
                onSubmit={handleCreatePost}
                className="space-y-3 rounded-xl border border-border bg-surface p-4"
              >
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
                <textarea
                  required
                  rows={3}
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share updates, datasets, or meetup notes..."
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={posting}
                  className="h-9 rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest"
                >
                  {posting ? 'Posting...' : 'Publish post'}
                </button>
              </form>
            )}

            {posts.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface p-5 text-xs text-muted">
                No club posts yet.
              </p>
            ) : (
              posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <p className="text-xs text-muted">
                    {post.authorName} · {post.authorRole}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold">{post.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{post.body}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">
          Kabale University Chapters
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Communities
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Follow student tech clubs and research groups to see their live sessions, upcoming labs,
          and club posts in one place.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {communities.map((c) => (
          <article
            key={c.slug}
            className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-white ${
                    c.accentColor === 'kab-blue' ? 'bg-kab-blue' : 'bg-indaba-deep-green'
                  }`}
                >
                  <Users className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {c.memberCount} members
                </span>
              </div>
              <h2 className="mt-4 font-display text-2xl font-semibold uppercase tracking-wide">
                {c.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.description}</p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('communities', { communitySlug: c.slug })}
                className="h-10 flex-1 rounded-full bg-signal-green text-xs font-semibold uppercase tracking-wider text-night-forest"
              >
                Open community
              </button>
              <button
                type="button"
                onClick={() => handleFollow(c.slug)}
                className={`h-10 rounded-full px-4 text-xs font-semibold ${
                  c.isFollowing
                    ? 'bg-sun-yellow text-night-forest'
                    : 'border border-border text-foreground hover:border-amber-gold'
                }`}
              >
                {c.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
