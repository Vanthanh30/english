"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lessonApi, type LearningTopic } from "@/services/lesson.service";
import { gameApi, type LeaderboardEntry, type GameDifficulty } from "@/services/game.service";
import { flashcardApi, type Flashcard } from "@/services/flashcard.service";
import { useAuthStore } from "@/stores/auth.store";

export default function GamePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<LearningTopic | null>(null);
  const [difficulty, setDifficulty] = useState<GameDifficulty>("EASY");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New states for Sprint 6 additions
  const [source, setSource] = useState<"TOPIC" | "FLASHCARDS">("TOPIC");
  const [mode, setMode] = useState<"CLASSIC" | "SEQUENTIAL">("CLASSIC");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingFlashcards, setLoadingFlashcards] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const requiredPairsCount = useMemo(() => {
    if (difficulty === "HARD") return 10;
    if (difficulty === "MEDIUM") return 8;
    return 6;
  }, [difficulty]);

  // Authenticate user
  useEffect(() => {
    if (sessionReady && !user) router.replace("/login");
  }, [router, sessionReady, user]);

  // Fetch topics
  useEffect(() => {
    if (!sessionReady || !user) return;
    lessonApi
      .listTopics()
      .then((data) => {
        setTopics(data);
        if (data.length > 0) {
          setSelectedTopic(data[0]);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load topics");
      })
      .finally(() => {
        setLoadingTopics(false);
      });
  }, [sessionReady, user]);

  // Fetch flashcards when source changes to FLASHCARDS
  useEffect(() => {
    if (source === "FLASHCARDS" && flashcards.length === 0 && user) {
      setLoadingFlashcards(true);
      flashcardApi
        .list()
        .then((data) => {
          setFlashcards(data);
          // Select all by default
          setSelectedIds(data.map((fc) => fc.vocabulary.id));
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load flashcards");
        })
        .finally(() => {
          setLoadingFlashcards(false);
        });
    }
  }, [source, flashcards.length, user]);

  // Fetch leaderboard when topic or difficulty changes (only for TOPIC source)
  useEffect(() => {
    if (!selectedTopic || source !== "TOPIC") return;
    setLoadingLeaderboard(true);
    gameApi
      .getLeaderboard(selectedTopic.id, difficulty)
      .then((data) => {
        setLeaderboard(data.slice(0, 5)); // Keep top 5
      })
      .catch(() => {
        setLeaderboard([]);
      })
      .finally(() => {
        setLoadingLeaderboard(false);
      });
  }, [selectedTopic, difficulty, source]);

  // Filter flashcards based on search query
  const filteredFlashcards = useMemo(() => {
    return flashcards.filter((fc) => {
      const q = searchQuery.toLowerCase();
      const word = fc.vocabulary.word.toLowerCase();
      const meaning = fc.vocabulary.meaning.toLowerCase();
      const meaningVi = (fc.vocabulary.meaningVi || "").toLowerCase();
      return word.includes(q) || meaning.includes(q) || meaningVi.includes(q);
    });
  }, [flashcards, searchQuery]);

  const handleToggleSelectAll = () => {
    const visibleIds = filteredFlashcards.map((fc) => fc.vocabulary.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));

    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible
      setSelectedIds((prev) => {
        const next = [...prev];
        visibleIds.forEach((id) => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleSelectCard = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartGame = () => {
    if (source === "TOPIC") {
      if (!selectedTopic) return;
      router.push(`/game/play?topicId=${selectedTopic.id}&difficulty=${difficulty}&mode=${mode}&source=TOPIC`);
    } else {
      if (selectedIds.length < requiredPairsCount) return;
      const selectedVocabs = flashcards
        .filter((fc) => selectedIds.includes(fc.vocabulary.id))
        .map((fc) => fc.vocabulary);
      sessionStorage.setItem("eq_custom_game_vocabularies", JSON.stringify(selectedVocabs));
      router.push(`/game/play?difficulty=${difficulty}&mode=${mode}&source=FLASHCARDS`);
    }
  };

  if (!sessionReady || !user) {
    return <main className="dashboard-shell"><p>Loading game center...</p></main>;
  }

  const isStartDisabled =
    source === "TOPIC"
      ? !selectedTopic || loadingTopics
      : selectedIds.length < requiredPairsCount || loadingFlashcards;

  return (
    <main className="game-select-page">
      <header className="game-header">
        <div className="game-header-left">
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">EQ</span>
            <span>English Quest</span>
          </Link>
          <div className="game-header-copy">
            <p className="eyebrow">Sprint 6 · Vocabulary Arena</p>
            <h1>Vocabulary Arena</h1>
            <p>Challenge your memory or quick reflexes in dynamic English matches!</p>
          </div>
        </div>
        <Link className="game-dashboard-link" href="/dashboard">
          Back to dashboard
        </Link>
      </header>

      {error && <div className="game-error-banner">{error}</div>}

      <div className="game-select-workspace">
        <section className="game-config-section">
          {/* STEP 1: SELECT VOCABULARY SOURCE */}
          <div className="game-config-card">
            <h2>1. Select Vocabulary Source</h2>
            <div className="game-source-toggle">
              <button
                type="button"
                className={`source-button ${source === "TOPIC" ? "active" : ""}`}
                onClick={() => setSource("TOPIC")}
              >
                Topics
              </button>
              <button
                type="button"
                className={`source-button ${source === "FLASHCARDS" ? "active" : ""}`}
                onClick={() => setSource("FLASHCARDS")}
              >
                My Flashcards
              </button>
            </div>
          </div>

          {/* STEP 2: SELECT CONTENT */}
          <div className="game-config-card">
            {source === "TOPIC" ? (
              <>
                <h2>2. Select a Topic</h2>
                {loadingTopics ? (
                  <p className="loading-text">Loading learning topics...</p>
                ) : topics.length === 0 ? (
                  <p className="empty-text">No active topics found.</p>
                ) : (
                  <div className="game-topic-grid">
                    {topics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        className={`game-topic-card ${selectedTopic?.id === topic.id ? "selected" : ""}`}
                        onClick={() => setSelectedTopic(topic)}
                      >
                        {topic.imageUrl && (
                          <img
                            src={topic.imageUrl}
                            alt={topic.name}
                            className="topic-card-image"
                          />
                        )}
                        <div className="topic-card-content">
                          <h3>{topic.name}</h3>
                          <p>{topic.description}</p>
                          <span className="topic-badge">{topic.level}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2>2. Select Words from Flashcards</h2>
                {loadingFlashcards ? (
                  <p className="loading-text">Loading your flashcards...</p>
                ) : flashcards.length === 0 ? (
                  <div className="flashcard-empty-notice">
                    <p className="empty-text">No flashcards found.</p>
                    <Link href="/lessons" className="text-link">
                      Go to Lessons to save some vocabulary first!
                    </Link>
                  </div>
                ) : (
                  <div className="flashcard-select-container">
                    <div className="flashcard-select-toolbar">
                      <input
                        type="text"
                        placeholder="Search word or meaning..."
                        className="flashcard-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <button
                        type="button"
                        className="text-button"
                        onClick={handleToggleSelectAll}
                      >
                        {filteredFlashcards.every((fc) => selectedIds.includes(fc.vocabulary.id))
                          ? "Deselect All Visible"
                          : "Select All Visible"}
                      </button>
                    </div>

                    <div className="flashcard-list-scrollable">
                      {filteredFlashcards.length === 0 ? (
                        <p className="empty-text">No words match your search.</p>
                      ) : (
                        <div className="flashcard-select-grid">
                          {filteredFlashcards.map((fc) => {
                            const isSelected = selectedIds.includes(fc.vocabulary.id);
                            return (
                              <button
                                key={fc.id}
                                type="button"
                                className={`flashcard-select-item ${isSelected ? "selected" : ""}`}
                                onClick={() => handleSelectCard(fc.vocabulary.id)}
                              >
                                <div className="flashcard-checkbox">
                                  {isSelected && <span className="checkmark">✓</span>}
                                </div>
                                <div className="flashcard-words">
                                  <strong className="word-eng">{fc.vocabulary.word}</strong>
                                  <span className="word-viet">
                                    {fc.vocabulary.meaningVi || fc.vocabulary.meaning}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flashcard-selection-counter">
                      Selected: <strong>{selectedIds.length}</strong> words
                      {selectedIds.length < requiredPairsCount && (
                        <span className="warning-text">
                          {" "}
                          (Need at least {requiredPairsCount} for {difficulty} mode)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* STEP 3: CHOOSE GAMEPLAY MODE */}
          <div className="game-config-card">
            <h2>3. Choose Game Mode</h2>
            <div className="game-mode-toggle">
              <button
                type="button"
                className={`mode-button ${mode === "CLASSIC" ? "active" : ""}`}
                onClick={() => setMode("CLASSIC")}
              >
                <span className="mode-name">Classic Memory Grid</span>
                <span className="mode-desc">Cards face-down. Flip to match pairs!</span>
              </button>
              <button
                type="button"
                className={`mode-button ${mode === "SEQUENTIAL" ? "active" : ""}`}
                onClick={() => setMode("SEQUENTIAL")}
              >
                <span className="mode-name">Sequential Speed Match</span>
                <span className="mode-desc">Cards face-up at random positions. Match quickly!</span>
              </button>
            </div>
          </div>

          {/* STEP 4: CHOOSE DIFFICULTY */}
          <div className="game-config-card">
            <h2>4. Choose Difficulty</h2>
            <div className="game-difficulty-toggle">
              {(["EASY", "MEDIUM", "HARD"] as GameDifficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`difficulty-button ${difficulty === level ? "active" : ""}`}
                  onClick={() => setDifficulty(level)}
                >
                  <span className="difficulty-name">{level}</span>
                  <span className="difficulty-desc">
                    {level === "EASY" && "6 pairs · 60s limit"}
                    {level === "MEDIUM" && "8 pairs · 45s limit"}
                    {level === "HARD" && "10 pairs · 30s limit"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="game-start-button"
            disabled={isStartDisabled}
            onClick={handleStartGame}
          >
            Start Matching Quest
          </button>
        </section>

        <aside className="game-leaderboard-sidebar">
          {source === "TOPIC" ? (
            <div className="leaderboard-card">
              <h2>Leaderboard</h2>
              <p className="leaderboard-subtitle">
                Top players for {selectedTopic?.name ?? "selected topic"} ({difficulty})
              </p>

              {loadingLeaderboard ? (
                <p className="loading-text">Loading ranking table...</p>
              ) : leaderboard.length === 0 ? (
                <div className="leaderboard-empty">
                  <p>No high scores yet.</p>
                  <small>Be the first to secure a place on the board!</small>
                </div>
              ) : (
                <div className="leaderboard-list">
                  {leaderboard.map((entry) => (
                    <div key={entry.rank} className={`leaderboard-item rank-${entry.rank}`}>
                      <span className="entry-rank">#{entry.rank}</span>
                      <div className="entry-info">
                        <strong className="entry-name">{entry.user.displayName}</strong>
                        <span className="entry-meta">
                          {entry.timeSpent}s spent · {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="entry-score">{entry.score} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="leaderboard-card disabled-card">
              <h2>Leaderboard</h2>
              <div className="leaderboard-empty">
                <span className="empty-icon font-emoji">⚡</span>
                <p>Custom Flashcard Game</p>
                <small>Leaderboards are disabled for personalized games.</small>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
