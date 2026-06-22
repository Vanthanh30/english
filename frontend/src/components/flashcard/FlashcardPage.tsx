"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flashcardApi,
  type Flashcard,
  type ReviewDifficulty,
} from "@/services/flashcard.service";
import { useAuthStore } from "@/stores/auth.store";

type FlashcardView = "study" | "collection";

const renderHighlightedExample = (sentence: string, word: string) => {
  if (!sentence || !word) return sentence;

  const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const baseWordPattern = word.endsWith("e")
    ? escapedWord.slice(0, -1) + "e?"
    : escapedWord;

  const regex = new RegExp(
    `(\\b${baseWordPattern}(?:s|es|d|ed|ing|ion|ions)?\\b)`,
    "gi"
  );

  const parts = sentence.split(regex);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{part}</strong> : part
      )}
    </>
  );
};

export default function FlashcardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [view, setView] = useState<FlashcardView>("study");
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "new" | "hard" | "medium" | "easy">("all");
  const [activeStudyCard, setActiveStudyCard] = useState<Flashcard | null>(null);
  const [isModalFlipped, setIsModalFlipped] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [bulkStudyCards, setBulkStudyCards] = useState<Flashcard[]>([]);
  const [bulkStudyIndex, setBulkStudyIndex] = useState(0);
  
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 9;
  const [showAllFolders, setShowAllFolders] = useState(false);




  useEffect(() => {
    if (sessionReady && !user) router.replace("/login");
  }, [router, sessionReady, user]);

  const loadDueCards = useCallback(async () => {
    if (!sessionReady || !user) return;
    setLoading(true);
    try {
      const cards = await flashcardApi.listDue();
      setDueCards(cards);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load due flashcards");
    } finally {
      setLoading(false);
    }
  }, [sessionReady, user]);

  const loadAllCards = useCallback(async () => {
    if (!sessionReady || !user) return;
    setCollectionLoading(true);
    try {
      const cards = await flashcardApi.list();
      setAllCards(cards);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load flashcards collection");
    } finally {
      setCollectionLoading(false);
    }
  }, [sessionReady, user]);

  useEffect(() => {
    if (sessionReady && user) {
      void loadDueCards();
      void loadAllCards();
    }
  }, [sessionReady, user, loadDueCards, loadAllCards]);

  const playAudio = (word: string, audioUrl: string | null) => {
    if (audioUrl) {
      void new Audio(audioUrl).play();
      return;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleReview = async (difficulty: ReviewDifficulty) => {
    if (dueCards.length === 0 || transitioning) return;
    
    const currentCard = dueCards[currentIndex];
    setTransitioning(true);
    
    try {
      await flashcardApi.review(currentCard.id, difficulty);
      setSessionReviewedCount((prev) => prev + 1);
      
      // Load updated collections in background
      void loadAllCards();
      
      // Delay before moving to next card to allow smooth visual exit animation
      setTimeout(() => {
        setIsFlipped(false);
        setTimeout(() => {
          setDueCards((prev) => {
            const next = [...prev];
            next.splice(currentIndex, 1);
            return next;
          });
          setTransitioning(false);
        }, 150);
      }, 300);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to record review");
      setTransitioning(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this flashcard?")) return;
    try {
      await flashcardApi.delete(id);
      // Remove from all list
      setAllCards((prev) => prev.filter((c) => c.id !== id));
      // Remove from due list if present
      setDueCards((prev) => prev.filter((c) => c.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete flashcard");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCardDifficulty = (card: Flashcard) => {
    if (!card.lastReviewedAt) return "new";
    const diffTime = new Date(card.nextReviewAt).getTime() - new Date(card.lastReviewedAt).getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays >= 4.0) return "easy";
    if (diffDays >= 1.5) return "medium";
    return "hard";
  };

  const getDifficultyCount = (diff: "all" | "new" | "hard" | "medium" | "easy") => {
    return allCards.filter((c) => {
      if (selectedFolderId !== "all") {
        const topicId = c.vocabulary.topic?.id || "uncategorized";
        if (topicId !== selectedFolderId) return false;
      }
      if (diff === "all") return true;
      return getCardDifficulty(c) === diff;
    }).length;
  };

  const folders = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; count: number }>();
    allCards.forEach((card) => {
      const topic = card.vocabulary.topic;
      const topicId = topic?.id || "uncategorized";
      const topicName = topic?.name || "General";
      const topicSlug = topic?.slug || "uncategorized";

      const existing = map.get(topicId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(topicId, {
          name: topicName,
          slug: topicSlug,
          count: 1,
        });
      }
    });

    return Array.from(map.entries()).map(([id, info]) => ({
      id,
      ...info,
    }));
  }, [allCards]);

  const filteredCards = allCards.filter((c) => {
    const matchesSearch =
      c.vocabulary.word.toLowerCase().includes(search.toLowerCase()) ||
      c.vocabulary.meaning.toLowerCase().includes(search.toLowerCase()) ||
      (c.vocabulary.meaningVi &&
        c.vocabulary.meaningVi.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (difficultyFilter !== "all" && getCardDifficulty(c) !== difficultyFilter) {
      return false;
    }

    if (selectedFolderId !== "all") {
      const topicId = c.vocabulary.topic?.id || "uncategorized";
      if (topicId !== selectedFolderId) return false;
    }

    return true;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, difficultyFilter, selectedFolderId]);

  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);

  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * cardsPerPage;
    return filteredCards.slice(startIndex, startIndex + cardsPerPage);
  }, [filteredCards, currentPage]);

  const handleCloseModal = () => {
    setActiveStudyCard(null);
    setBulkStudyCards([]);
    setIsModalFlipped(false);
    void loadDueCards();
    void loadAllCards();
  };

  const handleStartBulkStudy = () => {
    if (selectedCardIds.length === 0) return;
    const cardsToStudy = allCards.filter((c) => selectedCardIds.includes(c.id));
    setBulkStudyCards(cardsToStudy);
    setBulkStudyIndex(0);
    setIsModalFlipped(false);
  };

  const handleModalReview = async (difficulty: ReviewDifficulty) => {
    const cardToReview = bulkStudyCards.length > 0 ? bulkStudyCards[bulkStudyIndex] : activeStudyCard;
    if (!cardToReview) return;

    try {
      await flashcardApi.review(cardToReview.id, difficulty);
      setSessionReviewedCount((prev) => prev + 1);
      
      if (bulkStudyCards.length > 0) {
        if (bulkStudyIndex + 1 < bulkStudyCards.length) {
          setIsModalFlipped(false);
          setTimeout(() => {
            setBulkStudyIndex((prev) => prev + 1);
          }, 200);
        } else {
          setBulkStudyCards([]);
          setSelectedCardIds([]);
          void loadDueCards();
          void loadAllCards();
          setIsModalFlipped(false);
        }
      } else {
        void loadDueCards();
        void loadAllCards();
        setActiveStudyCard(null);
        setIsModalFlipped(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to record review");
    }
  };

  const handleBulkMakeDue = async () => {
    if (selectedCardIds.length === 0) return;
    try {
      await flashcardApi.makeDue(selectedCardIds);
      setSelectedCardIds([]);
      void loadDueCards();
      void loadAllCards();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add selected cards to Active Study");
    }
  };

  const allFilteredIds = filteredCards.map((c) => c.id);
  const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedCardIds.includes(id));

  const handleSelectAll = () => {
    if (areAllSelected) {
      setSelectedCardIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedCardIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };



  const currentDueCard = dueCards[currentIndex];

  return (
    <main className="flashcards-page">
      <header className="flashcards-header">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
        <div className="flashcards-header-copy">
          <p className="eyebrow">Sprint 5 · Spaced Repetition Learning</p>
          <h1>Vocabulary Flashcards</h1>
          <p>Optimize your English retention using scientifically-timed reviews.</p>
        </div>
        <Link className="flashcards-dashboard-link" href="/dashboard">
          Back to dashboard
        </Link>
      </header>

      {error && (
        <div className="flashcards-error-banner">
          <p>{error}</p>
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <nav className="flashcards-view-tabs" aria-label="Flashcard modes">
        <button
          className={view === "study" ? "active" : ""}
          type="button"
          onClick={() => {
            setView("study");
            void loadDueCards();
          }}
        >
          <span className="flashcards-view-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </span>
          <span>
            <strong>Active Study</strong>
            <small>Review due vocabularies</small>
          </span>
          <b className="badge-due">{dueCards.length}</b>
        </button>

        <button
          className={view === "collection" ? "active" : ""}
          type="button"
          onClick={() => {
            setView("collection");
            void loadAllCards();
          }}
        >
          <span className="flashcards-view-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </span>
          <span>
            <strong>All Flashcards</strong>
            <small>Manage card collection</small>
          </span>
          <b className="badge-total">{allCards.length}</b>
        </button>
      </nav>

      {view === "study" ? (
        <section className="study-panel">
          {loading ? (
            <div className="study-loading-state">
              <p>Loading active study cards...</p>
            </div>
          ) : dueCards.length === 0 ? (
            <div className="study-complete-state">
              <div className="complete-trophy-container">
                <svg viewBox="0 0 24 24" fill="currentColor" className="trophy-svg">
                  <path fillRule="evenodd" d="M5.166 2.621A1 1 0 016 2h12a1 1 0 01.834.455l3.417 5.125A2 2 0 0120.584 10.5h-.759l-1.464 7.32A2 2 0 0116.4 19.5H7.6a2 2 0 01-1.961-1.68L4.175 10.5h-.759a2 2 0 01-1.667-2.924l3.417-5.125zM4 10.5h2l.96 4.8a4 4 0 003.88 3.2h2.32a4 4 0 003.88-3.2l.96-4.8h2a.5.5 0 00.5-.5V8.583L17.234 4H6.766L3.35 8.583A.5.5 0 003 9v1a.5.5 0 00.5.5zM12 21a1 1 0 011-1h2a1 1 0 110 2h-4a1 1 0 01-1-1zm-4 0a1 1 0 011-1h.01a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2>All Caught Up! 🎉</h2>
              <p>You have reviewed all due flashcards. Check back later or add new words from lessons.</p>
              
              <div className="study-stats-grid">
                <div className="stat-card">
                  <strong>{sessionReviewedCount}</strong>
                  <span>Reviewed today</span>
                </div>
                <div className="stat-card">
                  <strong>{allCards.length}</strong>
                  <span>Total collection</span>
                </div>
              </div>

              <div className="action-links">
                <Link href="/courses" className="btn-primary">Browse lessons</Link>
                <button type="button" onClick={loadDueCards} className="btn-secondary">Refresh</button>
              </div>
            </div>
          ) : (
            <div className="study-workspace">
              <div className="study-progress-bar-container">
                <div className="study-progress-text">
                  <span>Due Card {currentIndex + 1} of {dueCards.length}</span>
                  <span>Session reviewed: {sessionReviewedCount}</span>
                </div>
                <div className="study-progress-bar">
                  <div 
                    className="study-progress-bar-fill"
                    style={{ width: `${((currentIndex + 1) / dueCards.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="card-outer-container">
                <div 
                  className={`flashcard-scene ${transitioning ? "slide-out" : ""}`}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div className={`flashcard-card ${isFlipped ? "is-flipped" : ""}`}>
                    {/* Front of card */}
                    <div className="flashcard-face flashcard-front">
                      <div className="card-top-meta">
                        <span className="pos-badge">{currentDueCard.vocabulary.partOfSpeech ?? "vocab"}</span>
                        <span className="hint-label">Front</span>
                      </div>
                      
                      <div className="card-main-word">
                        <h2>{currentDueCard.vocabulary.word}</h2>
                        {currentDueCard.vocabulary.pronunciation && (
                          <p className="pronunciation-text">/{currentDueCard.vocabulary.pronunciation}/</p>
                        )}
                      </div>

                      <div className="card-actions-row" onClick={(e) => e.stopPropagation()}>
                        <button 
                          type="button" 
                          onClick={() => playAudio(currentDueCard.vocabulary.word, currentDueCard.vocabulary.audioUrl)}
                          className="btn-audio"
                          title="Listen pronunciation"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.063.922-2.063 2.063v4.875c0 1.141.922 2.062 2.063 2.062h1.932l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM18.57 17.47a.75.75 0 11-1.06 1.06 9.76 9.76 0 01-6.91 2.87V2.62a9.76 9.76 0 016.91 2.87.75.75 0 111.06 1.06 8.26 8.26 0 00-5.85 2.42v5.1a8.26 8.26 0 005.85 2.42z" />
                          </svg>
                          <span>Speak</span>
                        </button>
                      </div>

                      <div className="card-bottom-instruction">
                        <span>Click card to reveal definition</span>
                      </div>
                    </div>

                    {/* Back of card */}
                    <div className="flashcard-face flashcard-back">
                      <div className="card-top-meta">
                        <span className="pos-badge">{currentDueCard.vocabulary.partOfSpeech ?? "vocab"}</span>
                        <span className="hint-label">Back</span>
                      </div>

                      <div className="card-back-content">
                        <div className="meaning-section">
                          <p className="eyebrow-label">Vietnamese translation</p>
                          <h3>{currentDueCard.vocabulary.meaningVi ?? "Chưa có nghĩa tiếng Việt"}</h3>
                        </div>

                        <div className="definition-section">
                          <p className="eyebrow-label">English definition</p>
                          <p className="definition-text">{currentDueCard.vocabulary.meaning}</p>
                        </div>

                        {currentDueCard.vocabulary.exampleSentence && (
                          <div className="example-section">
                            <p className="eyebrow-label">Example sentence</p>
                            <blockquote>&ldquo;{renderHighlightedExample(currentDueCard.vocabulary.exampleSentence, currentDueCard.vocabulary.word)}&rdquo;</blockquote>
                          </div>
                        )}
                      </div>

                      <div className="card-bottom-instruction">
                        <span>Click card to show front</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assessment Panel (Only shown/enabled when card is flipped, but layout preserves space) */}
              <div className={`assessment-panel ${isFlipped ? "visible" : "hidden"}`}>
                <p className="assessment-prompt">Rate the difficulty to schedule next review:</p>
                <div className="difficulty-buttons" onClick={(e) => e.stopPropagation()}>
                  <button 
                    type="button" 
                    onClick={() => handleReview("hard")}
                    className="btn-difficulty hard"
                    title="Repeat tomorrow"
                  >
                    <span>Hard</span>
                    <small>1 day</small>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleReview("medium")}
                    className="btn-difficulty medium"
                    title="Repeat in 2 days"
                  >
                    <span>Medium</span>
                    <small>2 days</small>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleReview("easy")}
                    className="btn-difficulty easy"
                    title="Repeat in 5 days"
                  >
                    <span>Easy</span>
                    <small>5 days</small>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="collection-panel">
          <header className="collection-bar">
            <div className="collection-bar-top">
              <div className="search-bar-container">
                <span className="search-icon">⌕</span>
                <input
                  type="text"
                  placeholder="Search flashcards by word, translation, or definition..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="collection-summary">
                Showing <strong>{filteredCards.length}</strong> of {allCards.length} flashcards
              </div>
            </div>
            <div className="difficulty-filters">
              <button 
                className={`filter-btn ${difficultyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDifficultyFilter('all')}
              >
                All ({getDifficultyCount('all')})
              </button>
              <button 
                className={`filter-btn new ${difficultyFilter === 'new' ? 'active' : ''}`}
                onClick={() => setDifficultyFilter('new')}
              >
                New ({getDifficultyCount('new')})
              </button>
              <button 
                className={`filter-btn hard ${difficultyFilter === 'hard' ? 'active' : ''}`}
                onClick={() => setDifficultyFilter('hard')}
              >
                Hard ({getDifficultyCount('hard')})
              </button>
              <button 
                className={`filter-btn medium ${difficultyFilter === 'medium' ? 'active' : ''}`}
                onClick={() => setDifficultyFilter('medium')}
              >
                Medium ({getDifficultyCount('medium')})
              </button>
              <button 
                className={`filter-btn easy ${difficultyFilter === 'easy' ? 'active' : ''}`}
                onClick={() => setDifficultyFilter('easy')}
              >
                Easy ({getDifficultyCount('easy')})
              </button>
              <button 
                type="button"
                className={`filter-btn select-all-btn ${areAllSelected ? 'active' : ''}`}
                onClick={handleSelectAll}
              >
                {areAllSelected ? "Deselect All" : "Select All Filtered"}
              </button>
            </div>
          </header>

          {folders.length > 0 && (
            <div className="folders-section">
              <div className="folders-header-row">
                <h3 className="folders-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-green-700">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <span>Vocabulary Folders</span>
                </h3>
                {folders.length > 4 && (
                  <button 
                    type="button" 
                    className="btn-toggle-folders"
                    onClick={() => setShowAllFolders(prev => !prev)}
                  >
                    {showAllFolders ? "Show Less" : `Show All (${folders.length + 1})`}
                  </button>
                )}
              </div>
              <div className="folders-grid">
                <div 
                  className={`folder-card ${selectedFolderId === "all" ? "active" : ""}`}
                  onClick={() => setSelectedFolderId("all")}
                >
                  <div className="folder-icon-wrapper">📂</div>
                  <div className="folder-info">
                    <span className="folder-name">All Vocabularies</span>
                    <span className="folder-count">{allCards.length} cards</span>
                  </div>
                </div>

                {(showAllFolders ? folders : folders.slice(0, 4)).map((folder) => (
                  <div 
                    key={folder.id}
                    className={`folder-card ${selectedFolderId === folder.id ? "active" : ""}`}
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    <div className="folder-icon-wrapper">📁</div>
                    <div className="folder-info">
                      <span className="folder-name">{folder.name}</span>
                      <span className="folder-count">{folder.count} cards</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedCardIds.length > 0 && (
            <div className="bulk-actions-bar">
              <span>Selected <strong>{selectedCardIds.length}</strong> flashcards to study</span>
              <div className="bulk-actions-buttons">
                <button 
                  type="button" 
                  className="btn-bulk-learn"
                  onClick={handleStartBulkStudy}
                >
                  Learn Selected
                </button>
                <button 
                  type="button" 
                  className="btn-bulk-due"
                  onClick={handleBulkMakeDue}
                >
                  Add to Active Study
                </button>
                <button 
                  type="button" 
                  className="btn-bulk-clear"
                  onClick={() => setSelectedCardIds([])}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {collectionLoading ? (
            <div className="collection-loading-state">
              <p>Loading flashcards collection...</p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="collection-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3>No cards match your search</h3>
              <p>Try searching another keyword or clear the input.</p>
              {search && (
                <button type="button" onClick={() => setSearch("")} className="btn-secondary">Clear Search</button>
              )}
            </div>
          ) : (
            <>
              <div className="collection-grid">
                {paginatedCards.map((card) => (
                  <article className="collection-card" key={card.id}>
                    <div className="card-header">
                      <div className="card-tags">
                        <input 
                          type="checkbox" 
                          checked={selectedCardIds.includes(card.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedCardIds(prev => 
                              prev.includes(card.id) 
                                ? prev.filter(id => id !== card.id) 
                                : [...prev, card.id]
                            );
                          }}
                          className="card-select-checkbox"
                        />
                        <span className="card-pos">{card.vocabulary.partOfSpeech ?? "vocab"}</span>
                        {(() => {
                          const diff = getCardDifficulty(card);
                          return (
                            <span className={`difficulty-badge ${diff}`}>
                              {diff === "easy" && "Easy"}
                              {diff === "medium" && "Medium"}
                              {diff === "hard" && "Hard"}
                              {diff === "new" && "New"}
                            </span>
                          );
                        })()}
                      </div>

                      <button 
                        type="button" 
                        onClick={() => handleDelete(card.id)}
                        className="btn-delete-card"
                        title="Remove from collection"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <div className="card-main">
                      <div className="word-row">
                        <h3>{card.vocabulary.word}</h3>
                        <button 
                          type="button" 
                          onClick={() => playAudio(card.vocabulary.word, card.vocabulary.audioUrl)}
                          className="btn-small-audio"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.063.922-2.063 2.063v4.875c0 1.141.922 2.062 2.063 2.062h1.932l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM17.56 12a5.3 5.3 0 01-2.06 4.19.75.75 0 01-.94-1.17 3.8 3.8 0 001.5-3.02 3.8 3.8 0 00-1.5-3.02.75.75 0 01.94-1.17A5.3 5.3 0 0117.56 12z" />
                          </svg>
                        </button>
                      </div>
                      {card.vocabulary.pronunciation && (
                        <p className="card-pronunciation">/{card.vocabulary.pronunciation}/</p>
                      )}
                      <p className="card-meaning-vi">{card.vocabulary.meaningVi ?? "Chưa dịch"}</p>
                      <p className="card-meaning-en">{card.vocabulary.meaning}</p>
                    </div>

                    <div className="card-footer">
                      <div className="footer-item">
                        <span>Next Review:</span>
                        <strong>{formatDate(card.nextReviewAt)}</strong>
                      </div>
                      {card.lastReviewedAt && (
                        <div className="footer-item">
                          <span>Last Reviewed:</span>
                          <span>{formatDate(card.lastReviewedAt)}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn-card-study"
                        onClick={() => {
                          setActiveStudyCard(card);
                          setIsModalFlipped(false);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                        Study Flashcard
                      </button>

                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flashcards-pagination">
                  <span className="pagination-info">
                    Showing {(currentPage - 1) * cardsPerPage + 1} - {Math.min(currentPage * cardsPerPage, filteredCards.length)} of {filteredCards.length} cards
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      title="First Page"
                    >
                      &laquo;
                    </button>
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                      title="Previous Page"
                    >
                      &lsaquo;
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                      })
                      .map((page, idx, arr) => {
                        const elements = [];
                        if (idx > 0 && page - arr[idx - 1] > 1) {
                          elements.push(<span key={`ellipsis-${page}`} className="pagination-ellipsis" style={{ padding: "0 4px", color: "#87928b" }}>...</span>);
                        }
                        elements.push(
                          <button
                            key={page}
                            type="button"
                            className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        );
                        return elements;
                      })}

                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      title="Next Page"
                    >
                      &rsaquo;
                    </button>
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      title="Last Page"
                    >
                      &raquo;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {(activeStudyCard || bulkStudyCards.length > 0) && (() => {
        const currentModalCard = bulkStudyCards.length > 0 ? bulkStudyCards[bulkStudyIndex] : activeStudyCard;

        if (!currentModalCard) return null;
        
        return (
          <div className="study-modal-overlay" onClick={handleCloseModal}>
            <div className="study-modal-container" onClick={(e) => e.stopPropagation()}>
              <header className="study-modal-header">
                <h3>
                  {bulkStudyCards.length > 0 
                    ? `Study Flashcard (${bulkStudyIndex + 1} of ${bulkStudyCards.length})` 
                    : "Study Flashcard"
                  }
                </h3>
                <button 
                  type="button" 
                  className="study-modal-close" 
                  onClick={handleCloseModal}
                >
                  ✕
                </button>
              </header>
              
              <div className="study-modal-body">
                <div className="card-outer-container">
                  <div 
                    className="flashcard-scene"
                    onClick={() => setIsModalFlipped(!isModalFlipped)}
                  >
                    <div className={`flashcard-card ${isModalFlipped ? "is-flipped" : ""}`}>
                      {/* Front of card */}
                      <div className="flashcard-face flashcard-front">
                        <div className="card-top-meta">
                          <span className="pos-badge">{currentModalCard.vocabulary.partOfSpeech ?? "vocab"}</span>
                          <span className="hint-label">Front</span>
                        </div>
                        
                        <div className="card-main-word">
                          <h2>{currentModalCard.vocabulary.word}</h2>
                          {currentModalCard.vocabulary.pronunciation && (
                            <p className="pronunciation-text">/{currentModalCard.vocabulary.pronunciation}/</p>
                          )}
                        </div>

                        <div className="card-actions-row" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button" 
                            onClick={() => playAudio(currentModalCard.vocabulary.word, currentModalCard.vocabulary.audioUrl)}
                            className="btn-audio"
                            title="Listen pronunciation"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.063.922-2.063 2.063v4.875c0 1.141.922 2.062 2.063 2.062h1.932l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM18.57 17.47a.75.75 0 11-1.06 1.06 9.76 9.76 0 01-6.91 2.87V2.62a9.76 9.76 0 016.91 2.87.75.75 0 111.06 1.06 8.26 8.26 0 00-5.85 2.42v5.1a8.26 8.26 0 005.85 2.42z" />
                            </svg>
                            <span>Speak</span>
                          </button>
                        </div>

                        <div className="card-bottom-instruction">
                          <span>Click card to reveal definition</span>
                        </div>
                      </div>

                      {/* Back of card */}
                      <div className="flashcard-face flashcard-back">
                        <div className="card-top-meta">
                          <span className="pos-badge">{currentModalCard.vocabulary.partOfSpeech ?? "vocab"}</span>
                          <span className="hint-label">Back</span>
                        </div>

                        <div className="card-back-content">
                          <div className="meaning-section">
                            <p className="eyebrow-label">Vietnamese translation</p>
                            <h3>{currentModalCard.vocabulary.meaningVi ?? "No translation available"}</h3>
                          </div>

                          <div className="definition-section">
                            <p className="eyebrow-label">English definition</p>
                            <p className="definition-text">{currentModalCard.vocabulary.meaning}</p>
                          </div>

                          {currentModalCard.vocabulary.exampleSentence && (
                            <div className="example-section">
                              <p className="eyebrow-label">Example sentence</p>
                              <blockquote>&ldquo;{renderHighlightedExample(currentModalCard.vocabulary.exampleSentence, currentModalCard.vocabulary.word)}&rdquo;</blockquote>
                            </div>
                          )}
                        </div>

                        <div className="card-bottom-instruction">
                          <span>Click card to show front</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assessment Panel inside Modal */}
                <div className={`assessment-panel ${isModalFlipped ? "visible" : "hidden"}`}>
                  <p className="assessment-prompt">Rate the difficulty to schedule next review:</p>
                  <div className="difficulty-buttons" onClick={(e) => e.stopPropagation()}>
                    <button 
                      type="button" 
                      onClick={() => handleModalReview("hard")}
                      className="btn-difficulty hard"
                      title="Repeat tomorrow"
                    >
                      <span>Hard</span>
                      <small>1 day</small>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleModalReview("medium")}
                      className="btn-difficulty medium"
                      title="Repeat in 2 days"
                    >
                      <span>Medium</span>
                      <small>2 days</small>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleModalReview("easy")}
                      className="btn-difficulty easy"
                      title="Repeat in 5 days"
                    >
                      <span>Easy</span>
                      <small>5 days</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

