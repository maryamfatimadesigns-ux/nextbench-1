import React from 'react';
import { Trash2 } from 'lucide-react';

export interface SelectionAction {
  key: string;
  icon: React.ReactNode;
  label: string;          // used as the button title/tooltip
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface SelectionToolbarProps {
  count: number;
  onCancel: () => void;
  /** Legacy chat-message path (Phase 2 ChatHeader): single delete button. */
  onDelete?: () => void;
  /** Configurable action set (inbox multi-select). When present, replaces the
   *  single delete button with these buttons. */
  actions?: SelectionAction[];
}

export function SelectionToolbar({ count, onCancel, onDelete, actions }: SelectionToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {actions ? (
        actions.map((a) => (
          <button
            key={a.key}
            onClick={a.onClick}
            disabled={a.disabled ?? count === 0}
            title={a.label}
            aria-label={a.label}
            className={`p-2 rounded-full transition-colors disabled:opacity-30 ${
              a.danger
                ? 'text-red-500 hover:bg-red-50'
                : 'text-luxury-ink/60 hover:text-luxury-ink hover:bg-surface-soft'
            }`}
          >
            {a.icon}
          </button>
        ))
      ) : (
        <button onClick={onDelete} disabled={count === 0} className="p-2 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 rounded-full" title="Delete selected">
          <Trash2 size={18} />
        </button>
      )}
      <button onClick={onCancel} className="text-xs font-bold text-luxury-ink/50 hover:text-luxury-ink px-3 py-1.5 rounded-full hover:bg-surface-soft transition-all">
        Cancel
      </button>
    </div>
  );
}
