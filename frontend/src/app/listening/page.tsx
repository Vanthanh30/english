"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { authApi } from "@/services/auth.service";
import { listeningService, type ListeningTopic } from "@/services/listening.service";

export default function StudentListeningListPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [topics, setTopics] = useState<ListeningTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network failures on logout
    } finally {
      clearSession();
      router.push("/login");
    }
  };

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listeningService.listTopics({
        search: search.trim() || undefined,
        level: levelFilter || undefined,
      });
      setTopics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load listening exercises");
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
    loadTopics();
  }, [sessionReady, user, router, loadTopics]);

  if (!sessionReady || (loading && topics.length === 0)) {
    return (
      <main className="dashboard-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ fontWeight: 600, fontSize: '15px' }}>Loading dictation exercises...</p>
        </div>
      </main>
    );
  }

  const completedCount = topics.filter((t) => t.progress?.completed).length;

  return (
    <>
      <header className="site-header">
        <div className="site-nav">
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">EQ</span>
            <span>English Quest</span>
          </Link>
          <div className="nav-actions">
            {user?.role === "ADMIN" && (
              <Link className="button button-small button-outline" href="/admin/listening">
                Dictation CMS
              </Link>
            )}
            <Link className="user-nav-profile" href="/dashboard">
              <div className="avatar-mini">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="username">{user?.displayName}</span>
            </Link>
            <button className="text-button" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-shell" style={{ marginTop: "40px" }}>
        <div className="dashboard-main" style={{ maxWidth: "1140px", margin: "0 auto", width: "100%" }}>
          
          {/* Welcome Header */}
          <div style={{ marginBottom: "32px" }}>
            <p className="eyebrow" style={{ marginBottom: "6px" }}>Listening & Dictation Workspace</p>
            <h1 style={{ fontSize: "clamp(32px, 5vw, 44px)", letterSpacing: "-0.04em", margin: 0, fontWeight: 850 }}>
              Dictation Practice
            </h1>
            <p style={{ color: "var(--muted)", margin: "8px 0 0", fontSize: "15px", lineHeight: 1.6 }}>
              Listen to sentences and type what you hear. Practice Full Type Sense or Fill-in-the-Blank to sharpen your listening comprehension.
            </p>
          </div>

          {/* Stats Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
            <div className="dashboard-card" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "20px" }}>
              <span style={{ fontSize: "32px" }}>🎧</span>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Exercises</small>
                <strong style={{ display: "block", fontSize: "24px", fontWeight: 850 }}>{topics.length}</strong>
              </div>
            </div>
            <div className="dashboard-card" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "20px" }}>
              <span style={{ fontSize: "32px" }}>🏆</span>
              <div>
                <small style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Completed</small>
                <strong style={{ display: "block", fontSize: "24px", fontWeight: 850, color: "var(--green)" }}>{completedCount}</strong>
              </div>
            </div>
          </div>

          {error && <p className="form-message form-error">{error}</p>}

          {/* Filters */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "28px" }}>
            <input
              type="text"
              placeholder="Search by topic title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ flexGrow: 1, padding: "12px 16px" }}
            />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="form-input"
              style={{ width: "200px", padding: "12px 16px" }}
            >
              <option value="">All Levels</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>

          {/* Catalog grid */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>Loading dictation exercises...</div>
          ) : topics.length === 0 ? (
            <div className="dashboard-card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <h3 style={{ margin: "0 0 8px" }}>No Exercises Found</h3>
              <p style={{ color: "var(--muted)", margin: 0 }}>No dictation exercises match your query.</p>
            </div>
          ) : (
            <div className="tool-spaces-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
              {topics.map((topic) => {
                const totalSentences = topic.sentenceCount || 0;
                const completedSentences = topic.progress?.completedSentences?.length || 0;
                const isCompleted = !!topic.progress?.completed || (totalSentences > 0 && completedSentences >= totalSentences);
                const hasStarted = !!topic.progress && completedSentences > 0;
                const percent = totalSentences > 0 ? Math.min(100, Math.round((completedSentences / totalSentences) * 100)) : 0;

                return (
                  <div key={topic.id} className="dashboard-card tool-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div className="tool-card-header" style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="tool-card-icon">🎧</span>
                          <span className={`tool-card-badge ${
                            topic.level === "BEGINNER" ? "info" : topic.level === "INTERMEDIATE" ? "due" : "neutral"
                          }`}>
                            {topic.level}
                          </span>
                        </div>

                        {isCompleted ? (
                          <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: "#eaf3ec", color: "#1c5035" }}>
                            ✓ COMPLETED
                          </span>
                        ) : hasStarted ? (
                          <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: "#fef3c7", color: "#92400e" }}>
                            ▶ IN PROGRESS
                          </span>
                        ) : null}
                      </div>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 8px" }}>{topic.title}</h3>
                      <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
                        {topic.description || "Tune your hearing with this clean voice transcription exercise."}
                      </p>
                    </div>

                    <div>
                      {/* Progress Bar for Started / In Progress topics */}
                      {hasStarted && !isCompleted && (
                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                            <span>{completedSentences} / {totalSentences} sentences</span>
                            <span style={{ color: "var(--green)" }}>{percent}%</span>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "#edf1ed", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ width: `${percent}%`, height: "100%", background: "#2f6d4f", borderRadius: "999px" }}></div>
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #edf0ed" }}>
                        <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                          {totalSentences} sentences
                        </span>
                        <Link href={`/listening/${topic.slug}`} className="button button-small" style={{ marginLeft: "auto" }}>
                          {isCompleted ? "Practice Again" : hasStarted ? `Resume (${percent}%)` : "Start exercise →"}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
