"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  flashcardApi,
  type Flashcard,
  type WritingPracticeMode,
  type WritingPracticeResult,
} from "@/services/flashcard.service";
import { useAuthStore } from "@/stores/auth.store";

interface PracticeAnswer {
  word: string;
  correct: boolean;
}

function shuffleCards(cards: Flashcard[]): Flashcard[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export default function WritingPracticePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const [availableCards, setAvailableCards] = useState<Flashcard[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<WritingPracticeMode>("listening");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<WritingPracticeResult | null>(null);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionReady && !user) router.replace("/login");
  }, [router, sessionReady, user]);

  useEffect(() => {
    if (!sessionReady || !user) return;
    let cancelled = false;

    flashcardApi
      .list()
      .then((loadedCards) => {
        if (!cancelled) {
          setAvailableCards(loadedCards);
          setSelectedCardIds(loadedCards.map((card) => card.id));
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load flashcards for practice",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionReady, user]);

  const filteredCards = availableCards.filter((card) => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return true;
    return (
      card.vocabulary.word.toLocaleLowerCase().includes(query) ||
      card.vocabulary.meaning.toLocaleLowerCase().includes(query) ||
      (card.vocabulary.meaningVi ?? "").toLocaleLowerCase().includes(query)
    );
  });
  const visibleCardIds = filteredCards.map((card) => card.id);
  const allVisibleSelected =
    visibleCardIds.length > 0 &&
    visibleCardIds.every((id) => selectedCardIds.includes(id));
  const currentCard = cards[currentIndex];
  const completed =
    practiceStarted && cards.length > 0 && currentIndex >= cards.length;
  const correctCount = answers.filter((item) => item.correct).length;
  const accuracy =
    answers.length === 0 ? 0 : Math.round((correctCount / answers.length) * 100);

  const playAudio = useCallback((card: Flashcard) => {
    if (card.vocabulary.audioUrl) {
      void new Audio(card.vocabulary.audioUrl).play();
      return;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(card.vocabulary.word);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  async function submitAnswer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!currentCard || result || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const checked = await flashcardApi.submitWritingPractice(
        currentCard.id,
        mode,
        answer,
      );
      setResult(checked);
      setAnswers((previous) => [
        ...previous,
        { word: checked.expectedAnswer, correct: checked.correct },
      ]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to check your answer",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function continuePractice() {
    setCurrentIndex((index) => index + 1);
    setAnswer("");
    setResult(null);
  }

  function toggleCard(id: string) {
    setSelectedCardIds((selected) =>
      selected.includes(id)
        ? selected.filter((cardId) => cardId !== id)
        : [...selected, id],
    );
  }

  function toggleVisibleCards() {
    setSelectedCardIds((selected) => {
      if (allVisibleSelected) {
        return selected.filter((id) => !visibleCardIds.includes(id));
      }
      return Array.from(new Set([...selected, ...visibleCardIds]));
    });
  }

  function startPractice() {
    const selectedCards = availableCards.filter((card) =>
      selectedCardIds.includes(card.id),
    );
    if (selectedCards.length === 0) return;

    setCards(shuffleCards(selectedCards));
    setPracticeStarted(true);
    setCurrentIndex(0);
    setAnswer("");
    setResult(null);
    setAnswers([]);
  }

  function returnToSelection() {
    setPracticeStarted(false);
    setCards([]);
    setCurrentIndex(0);
    setAnswer("");
    setResult(null);
    setAnswers([]);
  }

  if (!sessionReady || !user) {
    return (
      <main className="writing-practice-page">
        <p>Restoring your session...</p>
      </main>
    );
  }

  return (
    <main className="writing-practice-page">
      <header className="flashcards-header">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
        <div className="flashcards-header-copy">
          <p className="eyebrow">Sprint 6 · Active Recall</p>
          <h1>Vocabulary Writing Practice</h1>
          <p>Listen or read the meaning, then write the English word.</p>
        </div>
        <Link className="flashcards-dashboard-link" href="/flashcards">
          Back to flashcards
        </Link>
      </header>

      {error && (
        <div className="flashcards-error-banner">
          <p>{error}</p>
          <button type="button" onClick={() => setError(null)}>
            Close
          </button>
        </div>
      )}

      {loading ? (
        <section className="writing-practice-state">
          <p>Preparing your flashcards...</p>
        </section>
      ) : availableCards.length === 0 ? (
        <section className="writing-practice-state">
          <span className="practice-state-mark">Aa</span>
          <h2>No flashcards available</h2>
          <p>Save vocabulary from a lesson before starting writing practice.</p>
          <Link className="button" href="/courses">
            Browse lessons
          </Link>
        </section>
      ) : !practiceStarted ? (
        <section className="practice-selection-panel">
          <div className="practice-selection-heading">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>Choose flashcards to practice</h2>
              <p>
                Select one or more saved words. Only selected flashcards will
                appear in this writing session.
              </p>
            </div>
            <div className="practice-selected-count">
              <strong>{selectedCardIds.length}</strong>
              <span>selected</span>
            </div>
          </div>

          <div className="practice-selection-toolbar">
            <input
              type="search"
              placeholder="Search by word or meaning..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" onClick={toggleVisibleCards}>
              {allVisibleSelected ? "Deselect visible" : "Select visible"}
            </button>
          </div>

          {filteredCards.length === 0 ? (
            <div className="practice-selection-empty">
              No flashcards match your search.
            </div>
          ) : (
            <div className="practice-selection-grid">
              {filteredCards.map((card) => {
                const selected = selectedCardIds.includes(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`practice-selection-card ${
                      selected ? "selected" : ""
                    }`}
                    aria-pressed={selected}
                    onClick={() => toggleCard(card.id)}
                  >
                    <span className="practice-selection-check">
                      {selected ? "✓" : ""}
                    </span>
                    <span className="practice-selection-copy">
                      <strong>{card.vocabulary.word}</strong>
                      <small>
                        {card.vocabulary.meaningVi ?? card.vocabulary.meaning}
                      </small>
                    </span>
                    <span className="practice-selection-pos">
                      {card.vocabulary.partOfSpeech ?? "vocabulary"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="practice-selection-footer">
            <span>
              {selectedCardIds.length === 0
                ? "Select at least one flashcard to continue."
                : `${selectedCardIds.length} flashcard${
                    selectedCardIds.length === 1 ? "" : "s"
                  } ready.`}
            </span>
            <button
              className="practice-submit-button"
              type="button"
              disabled={selectedCardIds.length === 0}
              onClick={startPractice}
            >
              Start writing practice
            </button>
          </div>
        </section>
      ) : completed ? (
        <section className="writing-practice-summary">
          <p className="eyebrow">Session complete</p>
          <h2>{accuracy}% accuracy</h2>
          <p>
            You wrote {correctCount} of {answers.length} words correctly.
          </p>
          <div className="practice-summary-grid">
            <div>
              <strong>{correctCount}</strong>
              <span>Correct</span>
            </div>
            <div>
              <strong>{answers.length - correctCount}</strong>
              <span>Review again</span>
            </div>
            <div>
              <strong>{answers.length}</strong>
              <span>Total words</span>
            </div>
          </div>
          {answers.some((item) => !item.correct) && (
            <div className="practice-review-list">
              <span>Words to review</span>
              <div>
                {answers
                  .filter((item) => !item.correct)
                  .map((item, index) => (
                    <b key={`${item.word}-${index}`}>{item.word}</b>
                  ))}
              </div>
            </div>
          )}
          <div className="practice-summary-actions">
            <button className="button" type="button" onClick={startPractice}>
              Practice again
            </button>
            <button
              className="practice-secondary-button"
              type="button"
              onClick={returnToSelection}
            >
              Choose other words
            </button>
            <Link className="practice-secondary-button" href="/flashcards">
              Return to flashcards
            </Link>
          </div>
        </section>
      ) : (
        <section className="writing-practice-workspace">
          <div className="practice-toolbar">
            <div>
              <span>
                Word {currentIndex + 1} of {cards.length}
              </span>
              <strong>{accuracy}% accuracy</strong>
            </div>
            <div className="practice-progress">
              <span
                style={{
                  width: `${(currentIndex / cards.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="practice-mode-switch" aria-label="Writing prompt mode">
            <button
              className={mode === "listening" ? "active" : ""}
              type="button"
              disabled={Boolean(result)}
              onClick={() => {
                setMode("listening");
                setAnswer("");
              }}
            >
              <strong>Listening</strong>
              <span>Hear the word and type it</span>
            </button>
            <button
              className={mode === "meaning" ? "active" : ""}
              type="button"
              disabled={Boolean(result)}
              onClick={() => {
                setMode("meaning");
                setAnswer("");
              }}
            >
              <strong>Meaning</strong>
              <span>Read the definition and type it</span>
            </button>
          </div>

          <article
            className={`practice-question-card ${
              result ? (result.correct ? "is-correct" : "is-incorrect") : ""
            }`}
          >
            <div className="practice-question-meta">
              <span>{currentCard.vocabulary.partOfSpeech ?? "vocabulary"}</span>
              <span>{mode === "listening" ? "Audio prompt" : "Meaning prompt"}</span>
            </div>

            {mode === "listening" ? (
              <div className="practice-audio-prompt">
                <button
                  type="button"
                  onClick={() => playAudio(currentCard)}
                  aria-label="Play vocabulary audio"
                >
                  <span aria-hidden="true">▶</span>
                </button>
                <h2>Listen carefully</h2>
                <p>Replay the audio as many times as needed.</p>
              </div>
            ) : (
              <div className="practice-meaning-prompt">
                <p className="eyebrow">Vietnamese meaning</p>
                <h2>
                  {currentCard.vocabulary.meaningVi ??
                    currentCard.vocabulary.meaning}
                </h2>
                {currentCard.vocabulary.meaningVi && (
                  <p>{currentCard.vocabulary.meaning}</p>
                )}
              </div>
            )}

            <form className="practice-answer-form" onSubmit={submitAnswer}>
              <label htmlFor="writing-answer">Write the English word</label>
              <input
                id="writing-answer"
                autoComplete="off"
                autoFocus
                disabled={Boolean(result) || submitting}
                placeholder="Type your answer..."
                spellCheck={false}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
              />

              {result && (
                <div
                  className={`practice-feedback ${
                    result.correct ? "correct" : "incorrect"
                  }`}
                >
                  <strong>
                    {result.correct ? "Correct spelling" : "Not quite"}
                  </strong>
                  <span>
                    The answer is <b>{result.expectedAnswer}</b>
                    {currentCard.vocabulary.pronunciation
                      ? ` /${currentCard.vocabulary.pronunciation}/`
                      : ""}
                  </span>
                  <small>
                    {result.correct
                      ? "This card will return in 5 days."
                      : "This card will return tomorrow for another review."}
                  </small>
                </div>
              )}

              <div className="practice-form-actions">
                {!result ? (
                  <>
                    <button
                      className="practice-submit-button"
                      type="submit"
                      disabled={!answer.trim() || submitting}
                    >
                      {submitting ? "Checking..." : "Check answer"}
                    </button>
                    <button
                      className="practice-skip-button"
                      type="button"
                      disabled={submitting}
                      onClick={() => void submitAnswer()}
                    >
                      Skip word
                    </button>
                  </>
                ) : (
                  <button
                    className="practice-submit-button"
                    type="button"
                    onClick={continuePractice}
                  >
                    {currentIndex + 1 === cards.length
                      ? "View results"
                      : "Next word"}
                  </button>
                )}
              </div>
            </form>
          </article>
        </section>
      )}
    </main>
  );
}
