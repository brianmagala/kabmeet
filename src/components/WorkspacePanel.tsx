import React, { useState } from 'react';
import { CheckSquare, Code2, FileText, Plus, Square, Trash2 } from 'lucide-react';
import type { SessionWorkspace } from '../types/kabmeet';

interface WorkspacePanelProps {
  workspace: SessionWorkspace;
  canEdit: boolean;
  onUpdateNotes: (notes: string) => void;
  onUpdateCode: (code: string, codeLanguage: SessionWorkspace['codeLanguage']) => void;
  onAddTask: (title: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export function WorkspacePanel({
  workspace,
  canEdit,
  onUpdateNotes,
  onUpdateCode,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: WorkspacePanelProps) {
  const [subTab, setSubTab] = useState<'notes' | 'code' | 'tasks'>('notes');
  const [taskInput, setTaskInput] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim() || !canEdit) return;
    onAddTask(taskInput.trim());
    setTaskInput('');
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
        <button
          type="button"
          onClick={() => setSubTab('notes')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
            subTab === 'notes'
              ? 'bg-signal-green text-night-forest'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Notes</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('code')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
            subTab === 'code'
              ? 'bg-signal-green text-night-forest'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Code</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tasks')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
            subTab === 'tasks'
              ? 'bg-signal-green text-night-forest'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <CheckSquare className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Tasks ({workspace.tasks.length})</span>
        </button>
      </div>

      {subTab === 'notes' && (
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-[11px] text-muted">
            Shared markdown notes synced in real time across everyone in this session.
          </p>
          <textarea
            aria-label="Shared session notes"
            readOnly={!canEdit}
            value={workspace.notes}
            onChange={(e) => onUpdateNotes(e.target.value)}
            rows={12}
            className="w-full flex-1 resize-none rounded-xl border border-border bg-background p-3 font-sans text-xs leading-relaxed text-foreground"
          />
        </div>
      )}

      {subTab === 'code' && (
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">Collaborative snippet</span>
            <select
              aria-label="Code language"
              disabled={!canEdit}
              value={workspace.codeLanguage}
              onChange={(e) =>
                onUpdateCode(
                  workspace.code,
                  e.target.value as SessionWorkspace['codeLanguage'],
                )
              }
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="python">Python</option>
              <option value="typescript">TypeScript</option>
              <option value="bash">Bash</option>
            </select>
          </div>
          <textarea
            aria-label="Shared collaborative code editor"
            readOnly={!canEdit}
            spellCheck={false}
            value={workspace.code}
            onChange={(e) => onUpdateCode(e.target.value, workspace.codeLanguage)}
            rows={12}
            className="w-full flex-1 resize-none rounded-xl border border-border bg-night-forest p-3 font-mono text-xs leading-relaxed text-mist"
          />
        </div>
      )}

      {subTab === 'tasks' && (
        <div className="flex flex-1 flex-col gap-3">
          {canEdit && (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Add a lab task..."
                className="h-9 flex-1 rounded-full border border-border bg-background px-3 text-xs text-foreground"
              />
              <button
                type="submit"
                aria-label="Add task"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-green text-night-forest"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
              </button>
            </form>
          )}

          <div className="space-y-2 overflow-y-auto">
            {workspace.tasks.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">
                No tasks yet. Add action items for the session.
              </p>
            ) : (
              workspace.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2"
                >
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onToggleTask(task.id)}
                    className="flex flex-1 items-center gap-2 text-left text-xs"
                  >
                    {task.done ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-signal-green" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-muted" />
                    )}
                    <span className={task.done ? 'text-muted line-through' : 'text-foreground'}>
                      {task.title}
                    </span>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      aria-label="Delete task"
                      className="text-muted hover:text-live-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
