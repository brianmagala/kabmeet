export interface SharedWorkspaceTask {
  id: string;
  title: string;
  assignee: string;
  done: boolean;
}

export interface SharedWorkspaceState {
  notes: string;
  codeLanguage: 'python' | 'typescript' | 'bash';
  code: string;
  tasks: SharedWorkspaceTask[];
}

export function createInitialWorkspace(): SharedWorkspaceState {
  return {
    notes: '# Kabmeet Shared Session Notes\n\nCollaborate live during talks and lab sessions.',
    codeLanguage: 'python',
    code: 'def evaluate_model(scores):\n    return round(sum(scores) / max(len(scores), 1), 3)\n',
    tasks: [],
  };
}
