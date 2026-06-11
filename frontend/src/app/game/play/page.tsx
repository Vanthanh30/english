"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { gameApi, type GameVocabulary, type GameDifficulty, type LeaderboardEntry } from "@/services/game.service";
import { useAuthStore } from "@/stores/auth.store";

interface Card {
  gridId: number;
  vocabId: string;
  type: "word" | "meaning";
  text: string;
  gridIndex?: number;
}

function GamePlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const topicId = searchParams.get("topicId") ?? "";
  const difficulty = (searchParams.get("difficulty") ?? "EASY") as GameDifficulty;
  const mode = (searchParams.get("mode") ?? "CLASSIC") as "CLASSIC" | "SEQUENTIAL";
  const source = (searchParams.get("source") ?? "TOPIC") as "TOPIC" | "FLASHCARDS";

  const [gameState, setGameState] = useState<"LOADING" | "READY" | "PLAYING" | "GAMEOVER">("LOADING");
  const [vocabularies, setVocabularies] = useState<GameVocabulary[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [readyCountdown, setReadyCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timeSpent, setTimeSpent] = useState(0);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ rank: number; leaderboard: LeaderboardEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeSpentRef = useRef<NodeJS.Timeout | null>(null);
  const vocabQueueRef = useRef<GameVocabulary[]>([]);
  const cardCounterRef = useRef(0);

  const maxTime = useMemo(() => {
    if (difficulty === "HARD") return 30;
    if (difficulty === "MEDIUM") return 45;
    return 60;
  }, [difficulty]);

  const difficultyMultiplier = useMemo(() => {
    if (difficulty === "HARD") return 2.0;
    if (difficulty === "MEDIUM") return 1.5;
    return 1.0;
  }, [difficulty]);

  // Redirect if not logged in
  useEffect(() => {
    if (sessionReady && !user) router.replace("/login");
  }, [router, sessionReady, user]);

  // Load vocabularies and prepare cards
  useEffect(() => {
    if (!sessionReady || !user) return;

    if (source === "FLASHCARDS") {
      try {
        const dataStr = sessionStorage.getItem("eq_custom_game_vocabularies");
        if (!dataStr) {
          throw new Error("No custom vocabularies found in session storage.");
        }
        const data = JSON.parse(dataStr) as GameVocabulary[];
        if (data.length === 0) {
          throw new Error("No vocabularies selected.");
        }

        let limit = 6;
        if (difficulty === "MEDIUM") limit = 8;
        if (difficulty === "HARD") limit = 10;

        // Shuffle and slice to the limit
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        const limited = shuffled.slice(0, limit);

        setVocabularies(limited);
        prepareGameCards(limited);
        setGameState("READY");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load custom vocabulary");
        setGameState("GAMEOVER");
      }
    } else {
      if (!topicId) return;
      gameApi
        .getVocabularies(topicId, difficulty)
        .then((data) => {
          if (data.length === 0) {
            throw new Error("No vocabulary found in this topic.");
          }
          setVocabularies(data);
          prepareGameCards(data);
          setGameState("READY");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load vocabulary");
          setGameState("GAMEOVER");
        });
    }
  }, [topicId, difficulty, source, sessionReady, user]);

  // 3-second ready countdown
  useEffect(() => {
    if (gameState !== "READY") return;

    const interval = setInterval(() => {
      setReadyCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState("PLAYING");
          setTimeLeft(maxTime);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, maxTime]);

  // Gameplay countdown timer
  useEffect(() => {
    if (gameState !== "PLAYING") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleGameOver(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timeSpentRef.current = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeSpentRef.current) clearInterval(timeSpentRef.current);
    };
  }, [gameState]);

  // Generate cards
  const prepareGameCards = (list: GameVocabulary[]) => {
    cardCounterRef.current = 0;

    if (mode === "CLASSIC") {
      const cardPairs: Card[] = [];
      list.forEach((vocab) => {
        // English Word card
        cardPairs.push({
          gridId: cardCounterRef.current++,
          vocabId: vocab.id,
          type: "word",
          text: vocab.word,
        });
        // Vietnamese Meaning card
        cardPairs.push({
          gridId: cardCounterRef.current++,
          vocabId: vocab.id,
          type: "meaning",
          text: vocab.meaningVi || vocab.meaning,
        });
      });

      // Shuffle using Fisher-Yates algorithm
      for (let i = cardPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
      }

      setCards(cardPairs);
    } else {
      // SEQUENTIAL MODE: Display 3 pairs initially
      const initialActiveCount = Math.min(3, list.length);
      const activeList = list.slice(0, initialActiveCount);
      vocabQueueRef.current = list.slice(initialActiveCount);

      const cardPairs: Card[] = [];
      activeList.forEach((vocab) => {
        cardPairs.push({
          gridId: cardCounterRef.current++,
          vocabId: vocab.id,
          type: "word",
          text: vocab.word,
        });
        cardPairs.push({
          gridId: cardCounterRef.current++,
          vocabId: vocab.id,
          type: "meaning",
          text: vocab.meaningVi || vocab.meaning,
        });
      });

      // Assign random grid slots (out of 12) without overlap
      const slots = Array.from({ length: 12 }, (_, i) => i);
      // Shuffle slots
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }

      cardPairs.forEach((card, idx) => {
        card.gridIndex = slots[idx];
      });

      setCards(cardPairs);
    }
  };

  // Click card handler
  const handleCardClick = (card: Card) => {
    if (gameState !== "PLAYING") return;
    if (selectedCards.length >= 2) return; // Lock selections during mismatch flip
    if (matchedIds.has(card.vocabId)) return; // Already matched
    if (selectedCards.some((c) => c.gridId === card.gridId)) return; // Already clicked

    const newSelections = [...selectedCards, card];
    setSelectedCards(newSelections);

    if (newSelections.length === 2) {
      const [first, second] = newSelections;

      if (first.vocabId === second.vocabId && first.type !== second.type) {
        // MATCH FOUND
        setTimeout(() => {
          setMatchedIds((prev) => {
            const next = new Set(prev);
            next.add(first.vocabId);

            // Calculate current score
            const newMatchedCount = next.size;
            const currentBase = newMatchedCount * 100 * difficultyMultiplier;
            setScore(Math.round(currentBase));

            // Check win condition
            if (next.size === vocabularies.length) {
              handleGameOver(true, newMatchedCount);
            }
            return next;
          });

          if (mode === "SEQUENTIAL") {
            // Remove the matched pair and spawn the next pair from the queue
            setCards((prevCards) => {
              const remainingCards = prevCards.filter(
                (c) => c.vocabId !== first.vocabId
              );

              if (vocabQueueRef.current.length > 0) {
                const nextVocab = vocabQueueRef.current.shift()!;
                const newCard1: Card = {
                  gridId: cardCounterRef.current++,
                  vocabId: nextVocab.id,
                  type: "word",
                  text: nextVocab.word,
                };
                const newCard2: Card = {
                  gridId: cardCounterRef.current++,
                  vocabId: nextVocab.id,
                  type: "meaning",
                  text: nextVocab.meaningVi || nextVocab.meaning,
                };

                const occupiedIndices = remainingCards.map((c) => c.gridIndex!);
                const emptyIndices = Array.from({ length: 12 }, (_, i) => i).filter(
                  (i) => !occupiedIndices.includes(i)
                );

                // Shuffle empty indices to pick randomly
                const shuffledEmpty = [...emptyIndices].sort(() => Math.random() - 0.5);

                newCard1.gridIndex = shuffledEmpty[0];
                newCard2.gridIndex = shuffledEmpty[1];

                return [...remainingCards, newCard1, newCard2];
              }

              return remainingCards;
            });
          }

          setSelectedCards([]);
        }, 300);
      } else {
        // MISMATCH
        setTimeout(() => {
          setSelectedCards([]);
        }, 800);
      }
    }
  };

  // Game over handler
  const handleGameOver = async (won: boolean, currentMatchCount?: number) => {
    setGameState("GAMEOVER");
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeSpentRef.current) clearInterval(timeSpentRef.current);

    const matches = currentMatchCount ?? matchedIds.size;
    const baseScore = matches * 100 * difficultyMultiplier;
    
    // Speed bonus is only awarded if the game was fully won
    const speedBonus = won ? (maxTime - timeSpent) * 10 * difficultyMultiplier : 0;
    const finalScore = Math.max(0, Math.round(baseScore + speedBonus));
    setScore(finalScore);

    // Submit score
    setSubmitting(true);
    try {
      const result = await gameApi.submitScore({
        topicId: source === "TOPIC" ? topicId : null,
        difficulty,
        score: finalScore,
        timeSpent: won ? timeSpent : maxTime,
      });
      setResults(result);
    } catch (err) {
      console.error("Failed to submit score", err);
    } finally {
      setSubmitting(false);
    }
  };

  const isMatched = (card: Card) => matchedIds.has(card.vocabId);
  const isSelected = (card: Card) => selectedCards.some((c) => c.gridId === card.gridId);

  // Time formatting
  const progressPercent = (timeLeft / maxTime) * 100;

  const renderSequentialBoard = () => {
    const slots = Array(12).fill(null);
    cards.forEach((card) => {
      if (card.gridIndex !== undefined && card.gridIndex >= 0 && card.gridIndex < 12) {
        slots[card.gridIndex] = card;
      }
    });

    return slots.map((card, index) => {
      if (!card) {
        return <div key={`empty-${index}`} className="sequential-empty-slot" />;
      }

      const selected = isSelected(card);
      const isMismatchActive = selectedCards.length === 2 && selectedCards.some(c => c.gridId === card.gridId);
      const isCorrectMatch = selectedCards.length === 2 && selectedCards.some(c => c.gridId === card.gridId) && (selectedCards[0].vocabId === selectedCards[1].vocabId);
      const matched = isMatched(card);

      const rotations = ["-2.5deg", "1.5deg", "-1deg", "2.2deg", "-1.8deg", "1.2deg", "-2.8deg", "2.6deg", "-0.8deg", "1.9deg", "-2.1deg", "1.4deg"];
      const tilt = rotations[index % rotations.length];

      return (
        <button
          key={card.gridId}
          type="button"
          disabled={matched || gameState === "GAMEOVER"}
          style={{ "--tilt": tilt } as React.CSSProperties}
          className={`sequential-card ${selected ? "selected" : ""} ${isMismatchActive ? "checking" : ""} ${isCorrectMatch ? "correct" : ""} ${matched ? "matched" : ""} card-${card.type}`}
          onClick={() => handleCardClick(card)}
        >
          <span className="card-text">{card.text}</span>
        </button>
      );
    });
  };

  return (
    <main className="game-play-page">
      <header className="game-header">
        <div className="game-header-left">
          <Link className="brand" href="/game">
            <span className="brand-mark">EQ</span>
            <span>English Quest</span>
          </Link>
          <div className="game-header-copy">
            <p className="eyebrow">Difficulty: {difficulty} · Mode: {mode === "SEQUENTIAL" ? "Speed Match" : "Classic Grid"}</p>
            <h1>Matching Quest</h1>
          </div>
        </div>
        <div className="game-stats-header">
          <div className="stat-pill">
            <span className="stat-label">Matches</span>
            <span className="stat-value">{matchedIds.size} / {vocabularies.length}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Score</span>
            <span className="stat-value">{score} pts</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Time</span>
            <span className="stat-value">{timeLeft}s</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      {gameState === "PLAYING" && (
        <div className="game-timer-bar-wrapper">
          <div
            className={`game-timer-bar-progress ${timeLeft <= 10 ? "danger" : timeLeft <= 20 ? "warning" : ""}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {error && <div className="game-error-banner">{error}</div>}

      <div className="game-arena">
        {gameState === "LOADING" && (
          <div className="arena-overlay">
            <p className="loading-text">Generating cards grid...</p>
          </div>
        )}

        {gameState === "READY" && (
          <div className="arena-overlay get-ready-overlay">
            <p className="ready-eyebrow">Get Ready</p>
            <span className="ready-timer">{readyCountdown}</span>
            <p className="ready-tip">
              {mode === "SEQUENTIAL"
                ? "Click compatible English words and Vietnamese translations face-up!"
                : "Match the corresponding English words and Vietnamese translations!"}
            </p>
          </div>
        )}

        {(gameState === "PLAYING" || (gameState === "GAMEOVER" && !results)) && (
          mode === "CLASSIC" ? (
            <div className={`game-board grid-${difficulty}`}>
              {cards.map((card) => {
                const matched = isMatched(card);
                const selected = isSelected(card);
                const isMismatchActive = selectedCards.length === 2 && selectedCards.some(c => c.gridId === card.gridId);
                const isCorrectMatch = selectedCards.length === 2 && selectedCards.some(c => c.gridId === card.gridId) && (selectedCards[0].vocabId === selectedCards[1].vocabId);

                return (
                  <button
                    key={card.gridId}
                    type="button"
                    data-vocab-id={card.vocabId}
                    disabled={matched || gameState === "GAMEOVER"}
                    className={`game-card ${matched ? "matched" : ""} ${selected ? "selected" : ""} ${isMismatchActive ? "checking" : ""} ${isCorrectMatch ? "correct" : ""}`}
                    onClick={() => handleCardClick(card)}
                  >
                    <div className="game-card-inner">
                      <div className="game-card-front">
                        <span className="card-logo">?</span>
                      </div>
                      <div className={`game-card-back card-${card.type}`}>
                        <span className="card-text">{card.text}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="game-board-sequential">
              {renderSequentialBoard()}
            </div>
          )
        )}

        {gameState === "GAMEOVER" && results && (
          <div className="game-results-panel">
            <div className="results-hero">
              <span className="results-trophy">🏆</span>
              <h2>Quest Complete!</h2>
              <p className="results-subtitle">
                {matchedIds.size === vocabularies.length ? "Superb job matching all items!" : "Time ran out before matching all pairs."}
              </p>
              
              <div className="results-stats-row">
                <div className="result-pill">
                  <span className="result-pill-label">Final Score</span>
                  <span className="result-pill-value">{score} pts</span>
                </div>
                <div className="result-pill">
                  <span className="result-pill-label">Matched</span>
                  <span className="result-pill-value">{matchedIds.size} / {vocabularies.length}</span>
                </div>
                <div className="result-pill">
                  <span className="result-pill-label">Spent</span>
                  <span className="result-pill-value">{timeSpent}s</span>
                </div>
                <div className="result-pill highlight">
                  <span className="result-pill-label">Leaderboard Rank</span>
                  <span className="result-pill-value">{results.rank > 0 ? `#${results.rank}` : "N/A"}</span>
                </div>
              </div>
            </div>

            {source === "TOPIC" ? (
              <div className="results-leaderboard-container">
                <h3>Leaderboard Rankings</h3>
                <div className="leaderboard-table">
                  <div className="leaderboard-table-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Score</span>
                    <span>Time</span>
                  </div>
                  <div className="leaderboard-table-body">
                    {results.leaderboard.map((entry) => {
                      const isCurrentUser = entry.user.email === user?.email;
                      return (
                        <div
                          key={entry.rank}
                          className={`leaderboard-row ${isCurrentUser ? "current-player" : ""}`}
                        >
                          <span className="entry-rank">#{entry.rank}</span>
                          <span className="entry-name">
                            {entry.user.displayName} {isCurrentUser && " (You)"}
                          </span>
                          <span className="entry-score">{entry.score} pts</span>
                          <span className="entry-time">{entry.timeSpent}s</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="results-leaderboard-container disabled-leaderboard">
                <h3>Leaderboard Rankings</h3>
                <div className="leaderboard-empty">
                  <span className="empty-icon font-emoji">⚡</span>
                  <p>Custom Flashcard Game</p>
                  <small>Scores for personalized flashcard games are not recorded on global leaderboards.</small>
                </div>
              </div>
            )}

            <div className="results-actions">
              <button
                type="button"
                className="results-button primary"
                onClick={() => {
                  const url = source === "TOPIC"
                    ? `/game/play?topicId=${topicId}&difficulty=${difficulty}&mode=${mode}&source=TOPIC`
                    : `/game/play?difficulty=${difficulty}&mode=${mode}&source=FLASHCARDS`;
                  router.replace(url);
                }}
              >
                Play Again
              </button>
              <Link className="results-button secondary" href="/game">
                Return to Menu
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function GamePlayPage() {
  return (
    <Suspense fallback={<main className="game-play-page"><p>Loading game arena...</p></main>}>
      <GamePlayContent />
    </Suspense>
  );
}
