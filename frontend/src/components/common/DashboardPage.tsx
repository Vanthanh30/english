"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { flashcardApi } from "@/services/flashcard.service";
import { noteApi } from "@/services/note.service";
import { lessonApi, LearningTopic } from "@/services/lesson.service";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [stats, setStats] = useState<{
    dueCount: number;
    totalCardsCount: number;
    notesCount: number;
    topics: LearningTopic[];
    loading: boolean;
  }>({
    dueCount: 0,
    totalCardsCount: 0,
    notesCount: 0,
    topics: [],
    loading: true,
  });

  useEffect(() => {
    if (sessionReady && !user) {
      router.replace("/login");
    }
  }, [router, sessionReady, user]);

  useEffect(() => {
    if (sessionReady && user) {
      Promise.all([
        flashcardApi.listDue().catch(() => []),
        flashcardApi.list().catch(() => []),
        noteApi.list({ limit: 1 }).catch(() => ({ items: [], total: 0 })),
        lessonApi.listTopics().catch(() => []),
      ])
        .then(([dueCards, allCards, notesPage, topics]) => {
          setStats({
            dueCount: dueCards.length,
            totalCardsCount: allCards.length,
            notesCount: notesPage.total,
            topics,
            loading: false,
          });
        })
        .catch(() => {
          setStats((prev) => ({ ...prev, loading: false }));
        });
    }
  }, [sessionReady, user]);

  async function logout() {
    await authApi.logout().catch(() => undefined);
    clearSession();
    router.replace("/login");
  }

  if (!sessionReady || !user) {
    return (
      <main className="dashboard-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ fontWeight: 600, fontSize: '15px' }}>Restoring your session...</p>
        </div>
      </main>
    );
  }

  // Calculate stats summaries
  const completedTopicsCount = stats.topics.filter(
    (t) => t.progress && t.progress.percentage === 100
  ).length;
  const totalTopicsCount = stats.topics.length;

  // Active recommended topic
  const inProgressTopic = stats.topics.find(
    (t) => t.progress && t.progress.percentage > 0 && t.progress.percentage < 100
  );
  const notStartedTopic = stats.topics.find(
    (t) => !t.progress || t.progress.percentage === 0
  );
  const recommendedTopic = inProgressTopic || notStartedTopic || stats.topics[0] || null;

  return (
    <>
      <header className="site-header">
        <div className="site-nav">
          <Link className="brand" href="/">
            <span className="brand-mark">EQ</span>
            <span>English Quest</span>
          </Link>
          <div className="nav-actions">
            <Link className="user-nav-profile" href="/dashboard">
              <div className="avatar-mini">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="username">{user.displayName}</span>
            </Link>
            <button className="text-button" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-shell" style={{ marginTop: "40px" }}>

      <div className="dashboard-grid">
        {/* Left Column: Actions and Learning Space */}
        <div className="dashboard-main">
          {/* Welcome Area */}
          <div style={{ marginBottom: "32px" }}>
            <p className="eyebrow" style={{ marginBottom: "6px" }}>Your learning space</p>
            <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.04em", margin: 0, fontWeight: 850 }}>
              Welcome back, {user.displayName}.
            </h1>
            <p style={{ color: "var(--muted)", margin: "8px 0 0", fontSize: "15px", lineHeight: 1.6 }}>
              Continue your daily learning habits or play matching games to sharpen recall reflexes.
            </p>
          </div>

          {/* Active Quest Banner Card */}
          {recommendedTopic && (
            <div className="active-quest-banner">
              <div className="active-quest-banner-content">
                <p className="preview-eyebrow eyebrow">Active Quest</p>
                <h2>{recommendedTopic.name}</h2>
                <p style={{ margin: 0, fontSize: "14px", opacity: 0.85, lineHeight: 1.5 }}>
                  {recommendedTopic.description || "Continue expanding your vocabulary and matching skills."}
                </p>
                <div className="active-quest-progress">
                  <div className="active-quest-progress-bar">
                    <span
                      style={{
                        width: `${recommendedTopic.progress?.percentage || 0}%`,
                      }}
                    />
                  </div>
                  <span>
                    {recommendedTopic.progress?.percentage || 0}% completed
                  </span>
                </div>
              </div>
              <Link className="button" href="/courses">
                {recommendedTopic.progress && recommendedTopic.progress.percentage > 0
                  ? "Resume Quest"
                  : "Start Quest"}
              </Link>
            </div>
          )}

          {/* Interactive Spaces Grid */}
          <div className="tool-spaces-grid">
            <Link href="/courses" className="dashboard-card tool-card">
              <div className="tool-card-header">
                <span className="tool-card-icon">📚</span>
                <span className="tool-card-badge info">
                  {totalTopicsCount} {totalTopicsCount === 1 ? "Topic" : "Topics"}
                </span>
              </div>
              <div>
                <h3>Topics Lessons</h3>
                <p>
                  Explore topic-based vocabulary list, complete quests, and verify phonetic speech audio.
                </p>
              </div>
              <span className="tool-card-footer">
                Browse topics &rarr;
              </span>
            </Link>

            <Link href="/flashcards" className="dashboard-card tool-card">
              <div className="tool-card-header">
                <span className="tool-card-icon">🗂️</span>
                {stats.dueCount > 0 ? (
                  <span className="tool-card-badge due">{stats.dueCount} Due</span>
                ) : (
                  <span className="tool-card-badge neutral">Up to Date</span>
                )}
              </div>
              <div>
                <h3>Flashcard Deck</h3>
                <p>
                  Study vocabulary cards using spaced repetition algorithms. Cement definitions in memory.
                </p>
              </div>
              <span className="tool-card-footer">
                Review cards &rarr;
              </span>
            </Link>

            <Link href="/game" className="dashboard-card tool-card">
              <div className="tool-card-header">
                <span className="tool-card-icon">🎮</span>
                <span className="tool-card-badge info">Play Arena</span>
              </div>
              <div>
                <h3>Matching Games</h3>
                <p>
                  Trigger timed match games to build active recall speed and improve cognitive word connection.
                </p>
              </div>
              <span className="tool-card-footer">
                Enter Arena &rarr;
              </span>
            </Link>

            <Link href="/flashcards/practice" className="dashboard-card tool-card">
              <div className="tool-card-header">
                <span className="tool-card-icon">Aa</span>
                <span className="tool-card-badge info">Sprint 6</span>
              </div>
              <div>
                <h3>Writing Practice</h3>
                <p>
                  Listen to pronunciation or read a meaning, then write the English word from memory.
                </p>
              </div>
              <span className="tool-card-footer">
                Start writing &rarr;
              </span>
            </Link>

            <Link href="/notes" className="dashboard-card tool-card">
              <div className="tool-card-header">
                <span className="tool-card-icon">📝</span>
                <span className="tool-card-badge neutral">
                  {stats.notesCount} {stats.notesCount === 1 ? "Note" : "Notes"}
                </span>
              </div>
              <div>
                <h3>Study Notes</h3>
                <p>
                  Review personal annotations, custom explanations, and additional vocabulary usage notes.
                </p>
              </div>
              <span className="tool-card-footer">
                Open Notebook &rarr;
              </span>
            </Link>
          </div>
        </div>

        {/* Right Column: User Sidebar */}
        <div className="dashboard-sidebar">
          {/* User Profile widget */}
          <div className="dashboard-card user-profile-card">
            <div className="profile-avatar">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
            </div>
            <h2 className="profile-name">{user.displayName}</h2>
            <p className="profile-email">{user.email}</p>
            <div className="profile-badges">
              <span className="profile-badge role">{user.role}</span>
              <span className="profile-badge status">Verified</span>
            </div>
            <div className="profile-streak-box">
              <span className="profile-streak-label">🔥 Learning Streak</span>
              <span className="profile-streak-val">7 Days</span>
            </div>
          </div>

          {/* Stats widget */}
          <div className="dashboard-card stats-summary-card">
            <h4>Stats Summary</h4>
            <div className="stat-row">
              <span className="stat-row-label">🗂️ Total Flashcards</span>
              <span className="stat-row-val">{stats.totalCardsCount}</span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">⏳ Due Reviews</span>
              <span className="stat-row-val">{stats.dueCount}</span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">📝 Written Notes</span>
              <span className="stat-row-val">{stats.notesCount}</span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">🏆 Completed Topics</span>
              <span className="stat-row-val">
                {completedTopicsCount} / {totalTopicsCount}
              </span>
            </div>
          </div>

          {/* Admin shortcut widgets if applicable */}
          {user.role === "ADMIN" && (
            <div 
              className="dashboard-card" 
              style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--lime)" }}
            >
              <h4 style={{ margin: 0, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                Admin Shortcuts
              </h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                Access content dashboard to add topics, configure word lists, or edit lesson plans.
              </p>
              <Link className="button button-small" href="/admin/content" style={{ width: "100%" }}>
                Manage Content
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
    </>
  );
}
