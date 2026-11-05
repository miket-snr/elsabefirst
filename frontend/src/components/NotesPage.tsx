import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Note, NoteFields } from "../types";
import { api } from "../api";

const EMPTY_NOTE: NoteFields = { title: "", content: "" };

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fields, setFields] = useState<NoteFields>(EMPTY_NOTE);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = await api.listNotes();
      setNotes(loaded);
      setSelectedId((current) =>
        current !== null && loaded.some((note) => note.id === current)
          ? current
          : null,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  function chooseNote(note: Note) {
    setSelectedId(note.id);
    setFields({ title: note.title, content: note.content });
    setIsNew(false);
    setError("");
  }

  function startNewNote() {
    setSelectedId(null);
    setFields(EMPTY_NOTE);
    setIsNew(true);
    setError("");
  }

  function changeField(key: keyof NoteFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let saved: Note;
      if (isNew) {
        saved = await api.createNote(fields);
      } else if (selectedId !== null) {
        saved = await api.updateNote(selectedId, fields);
      } else {
        throw new Error("Select or create a note before saving");
      }
      setNotes((current) =>
        [...current.filter((note) => note.id !== saved.id), saved].sort(
          (left, right) => right.updated_at.localeCompare(left.updated_at),
        ),
      );
      setSelectedId(saved.id);
      setFields({ title: saved.title, content: saved.content });
      setIsNew(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  const activeNote = notes.find((note) => note.id === selectedId);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">YOUR THOUGHTS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-muted">Capture a thought, reminder, or idea.</p>
        </div>
        <button className="primary-button" onClick={startNewNote} type="button">
          <span aria-hidden="true" className="text-lg leading-none">+</span> New note
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
          {!isNew && selectedId === null && (
            <button className="font-semibold underline" onClick={() => void loadNotes()}>Try again</button>
          )}
        </div>
      )}

      <div className="grid min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-100 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">All notes</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted">{notes.length}</span>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-2">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-muted">Loading notes…</p>
            ) : notes.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm leading-6 text-muted">
                No notes yet. Select <span className="font-medium text-ink">New note</span> to get started.
              </p>
            ) : (
              <ul className="space-y-1">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      aria-current={selectedId === note.id ? "page" : undefined}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        selectedId === note.id
                          ? "bg-emerald-50 text-brand"
                          : "text-ink hover:bg-slate-50"
                      }`}
                      onClick={() => chooseNote(note)}
                      type="button"
                    >
                      <span className="block truncate text-sm font-medium">{note.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted">{note.content}</span>
                      <span className="mt-2 block text-[11px] text-muted">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="p-5 sm:p-8">
          {isNew || activeNote ? (
            <form className="flex h-full flex-col" onSubmit={saveNote}>
              <div className="mb-6 border-b border-slate-100 pb-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {isNew ? "NEW NOTE" : "EDIT NOTE"}
                </p>
                <label className="mt-3 block">
                  <span className="sr-only">Note title</span>
                  <input
                    autoFocus={isNew}
                    className="w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight text-ink outline-none placeholder:text-slate-300 focus:ring-0"
                    maxLength={120}
                    onChange={(event) => changeField("title", event.target.value)}
                    placeholder="Untitled note"
                    required
                    value={fields.title}
                  />
                </label>
                <p className="mt-2 text-right text-xs text-muted">{fields.title.length}/120</p>
              </div>
              <label className="flex flex-1 flex-col">
                <span className="sr-only">Note text</span>
                <textarea
                  className="min-h-[280px] flex-1 resize-y border-0 bg-transparent p-0 text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-300 focus:ring-0"
                  maxLength={20000}
                  onChange={(event) => changeField("content", event.target.value)}
                  placeholder="Write your note here…"
                  required
                  value={fields.content}
                />
              </label>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-xs text-muted">{fields.content.length}/20000 characters</p>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? "Saving…" : isNew ? "Create note" : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-brand">
                <NoteIcon />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-ink">
                {notes.length ? "Choose a note" : "Make space for a thought"}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                {notes.length
                  ? "Click a note in the list to read or edit it."
                  : "Create your first note and it will appear in the list here."}
              </p>
              {!notes.length && (
                <button className="secondary-button mt-5" onClick={startNewNote} type="button">
                  Create your first note
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function NoteIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M7 3.75h7.5L19 8.25v12A1.75 1.75 0 0 1 17.25 22h-10A1.75 1.75 0 0 1 5.5 20.25v-14A2.5 2.5 0 0 1 8 3.75Z" />
      <path d="M14 4v5h5m-10 4h6m-6 4h6" />
    </svg>
  );
}
