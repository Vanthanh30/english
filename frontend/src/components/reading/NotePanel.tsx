"use client";

import { useEffect, useState } from "react";
import { readingApi, type ReadingNote, type ReadingNoteType } from "@/services/reading.service";

interface NotePanelProps {
  readingItemId: string;
}

export default function NotePanel({ readingItemId }: NotePanelProps) {
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReadingNoteType>("VOCABULARY");
  const [content, setContent] = useState("");
  const [editingNote, setEditingNote] = useState<ReadingNote | null>(null);
  const [saving, setSaving] = useState(false);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const res = await readingApi.listNotes(readingItemId);
      setNotes(res);
    } catch (err) {
      console.error("Failed to load notes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [readingItemId]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      if (editingNote) {
        await readingApi.updateNote(readingItemId, editingNote.id, content.trim());
      } else {
        await readingApi.createNote(readingItemId, {
          noteType: activeTab,
          content: content.trim(),
        });
      }
      setContent("");
      setEditingNote(null);
      loadNotes();
    } catch (err) {
      alert("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleEditNote = (note: ReadingNote) => {
    setEditingNote(note);
    setContent(note.content);
    setActiveTab(note.noteType);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      await readingApi.deleteNote(readingItemId, noteId);
      loadNotes();
      if (editingNote?.id === noteId) {
        setEditingNote(null);
        setContent("");
      }
    } catch (err) {
      alert("Failed to delete note");
    }
  };

  const filteredNotes = notes.filter((n) => n.noteType === activeTab);

  const getTabLabel = (type: ReadingNoteType) => {
    switch (type) {
      case "VOCABULARY":
        return "📝 Vocab";
      case "GRAMMAR":
        return "📖 Grammar";
      case "SUMMARY":
        return "📋 Summary";
      case "PERSONAL":
        return "💭 Personal";
    }
  };

  return (
    <div className="note-panel">
      <div className="panel-header">
        <h3>Reading Notes</h3>
        <p className="panel-subtitle">Record memory hooks, grammar, or summaries.</p>
      </div>

      <div className="panel-tabs">
        {(["VOCABULARY", "GRAMMAR", "SUMMARY", "PERSONAL"] as ReadingNoteType[]).map((type) => (
          <button
            key={type}
            className={activeTab === type ? "active" : ""}
            onClick={() => {
              setActiveTab(type);
              if (!editingNote) setContent("");
            }}
          >
            {getTabLabel(type)}
          </button>
        ))}
      </div>

      <form className="panel-form" onSubmit={handleSaveNote}>
        <textarea
          placeholder={`Write your ${activeTab.toLowerCase()} note here...`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          required
        />
        <div className="form-actions">
          {editingNote && (
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setEditingNote(null);
                setContent("");
              }}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="save-btn" disabled={saving || !content.trim()}>
            {saving ? "Saving..." : editingNote ? "Update Note" : "Add Note"}
          </button>
        </div>
      </form>

      <div className="panel-notes-list">
        {loading ? (
          <div className="notes-list-status">Loading notes...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-empty">
            <p>No notes in this category yet.</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div key={note.id} className="note-card">
              <p className="note-content">{note.content}</p>
              <div className="note-footer">
                <span className="note-date">{new Date(note.createdAt).toLocaleDateString()}</span>
                <div className="note-actions">
                  <button className="note-action-btn edit" onClick={() => handleEditNote(note)}>
                    ✏️ Edit
                  </button>
                  <button className="note-action-btn delete" onClick={() => handleDeleteNote(note.id)}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
