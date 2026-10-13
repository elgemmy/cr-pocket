import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useLibrary } from '@/data/libraryStore';
import { cn } from '@/ui';

export interface CategoryPickerProps {
  /** Selected category ids. */
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Multi-select category chips with an inline "New category" creator.
 * Creating auto-selects the category (and reuses an existing one when the
 * name already matches, case-insensitive — see upsertCategory).
 * Used by the deck editor and save sheets.
 */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const categories = useLibrary((s) => s.profile.categories);
  const upsertCategory = useLibrary((s) => s.upsertCategory);
  const [draft, setDraft] = useState('');

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const create = () => {
    const name = draft.trim();
    if (!name) return;
    const id = upsertCategory(name);
    if (!id) return;
    if (!value.includes(id)) onChange([...value, id]);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2.5">
      {categories.length > 0 ? (
        <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const selected = value.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(cat.id)}
                className={cn(
                  'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-150',
                  selected
                    ? 'lip border-transparent bg-gradient-to-b from-royal-400 via-royal-500 to-royal-600 text-white [--lip-color:var(--color-royal-800)]'
                    : 'border-white/10 bg-white/5 text-ink-dim hover:bg-white/10 hover:text-ink',
                )}
              >
                {selected && <Check className="size-4" aria-hidden />}
                {cat.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-faint">No categories yet — create one below.</p>
      )}

      <div className="flex gap-2">
        <label htmlFor="category-picker-new" className="sr-only">
          New category name
        </label>
        <input
          id="category-picker-new"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
          placeholder="New category…"
          maxLength={40}
          className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-royal-400/50 bg-transparent px-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-faint focus:border-royal-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={create}
          disabled={!draft.trim()}
          aria-label="Create category"
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-dashed border-royal-400/50 px-3.5 text-sm font-semibold text-royal-300 transition-colors hover:border-royal-400 hover:bg-royal-500/15 hover:text-royal-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
          Add
        </button>
      </div>
    </div>
  );
}
