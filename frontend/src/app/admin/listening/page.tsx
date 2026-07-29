"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { listeningService, type ListeningTopic } from "@/services/listening.service";

export default function AdminListeningPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [topics, setTopics] = useState<ListeningTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listeningService.listAdminTopics({
        search: search.trim() || undefined,
        level: levelFilter || undefined,
      });
      setTopics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load listening topics");
    } finally {
      setLoading(false);
    }
  }, [search, levelFilter]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }
    loadTopics();
  }, [sessionReady, user, router, loadTopics]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await listeningService.deleteAdminTopic(id);
      setTopics(topics.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete topic");
    }
  };

  if (!sessionReady || (loading && topics.length === 0)) {
    return (
      <main className="admin-loading">
        <span className="admin-loading-mark">EQ</span>
        <p>Loading dictation workspace...</p>
      </main>
    );
  }

  return (
    <main className="admin-app">
      {/* Admin Sidebar */}
      <aside className="admin-sidebar">
        <Link className="admin-logo" href="/dashboard">
          <span>EQ</span>
          <div>
            <strong>English Quest</strong>
            <small>Admin workspace</small>
          </div>
        </Link>

        <div className="admin-sidebar-label">Workspace</div>
        <nav className="admin-side-nav" aria-label="Admin navigation">
          <Link href="/dashboard">
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
            Dashboard
          </Link>
          <Link href="/admin/content">
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V5M9 19V5M14 19V5"/><path d="m18 5 2 14"/></svg>
            Content library
          </Link>
          <span className="active">
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20" stroke="currentColor" strokeWidth="1.8"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
            Dictation CMS
          </span>
        </nav>

        <div className="admin-sidebar-card">
          <span className="admin-sidebar-card-icon">
            ⚡
          </span>
          <strong>Sprint 2 workspace</strong>
          <p>Manage dictation audio exercises, youtube scripts, and sentences.</p>
        </div>

        <div className="admin-user">
          <span>{user?.displayName?.slice(0, 1).toUpperCase() || "A"}</span>
          <div>
            <strong>{user?.displayName || "Administrator"}</strong>
            <small>{user?.email}</small>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-breadcrumb">Admin / Dictation CMS</p>
            <h1>Dictation exercises</h1>
            <p>Manage study exercises, upload audio/youtube, and transcribe automatically.</p>
          </div>
          <Link className="button" href="/admin/listening/create">
            + Add New Exercise
          </Link>
        </header>

        {/* Summary Stat Cards */}
        <section className="admin-summary" aria-label="Content summary">
          <article>
            <span className="admin-summary-icon green">
              🎧
            </span>
            <div>
              <small>Total Exercises</small>
              <strong>{loading ? "—" : topics.length}</strong>
            </div>
          </article>
          <article>
            <span className="admin-summary-icon lime">
              📝
            </span>
            <div>
              <small>Total Sentences</small>
              <strong>{topics.reduce((acc, t) => acc + (t.sentenceCount || 0), 0)}</strong>
            </div>
          </article>
          <article>
            <span className="admin-summary-icon amber">
              ✨
            </span>
            <div>
              <small>Active Exercises</small>
              <strong>{topics.filter((t) => t.status === "PUBLISHED").length}</strong>
            </div>
          </article>
        </section>

        {error && <p className="form-message form-error">{error}</p>}

        {/* Toolbar */}
        <div className="admin-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flexGrow: 1, position: "relative" }}>
            <input
              type="text"
              placeholder="Search exercises by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ width: "100%", paddingLeft: "14px" }}
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="form-input"
            style={{ width: "200px" }}
          >
            <option value="">All Levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>

        {/* Table List */}
        {loading ? (
          <p className="admin-empty">Loading exercises...</p>
        ) : topics.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "white", borderRadius: "16px", border: "1px solid #dfe5df" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>No Dictation Exercises Found</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 20px", fontSize: "14px" }}>Add your first exercises by uploading audios or providing youtube video links.</p>
            <Link href="/admin/listening/create" className="button button-small">
              Create First Exercise
            </Link>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: "16px", border: "1px solid #dfe5df", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8faf7", borderBottom: "1px solid #dfe5df" }}>
                  <th style={{ padding: "14px 20px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e" }}>Exercise Info</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e" }}>Level</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e" }}>Sentences</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e" }}>Source type</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((topic) => (
                  <tr key={topic.id} style={{ borderBottom: "1px solid #edf1ed" }}>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <strong style={{ fontSize: "14px", color: "#173f2d" }}>
                          <Link href={`/admin/listening/${topic.id}`} style={{ color: "inherit", textDecoration: "none" }}>{topic.title}</Link>
                        </strong>
                        <span style={{ fontSize: "12px", color: "#718078", marginTop: "4px" }}>{topic.description || "No description provided."}</span>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span className={`profile-badge ${
                        topic.level === "BEGINNER" ? "role" : "status"
                      }`}>
                        {topic.level}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600 }}>
                      {topic.sentenceCount || 0} sentences
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                      {topic.youtubeUrl ? (
                        <span style={{ color: "#d97706", fontWeight: 600 }}>🎥 YouTube</span>
                      ) : topic.audioUrl ? (
                        <span style={{ color: "#2563eb", fontWeight: 600 }}>🎵 Audio file</span>
                      ) : (
                        <span style={{ color: "#64748b" }}>Text script only</span>
                      )}
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Link
                          href={`/admin/listening/${topic.id}`}
                          className="button button-small button-secondary"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(topic.id, topic.title)}
                          className="button button-small"
                          style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
