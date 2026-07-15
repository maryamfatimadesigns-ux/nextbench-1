import { Trash2 } from 'lucide-react';

interface SelectionToolbarProps {
  count: number;
  onDelete: () => void;
  onCancel: () => void;
}

export function SelectionToolbar({ count, onDelete, onCancel }: SelectionToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onDelete} disabled={count === 0} className="p-2 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 rounded-full" title="Delete selected">
        <Trash2 size={18} />
      </button>
      <button onClick={onCancel} className="text-xs font-bold text-luxury-ink/50 hover:text-luxury-ink px-3 py-1.5 rounded-full hover:bg-surface-soft transition-all">
        Cancel
      </button>
    </div>
  );
}
