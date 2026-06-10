"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  lessonApi,
  type LearningTopic,
} from "@/services/lesson.service";

export default function CourseCatalogPage() {
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    lessonApi
      .listTopics()
      .then(setTopics)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Unable to load topics",
        ),
      )
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="learning-shell">
      <nav className="dashboard-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
        <Link className="text-link" href="/dashboard">
          Dashboard
        </Link>
      </nav>

      <header className="learning-header">
        <div>
          <p className="eyebrow">Vocabulary paths</p>
          <h1>Choose your next topic.</h1>
          <p>
            Learn words in short published lessons. Your progress is saved
            automatically for every account.
          </p>
        </div>
        <span className="learning-count">{topics.length} topics</span>
      </header>

      {isLoading && <p className="learning-status">Loading your lessons...</p>}
      {error && <p className="form-message form-error">{error}</p>}
      {!isLoading && !error && topics.length === 0 && (
        <section className="empty-state">
          <h2>No published lessons yet.</h2>
          <p>An administrator needs to publish content before learning begins.</p>
        </section>
      )}

      <section className="topic-grid">
        {topics.map((topic) => (
          <article className="topic-card" key={topic.id}>
            <div
              className="topic-visual"
              style={
                topic.imageUrl
                  ? { backgroundImage: `url("${topic.imageUrl}")` }
                  : undefined
              }
            >
              <span>{topic.level}</span>
              <strong>{topic.name.slice(0, 2).toUpperCase()}</strong>
            </div>
            <div className="topic-content">
              <div className="topic-heading">
                <div>
                  <h2>{topic.name}</h2>
                  <p>{topic.description}</p>
                </div>
                <span>{topic.progress.percentage}%</span>
              </div>
              <div className="learning-progress">
                <span style={{ width: `${topic.progress.percentage}%` }} />
              </div>
              <div className="lesson-list">
                {topic.lessons.map((lesson) => (
                  <Link
                    className="lesson-link"
                    href={`/lessons/${lesson.id}`}
                    key={lesson.id}
                  >
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>
                        {lesson.progress.completedVocabulary}/
                        {lesson.progress.totalVocabulary} words
                      </small>
                    </span>
                    <b>
                      {lesson.progress.completedAt
                        ? "Review"
                        : lesson.progress.percentage
                          ? "Continue"
                          : "Start"}
                    </b>
                  </Link>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
