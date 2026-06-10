"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";

const features = [
  {
    number: "01",
    title: "Learn in context",
    description:
      "Explore topic-based lessons with pronunciation, examples, and progress tracking.",
  },
  {
    number: "02",
    title: "Review at the right time",
    description:
      "Turn useful words into flashcards and revisit them with spaced repetition.",
  },
  {
    number: "03",
    title: "Practice with purpose",
    description:
      "Use games, notes, and an AI tutor to move vocabulary into active memory.",
  },
];

export default function Home() {
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
        <div className="nav-actions">
          {sessionReady &&
            (user ? (
              <>
                <Link className="text-link" href="/dashboard">
                  {user.displayName}
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

      <section className="hero">
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

        <div className="quest-card" aria-label="Example daily quest">
          <div className="quest-card-header">
            <div>
              <p>Today&apos;s quest</p>
              <h2>At the coffee shop</h2>
            </div>
            <span className="streak">7 day streak</span>
          </div>
          <div className="progress-track">
            <span />
          </div>
          <div className="word-card">
            <div>
              <p className="word-type">verb</p>
              <h3>recommend</h3>
              <p className="phonetic">/rek-uh-mend/</p>
            </div>
            <button type="button" aria-label="Play pronunciation">
              Play
            </button>
          </div>
          <p className="example">
            &quot;Could you <strong>recommend</strong> something without
            dairy?&quot;
          </p>
          <div className="quest-meta">
            <span>8 words</span>
            <span>6 min</span>
            <span>+40 XP</span>
          </div>
        </div>
      </section>

      <section className="feature-section" id="roadmap">
        <div className="section-heading">
          <p className="eyebrow">One connected learning loop</p>
          <h2>Discover. Remember. Use.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
