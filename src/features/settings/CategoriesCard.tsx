import { useState } from 'react';
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useLibrary } from '@/data/libraryStore';
import type { Category } from '@/domain/types';
import { Button, ConfirmDialog, IconButton, toast } from '@/ui';

/** One row of the category list; inline rename. */
function CategoryRow({ category, deckCount }: { category: Category; deckCount: number }) {
  const renameCategory = useLibrary((s) => s.renameCategory);
  const deleteCategory = useLibrary((s) => s.deleteCategory);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    const name = draft.trim();
    if (!name) return;
    renameCategory(category.id, name);
    setEditing(false);
    toast.success('Category renamed');
  };

  return (
    <li className="flex items-center gap-2 py-1">
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor={`rename-${category.id}`} className="sr-only">
            Rename {category.name}
          </label>
          <input
            id={`rename-${category.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={40}
            autoFocus
            className="h-10 min-w-0 flex-1 rounded-xl border border-royal-400/60 bg-night-950/70 px-3 text-sm font-semibold text-ink focus:outline-none"
          />
          <IconButton aria-label="Save category name" size="sm" type="submit" disabled={!draft.trim()}>
            <Check aria-hidden />
          </IconButton>
          <IconButton
            aria-label="Cancel rename"
            size="sm"
            onClick={() => {
              setEditing(false);
              setDraft(category.name);
            }}
          >
            <X aria-hidden />
          </IconButton>
        </form>
      ) : (
        <>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-royal-500/15 text-royal-300">
            <FolderOpen className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{category.name}</span>
            <span className="block text-xs tabular-nums text-ink-faint">
              {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
            </span>
          </span>
          <IconButton
            aria-label={`Rename ${category.name}`}
            size="sm"
            onClick={() => {
              setDraft(category.name);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden />
          </IconButton>
          <IconButton aria-label={`Delete ${category.name}`} size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden />
          </IconButton>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteCategory(category.id);
          toast.success(`Category “${category.name}” deleted — your decks are safe`);
        }}
        title={`Delete “${category.name}”?`}
        body={
          deckCount > 0
            ? `Only the label is removed — the ${deckCount} deck${deckCount === 1 ? '' : 's'} in it stay on your shelf. Deleting a category never deletes decks.`
            : 'Only the label is removed. Deleting a category never deletes decks.'
        }
        confirmLabel="Delete category"
        tone="danger"
      />
    </li>
  );
}

/** F3 — create / rename / delete categories (decks always survive deletion). */
export function CategoriesCard() {
  const categories = useLibrary((s) => s.profile.categories);
  const decks = useLibrary((s) => s.decks);
  const upsertCategory = useLibrary((s) => s.upsertCategory);
  const [draft, setDraft] = useState('');

  const countFor = (id: string) => decks.filter((d) => d.categoryIds.includes(id)).length;

  const create = () => {
    const name = draft.trim();
    if (!name) return;
    const id = upsertCategory(name);
    setDraft('');
    if (id) toast.success(`Category “${name}” created`);
  };

  return (
    <section className="surface p-4 sm:p-5" aria-labelledby="settings-cats">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-royal-500/20 text-royal-300">
          <FolderOpen className="size-4.5" aria-hidden />
        </span>
        <h2 id="settings-cats" className="font-display text-lg text-ink">
          Categories
        </h2>
      </div>

      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-ink-dim">
          No categories yet. Make a few — “Ladder”, “Challenges”, “2v2 chaos” — and file decks into as
          many as you like.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-white/6">
          {categories.map((cat) => (
            <CategoryRow key={cat.id} category={cat} deckCount={countFor(cat.id)} />
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <label htmlFor="settings-new-category" className="sr-only">
          New category name
        </label>
        <input
          id="settings-new-category"
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
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/12 bg-night-950/70 px-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-faint focus:border-royal-400/70 focus:outline-none"
        />
        <Button variant="violet" icon={<Plus />} disabled={!draft.trim()} onClick={create}>
          Add
        </Button>
      </div>
    </section>
  );
}
