"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";

export default function Home() {
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const playAudio = (word: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleFlip = () => {
    setIsCardFlipped(!isCardFlipped);
  };

  return (
    <>
      <header className="site-header">
        <nav className="site-nav" aria-label="Primary navigation">
          <Link className="brand" href="/">
            <span className="brand-mark">EQ</span>
            <span>English Quest</span>
          </Link>
          <div className="nav-actions">
            {sessionReady &&
              (user ? (
                <>
                  <Link className="user-nav-profile" href="/dashboard">
                    <div className="avatar-mini">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                    </div>
                    <span className="username">{user.displayName}</span>
                  </Link>
                  <Link className="button button-small" href="/courses">
                    Continue learning
                  </Link>
                </>
              ) : (
                <>
                  <Link className="text-link" href="/login">
                    Sign in
                  </Link>
                  <Link className="button button-small" href="/register">
                    Start learning
                  </Link>
                </>
              ))}
          </div>
        </nav>
      </header>

      <main>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">A better daily English habit</p>
          <h1>
            Make every new word
            <span> part of your world.</span>
          </h1>
          <p className="hero-description">
            Short, focused quests combine vocabulary, review, and real practice
            so that progress feels clear and learning stays consistent.
          </p>
          <div className="hero-actions" id="start">
            <Link className="button" href={user ? "/courses" : "/register"}>
              {user ? "Continue your quest" : "Begin your first quest"}
            </Link>
            <span>
              {user
                ? `Signed in as ${user.displayName}.`
                : "No credit card. Learn at your pace."}
            </span>
          </div>
        </div>

        {/* Interactive 3D Preview Card */}
        <div 
          className="interactive-preview-card" 
          onClick={toggleFlip}
          aria-label="Interactive preview vocabulary card. Click to flip."
          title="Click to flip the card!"
        >
          <div className={`preview-card-inner ${isCardFlipped ? "is-flipped" : ""}`}>
            {/* FRONT FACE */}
            <div className="preview-card-front">
              <div>
                <p className="preview-eyebrow">Today&apos;s word preview</p>
                <p className="preview-word-type">verb</p>
                <h3>recommend</h3>
                <p className="preview-phonetic">/rek-uh-mend/</p>
              </div>

              <div>
                <button
                  type="button"
                  className="preview-btn-audio"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card from flipping
                    playAudio("recommend");
                  }}
                  aria-label="Play pronunciation of recommend"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                  Speak
                </button>
              </div>

              <p className="preview-footer-hint">💡 Click card to flip and view details</p>
            </div>

            {/* BACK FACE */}
            <div className="preview-card-back">
              <div>
                <p className="preview-eyebrow">Translation & Meaning</p>
                <h3>Gợi ý, giới thiệu</h3>
                <p className="preview-definition">
                  To present energy, ideas, or options as worthy of acceptance or trial.
                </p>
              </div>

              <p className="preview-example">
                &quot;Could you <strong>recommend</strong> something without dairy?&quot;
              </p>

              <p className="preview-footer-hint">🔄 Click card to flip back</p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline / Learning Loop Section */}
      <section className="landing-timeline-section" id="how-it-works">
        <div className="section-heading" style={{ color: 'var(--ink)' }}>
          <div>
            <p className="eyebrow" style={{ color: 'var(--green)' }}>The Learning Cycle</p>
            <h2>One connected learning loop.</h2>
          </div>
        </div>

        <div className="timeline-flow">
          <div className="timeline-step">
            <span className="step-num">1</span>
            <span className="timeline-step-badge acquire">Acquire</span>
            <h3>Interactive Lessons</h3>
            <p>
              Explore curated, topic-based lessons with clear phonetic guides and translation context.
            </p>
          </div>

          <div className="timeline-step">
            <span className="step-num">2</span>
            <span className="timeline-step-badge retain">Retain</span>
            <h3>Spaced Repetition</h3>
            <p>
              Automatically schedule flashcard reviews at the optimal time to reinforce long-term memory.
            </p>
          </div>

          <div className="timeline-step">
            <span className="step-num">3</span>
            <span className="timeline-step-badge reflex">Reflex</span>
            <h3>Vocabulary Games</h3>
            <p>
              Test your recall speed with dynamic matching games, built directly from your custom flashcards.
            </p>
          </div>

          <div className="timeline-step">
            <span className="step-num">4</span>
            <span className="timeline-step-badge reflect">Reflect</span>
            <h3>Contextual Notes</h3>
            <p>
              Attach personal notes, usage tips, and extra example sentences to fully internalize new words.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Section Showcase */}
      <section className="feature-section" id="features">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Explore Features</p>
            <h2>Designed for active recall.</h2>
          </div>
        </div>

        <div className="premium-feature-grid">
          <article className="premium-feature-card">
            <span className="icon-holder">📚</span>
            <h3>Topic Lessons</h3>
            <p>
              Cover real-life situations from dining out to professional interviews. Learn relevant vocabulary with high-quality phonetic guides.
            </p>
          </article>

          <article className="premium-feature-card">
            <span className="icon-holder">🗂️</span>
            <h3>Custom Flashcards</h3>
            <p>
              Select words directly from your lessons to create custom study decks. Uses spaced repetition to optimize your study sessions.
            </p>
          </article>

          <article className="premium-feature-card">
            <span className="icon-holder">🎯</span>
            <h3>Matching Games</h3>
            <p>
              Match vocabularies to their meanings against a ticking clock. Keep your brain sharp and build fast cognitive reflexes.
            </p>
          </article>

          <article className="premium-feature-card">
            <span className="icon-holder">📝</span>
            <h3>Study Notes</h3>
            <p>
              Add annotations and custom example sentences to your words. Writing context down cements the vocabulary in your mind.
            </p>
          </article>
        </div>
      </section>
    </main>
    </>
  );
}
