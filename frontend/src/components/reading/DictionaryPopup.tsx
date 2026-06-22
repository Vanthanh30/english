"use client";

import { useEffect, useState } from "react";
import { readingApi, type DictionaryEntry, type HighlightColor } from "@/services/reading.service";

interface DictionaryPopupProps {
  word: string;
  charOffset: number;
  position: { top: number; left: number };
  onClose: () => void;
  onHighlightApplied: (color: HighlightColor) => void;
}

export default function DictionaryPopup({
  word,
  charOffset,
  position,
  onClose,
  onHighlightApplied,
}: DictionaryPopupProps) {
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingFlashcard, setSavingFlashcard] = useState(false);
  const [flashcardSaved, setFlashcardSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    readingApi
      .lookupWord(word)
      .then((res) => {
        if (!active) return;
        setEntry(res);
      })
      .catch((err) => {
        if (!active) return;
        setError("Definition not found");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [word]);

  // Handle outside clicks to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".dictionary-popup")) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handlePlayAudio = () => {
    if (!entry) return;
    if (entry.audioUrl) {
      const audio = new Audio(entry.audioUrl);
      audio.play().catch(() => {
        // Fallback to Web Speech API TTS
        speakWord(entry.word);
      });
    } else {
      speakWord(entry.word);
    }
  };

  const speakWord = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSaveFlashcard = async () => {
    if (!entry || savingFlashcard || flashcardSaved) return;
    setSavingFlashcard(true);
    try {
      const res = await readingApi.saveToFlashcard({
        word: entry.word,
        meaning: entry.meaning,
        meaningVi: entry.meaningVi,
        pronunciation: entry.pronunciation,
        partOfSpeech: entry.partOfSpeech,
        exampleSentence: entry.exampleSentence,
      });

      if (res.alreadySaved) {
        alert("This word is already in your flashcard review schedule!");
      } else {
        setFlashcardSaved(true);
      }
    } catch (err) {
      alert("Failed to save to flashcards");
    } finally {
      setSavingFlashcard(false);
    }
  };

  const handleCopyTranslation = () => {
    if (!entry?.meaningVi) return;
    navigator.clipboard.writeText(entry.meaningVi);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`dictionary-popup ${entry?.isPhrase ? "phrase-popup" : "word-popup"}`}
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translate(-50%, -105%)", // Position above the word
        zIndex: 9999,
      }}
    >
      <div className="popup-arrow"></div>
      {loading ? (
        <div className="popup-loading">Searching dictionary...</div>
      ) : error || !entry ? (
        <div className="popup-error">
          <p>{error || "Definition not found"}</p>
          <div className="popup-highlight-options">
            <button className="hl-opt hl-yellow" onClick={() => onHighlightApplied("YELLOW")}>🟡</button>
            <button className="hl-opt hl-green" onClick={() => onHighlightApplied("GREEN")}>🟢</button>
            <button className="hl-opt hl-red" onClick={() => onHighlightApplied("RED")}>🔴</button>
          </div>
        </div>
      ) : (
        <div className="popup-body">
          {/* Header section */}
          <div className="popup-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 className="popup-word" title={entry.word}>
                {entry.word.length > 30 ? `${entry.word.substring(0, 30)}...` : entry.word}
              </h4>
              <span className="popup-part">
                {entry.isPhrase ? "Cụm từ / Câu" : entry.partOfSpeech || "Vocabulary"}
              </span>
              {!entry.isPhrase && entry.pronunciation && (
                <span className="popup-ipa">{entry.pronunciation}</span>
              )}
            </div>
            {!entry.isPhrase && (
              <button className="audio-btn" onClick={handlePlayAudio} title="Listen Pronunciation">
                🔊
              </button>
            )}
          </div>

          {/* Translation section */}
          <div className="popup-definition-section">
            {entry.isPhrase ? (
              <div className="phrase-translation-wrapper">
                <div className="translation-title-bar">
                  <span>Dịch nghĩa (VI)</span>
                  <button className="copy-translation-btn" onClick={handleCopyTranslation}>
                    {copied ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                <div className="phrase-translation-text">{entry.meaningVi}</div>
              </div>
            ) : (
              <>
                {entry.meaningVi && (
                  <div className="word-translation-box">
                    <span className="translation-tag">Nghĩa tiếng Việt</span>
                    <p className="popup-meaning-vi">{entry.meaningVi}</p>
                  </div>
                )}
                {entry.meaning && (
                  <div className="word-eng-definition-box">
                    <span className="translation-tag">Definition (EN)</span>
                    <p className="popup-definition">{entry.meaning}</p>
                  </div>
                )}
                {entry.exampleSentence && (
                  <div className="word-example-box">
                    <span className="translation-tag">Example</span>
                    <p className="popup-example">“{entry.exampleSentence}”</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions section */}
          <div className="popup-actions">
            <div className="popup-highlight-options">
              <span className="hl-lbl">Highlight:</span>
              <button
                className="hl-opt hl-yellow-pill"
                onClick={() => onHighlightApplied("YELLOW")}
                title="Unknown Word"
              >
                🟡
              </button>
              <button
                className="hl-opt hl-green-pill"
                onClick={() => onHighlightApplied("GREEN")}
                title="Learned Word"
              >
                🟢
              </button>
              <button
                className="hl-opt hl-red-pill"
                onClick={() => onHighlightApplied("RED")}
                title="Important Word"
              >
                🔴
              </button>
            </div>

            {!entry.isPhrase && (
              <button
                className={`popup-save-flashcard-btn ${flashcardSaved ? "saved" : ""}`}
                onClick={handleSaveFlashcard}
                disabled={savingFlashcard || flashcardSaved}
              >
                {savingFlashcard ? "Saving..." : flashcardSaved ? "✓ Saved" : "+ Flashcard"}
              </button>
            )}
            {entry.isPhrase && (
              <button className="popup-close-btn" onClick={onClose}>
                Đóng
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
