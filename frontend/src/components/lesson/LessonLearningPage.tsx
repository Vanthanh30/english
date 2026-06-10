"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  lessonApi,
  type LearningLesson,
  type LearningVocabulary,
} from "@/services/lesson.service";
import { noteApi } from "@/services/note.service";
import { flashcardApi } from "@/services/flashcard.service";

interface LessonLearningPageProps {
  lessonId: string;
}

function HighlightedExample({
  sentence,
  word,
}: {
  sentence: string;
  word: string;
}) {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = sentence.split(new RegExp(`(${escapedWord})`, "gi"));

  return (
    <>
      {parts.map((part, index) =>
        part.toLocaleLowerCase() === word.toLocaleLowerCase() ? (
          <strong className="example-word-highlight" key={`${part}-${index}`}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function LessonLearningPage({
  lessonId,
}: LessonLearningPageProps) {
  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteStatus, setNoteStatus] = useState<{
    vocabularyId: string;
    saved: boolean;
  } | null>(null);
  const [noteMessage, setNoteMessage] = useState("");
  const [error, setError] = useState("");
  const [savedFlashcards, setSavedFlashcards] = useState<Set<string>>(new Set());
  const [isSavingFlashcard, setIsSavingFlashcard] = useState(false);

  useEffect(() => {
    lessonApi
      .get(lessonId)
      .then((data) => {
        setLesson(data);
        const firstIncomplete = data.vocabularies.findIndex(
          (item) => !item.completed,
        );
        setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Unable to load lesson",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [lessonId]);

  useEffect(() => {
    flashcardApi
      .list()
      .then((cards) => {
        setSavedFlashcards(new Set(cards.map((c) => c.vocabularyId)));
      })
      .catch(() => null);
  }, []);

  const current = lesson?.vocabularies[currentIndex];
  const noteStatusLoading =
    Boolean(current) && noteStatus?.vocabularyId !== current?.id;
  const savedToNotes =
    Boolean(current) &&
    noteStatus?.vocabularyId === current?.id &&
    Boolean(noteStatus?.saved);

  useEffect(() => {
    if (!current) return;
    let active = true;
    noteApi
      .getVocabularyStatus(current.id)
      .then((status) => {
        if (active) {
          setNoteStatus({
            vocabularyId: current.id,
            saved: status.saved,
          });
        }
      })
      .catch(() => {
        if (active) {
          setNoteStatus({
            vocabularyId: current.id,
            saved: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [current]);
  const allWordsComplete = useMemo(
    () =>
      Boolean(
        lesson?.vocabularies.length &&
          lesson.vocabularies.every((item) => item.completed),
      ),
    [lesson],
  );

  function playAudio(vocabulary: LearningVocabulary) {
    if (vocabulary.audioUrl) {
      void new Audio(vocabulary.audioUrl).play();
      return;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(vocabulary.word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  }

  async function markCurrentComplete() {
    if (!lesson || !current || current.completed) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await lessonApi.completeVocabulary(lesson.id, current.id);
      setLesson(updated);
      if (currentIndex < updated.vocabularies.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save progress",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function finishLesson() {
    if (!lesson) return;
    setIsSaving(true);
    setError("");
    try {
      setLesson(await lessonApi.complete(lesson.id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to complete lesson",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCurrentToFlashcards() {
    if (!lesson || !current || savedFlashcards.has(current.id)) return;
    setIsSavingFlashcard(true);
    setNoteMessage("");
    setError("");
    try {
      await flashcardApi.save(current.id);
      setSavedFlashcards((prev) => {
        const next = new Set(prev);
        next.add(current.id);
        return next;
      });
      setNoteMessage(`"${current.word}" was saved to your flashcards.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save vocabulary to flashcards",
      );
    } finally {
      setIsSavingFlashcard(false);
    }
  }

  async function saveCurrentToNotes() {
    if (!lesson || !current || savedToNotes) return;
    setIsSavingNote(true);
    setNoteMessage("");
    setError("");
    try {
      const result = await noteApi.saveVocabulary(current.id, lesson.id);
      setNoteStatus({ vocabularyId: current.id, saved: result.saved });
      setNoteMessage(
        result.created
          ? `"${current.word}" was saved to your study notes.`
          : `"${current.word}" is already in your study notes.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save vocabulary to notes",
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  if (isLoading) {
    return <main className="lesson-shell">Loading lesson...</main>;
  }

  if (error && !lesson) {
    return (
      <main className="lesson-shell">
        <p className="form-message form-error">{error}</p>
        <Link className="button dashboard-action" href="/courses">
          Back to topics
        </Link>
      </main>
    );
  }

  if (!lesson || !current) {
    return (
      <main className="lesson-shell">
        <p>This lesson does not contain vocabulary yet.</p>
      </main>
    );
  }

  return (
    <main className="lesson-shell">
      <nav className="lesson-nav">
        <Link className="text-link" href="/courses">
          Back to topics
        </Link>
        <span>
          {lesson.progress.completedVocabulary}/
          {lesson.progress.totalVocabulary} learned
        </span>
      </nav>

      <div className="learning-progress lesson-progress">
        <span style={{ width: `${lesson.progress.percentage}%` }} />
      </div>

      <header className="lesson-heading">
        <p className="eyebrow">{lesson.topic.name}</p>
        <h1>{lesson.title}</h1>
        <p>{lesson.description}</p>
      </header>

      <section className="vocabulary-stage">
        <div className="word-rail" aria-label="Lesson vocabulary">
          {lesson.vocabularies.map((item, index) => (
            <button
              className={[
                index === currentIndex ? "active" : "",
                item.completed ? "complete" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={item.id}
              onClick={() => {
                setCurrentIndex(index);
                setNoteMessage("");
              }}
              type="button"
            >
              {index + 1}
            </button>
          ))}
        </div>

        <article className="vocabulary-card">
          <div
            className="vocabulary-image"
            style={
              current.imageUrl
                ? { backgroundImage: `url("${current.imageUrl}")` }
                : undefined
            }
          >
            <span>{current.partOfSpeech ?? "vocabulary"}</span>
          </div>
          <div className="vocabulary-copy">
            <div className="vocabulary-title">
              <div>
                <p>{current.pronunciation ?? "English vocabulary"}</p>
                <h2>{current.word}</h2>
              </div>
              <div className="vocabulary-title-actions">
                <button
                  aria-label={`Play pronunciation for ${current.word}`}
                  className="audio-button"
                  onClick={() => playAudio(current)}
                  type="button"
                >
                  Listen
                </button>

                <button
                  aria-label={
                    savedFlashcards.has(current.id)
                      ? `${current.word} is saved to flashcards`
                      : `Save ${current.word} to flashcards`
                  }
                  className={`vocabulary-bookmark-button ${
                    savedFlashcards.has(current.id) ? "saved" : ""
                  }`}
                  disabled={isSavingFlashcard || savedFlashcards.has(current.id)}
                  onClick={() => void saveCurrentToFlashcards()}
                  type="button"
                >
                  <FlashcardIcon filled={savedFlashcards.has(current.id)} />
                  <span>
                    {isSavingFlashcard
                      ? "Saving"
                      : savedFlashcards.has(current.id)
                        ? "Saved"
                        : "Flashcard"}
                  </span>
                </button>
              </div>
            </div>
            <div className="vocabulary-meaning">
              <span>Nghĩa tiếng Việt</span>
              <h3>{current.meaningVi ?? "Chưa có nghĩa tiếng Việt"}</h3>
              <p>{current.meaning}</p>
            </div>
            {current.exampleSentence && (
              <blockquote>
                &ldquo;
                <HighlightedExample
                  sentence={current.exampleSentence}
                  word={current.word}
                />
                &rdquo;
              </blockquote>
            )}
            {noteMessage && (
              <p className="vocabulary-note-message">
                {noteMessage}
              </p>
            )}

            <div className="vocabulary-actions">
              <button
                className="secondary-button"
                disabled={currentIndex === 0}
                onClick={() => {
                  setCurrentIndex(currentIndex - 1);
                  setNoteMessage("");
                }}
                type="button"
              >
                Previous
              </button>
              {current.completed ? (
                <button
                  className="button"
                  disabled={currentIndex === lesson.vocabularies.length - 1}
                  onClick={() => {
                    setCurrentIndex(currentIndex + 1);
                    setNoteMessage("");
                  }}
                  type="button"
                >
                  Next word
                </button>
              ) : (
                <button
                  className="button"
                  disabled={isSaving}
                  onClick={markCurrentComplete}
                  type="button"
                >
                  {isSaving ? "Saving..." : "Mark learned"}
                </button>
              )}
            </div>
          </div>
        </article>
      </section>

      {error && <p className="form-message form-error">{error}</p>}
      {allWordsComplete && (
        <section className="lesson-complete">
          <div>
            <p className="eyebrow">Lesson ready</p>
            <h2>
              {lesson.progress.completedAt
                ? "Lesson completed."
                : "Every word is learned."}
            </h2>
          </div>
          {lesson.progress.completedAt ? (
            <Link className="button" href="/courses">
              Choose another lesson
            </Link>
          ) : (
            <button
              className="button"
              disabled={isSaving}
              onClick={finishLesson}
              type="button"
            >
              Complete lesson
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function FlashcardIcon({ filled }: Readonly<{ filled: boolean }>) {
  return (
    <svg
      fill={filled ? "currentColor" : "none"}
      height="20"
      viewBox="0 0 24 24"
      width="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function BookmarkIcon({ filled }: Readonly<{ filled: boolean }>) {
  return (
    <svg
      fill={filled ? "currentColor" : "none"}
      height="20"
      viewBox="0 0 24 24"
      width="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z" />
    </svg>
  );
}
