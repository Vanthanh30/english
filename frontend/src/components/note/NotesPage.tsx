"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  noteApi,
  type Note,
} from "@/services/note.service";
import { useAuthStore } from "@/stores/auth.store";

const PAGE_SIZE = 12;
type NotesView = "notes" | "vocabulary";

export default function NotesPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const editorRef = useRef<HTMLDivElement>(null);
  const initialSelectionMade = useRef(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadNotes = useCallback(async () => {
    if (!sessionReady || !user) return;
    setLoading(true);
    try {
      const page = await noteApi.list({
        page: 1,
        limit: PAGE_SIZE,
        search: debouncedSearch,
      });
      setNotes(page.items);
      setTotal(page.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load notes");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sessionReady, user]);



  useEffect(() => {
    if (sessionReady && !user) router.replace("/login");
  }, [router, sessionReady, user]);

  useEffect(() => {
    if (!sessionReady || !user) return;
    let active = true;
    noteApi
      .list({
        page: 1,
        limit: PAGE_SIZE,
        search: debouncedSearch,
      })
      .then((page) => {
        if (!active) return;
        setNotes(page.items);
        setTotal(page.total);
        if (!initialSelectionMade.current && page.items[0]) {
          initialSelectionMade.current = true;
          setSelected(page.items[0]);
          setTitle(page.items[0].title);
          setContentHtml(page.items[0].contentHtml);
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "Unable to load notes",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, sessionReady, user]);



  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== contentHtml) {
      editorRef.current.innerHTML = contentHtml;
    }
  }, [contentHtml, selected]);

  function openNote(note: Note) {
    if (
      dirty &&
      !window.confirm("Discard your unsaved changes and open another note?")
    ) {
      return;
    }
    setSelected(note);
    setTitle(note.title);
    setContentHtml(note.contentHtml);
    setDirty(false);
    setError(null);
    setMessage(null);
  }



  function newNote() {
    if (
      dirty &&
      !window.confirm("Discard your unsaved changes and start a new note?")
    ) {
      return;
    }
    initialSelectionMade.current = true;
    setSelected(null);
    setTitle("");
    setContentHtml("");
    setDirty(false);
    setError(null);
    setMessage(null);
    editorRef.current?.focus();
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input = {
        title,
        contentHtml: editorRef.current?.innerHTML ?? contentHtml,
      };
      const saved = selected
        ? await noteApi.update(selected.id, input)
        : await noteApi.create(input);
      setSelected(saved);
      setTitle(saved.title);
      setContentHtml(saved.contentHtml);
      setDirty(false);
      setMessage(selected ? "Note updated." : "Note created.");
      await loadNotes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save note");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.title}"? This cannot be undone.`)) {
      return;
    }
    setSaving(true);
    try {
      await noteApi.delete(selected.id);
      newNote();
      setMessage("Note deleted.");
      await loadNotes();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to delete note",
      );
    } finally {
      setSaving(false);
    }
  }

  function format(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setContentHtml(editorRef.current?.innerHTML ?? "");
    setDirty(true);
  }

  if (!sessionReady || !user) {
    return <main className="notes-loading">Restoring your notes...</main>;
  }

  return (
    <main className="notes-page">
      <header className="notes-header">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
        <div className="notes-header-copy">
          <p className="eyebrow">Sprint 4 · Personal notebook</p>
          <h1>Study notes</h1>
          <p>Capture ideas, examples, and language rules in your own words.</p>
        </div>
        <Link className="notes-dashboard-link" href="/dashboard">
          Back to dashboard
        </Link>
      </header>

      <section className="notes-workspace">
        <aside className="notes-sidebar">
          <button className="notes-new-button" type="button" onClick={newNote}>
            <span>+</span> New note
          </button>
          <label className="notes-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              placeholder="Search your notes"
              onChange={(event) => {
                setSearch(event.target.value);
                setLoading(true);
              }}
            />
          </label>
          <div className="notes-list-heading">
            <strong>Your notes</strong>
            <span>{total}</span>
          </div>
          <div className="notes-list">
            {loading && <p className="notes-empty">Loading notes...</p>}
            {!loading && notes.length === 0 && (
              <div className="notes-empty">
                <strong>No notes found</strong>
                <p>Create a note or try a different search.</p>
              </div>
            )}
            {!loading &&
              notes.map((note) => (
                <button
                  className={selected?.id === note.id ? "active" : ""}
                  key={note.id}
                  type="button"
                  onClick={() => openNote(note)}
                >
                  <strong>{note.title}</strong>
                  <span>{plainText(note.contentHtml) || "Empty note"}</span>
                  <small>{formatDate(note.updatedAt)}</small>
                </button>
              ))}
          </div>
        </aside>

        <form className="note-editor-card" onSubmit={saveNote}>
          <div className="note-editor-topbar">
            <div>
              <span className={dirty ? "unsaved" : selected ? "saved" : "draft"}>
                {dirty
                  ? "Unsaved changes"
                  : selected
                    ? "Saved note"
                    : "New draft"}
              </span>
              <small>
                {selected
                  ? `Last updated ${formatDate(selected.updatedAt)}`
                  : "Only you can access this note"}
              </small>
            </div>
            <div className="note-editor-actions">
              {selected && (
                <button
                  className="note-delete"
                  disabled={saving}
                  type="button"
                  onClick={() => void deleteNote()}
                >
                  Delete
                </button>
              )}
              <button
                className="note-save"
                disabled={saving || !title.trim()}
                type="submit"
              >
                {saving ? "Saving..." : "Save note"}
              </button>
            </div>
          </div>

          {error && <p className="form-message form-error">{error}</p>}
          {message && <p className="form-message form-success">{message}</p>}

          <input
            className="note-title-input"
            maxLength={120}
            placeholder="Untitled note"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
            required
          />

          <div className="note-toolbar" aria-label="Text formatting">
            <button type="button" onClick={() => format("formatBlock", "h2")}>
              H2
            </button>
            <button type="button" onClick={() => format("formatBlock", "h3")}>
              H3
            </button>
            <button type="button" onClick={() => format("bold")}>
              <strong>B</strong>
            </button>
            <button type="button" onClick={() => format("italic")}>
              <em>I</em>
            </button>
            <button type="button" onClick={() => format("underline")}>
              <u>U</u>
            </button>
            <button type="button" onClick={() => format("insertUnorderedList")}>
              • List
            </button>
            <button type="button" onClick={() => format("insertOrderedList")}>
              1. List
            </button>
            <button type="button" onClick={() => format("formatBlock", "blockquote")}>
              Quote
            </button>
            <button type="button" onClick={() => format("removeFormat")}>
              Clear
            </button>
          </div>

          <div
            className="note-rich-editor"
            contentEditable
            ref={editorRef}
            role="textbox"
            aria-label="Note content"
            aria-multiline="true"
            data-placeholder="Start writing your study note..."
            suppressContentEditableWarning
            onInput={(event) => {
              setContentHtml(event.currentTarget.innerHTML);
              setDirty(true);
            }}
          />

          <footer className="note-editor-footer">
            <span>{plainText(contentHtml).length} characters</span>
            <span>Unsafe HTML is removed when saved</span>
          </footer>
        </form>
      </section>
    </main>
  );
}

function NoteIcon() {
  return (
    <svg
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M5 3h10l4 4v14H5Z" />
      <path d="M14 3v5h5M8 13h8M8 17h6" />
    </svg>
  );
}



function plainText(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, " ");
  const element = document.createElement("div");
  element.innerHTML = html;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
