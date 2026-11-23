export interface RealtimePollOption {
  id: string;
  label: string;
  voterIds: string[];
}

export interface RealtimePoll {
  id: string;
  sessionId: string;
  question: string;
  options: RealtimePollOption[];
  closed: boolean;
  createdAt: string;
}

export function castPollVote(poll: RealtimePoll, optionId: string, voterId: string): RealtimePoll {
  if (poll.closed) return poll;
  return {
    ...poll,
    options: poll.options.map((opt) => {
      const filtered = opt.voterIds.filter((id) => id !== voterId);
      return opt.id === optionId ? { ...opt, voterIds: [...filtered, voterId] } : { ...opt, voterIds: filtered };
    }),
  };
}
