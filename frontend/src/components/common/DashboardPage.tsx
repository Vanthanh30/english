"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { flashcardApi } from "@/services/flashcard.service";
import { useState } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const [dueCount, setDueCount] = useState<number | null>(null);

  useEffect(() => {
    if (sessionReady && !user) router.replace("/login");
  }, [router, sessionReady, user]);

  useEffect(() => {
    if (sessionReady && user) {
      flashcardApi
        .listDue()
        .then((cards) => setDueCount(cards.length))
        .catch(() => null);
    }
  }, [sessionReady, user]);

  async function logout() {
    await authApi.logout().catch(() => undefined);
    clearSession();
    router.replace("/login");
  }

  if (!sessionReady || !user) {
    return (
      <main className="dashboard-shell">
        <p>Restoring your session...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
        <button className="text-button" type="button" onClick={logout}>
          Sign out
        </button>
      </nav>
      <section className="dashboard-welcome">
        <p className="eyebrow">Your learning space</p>
        <h1>Welcome, {user.displayName}.</h1>
        <p>
          Continue a published vocabulary lesson or choose a new topic. Your
          learned words and lesson completion are saved to this account.
        </p>
        <div className="profile-row">
          <span>{user.role}</span>
          <span>{user.email}</span>
          <span>Email verified</span>
        </div>
        {user.role === "ADMIN" && (
          <Link className="button dashboard-action" href="/admin/content">
            Manage learning content
          </Link>
        )}
        <Link className="button dashboard-action" href="/courses">
          Browse vocabulary lessons
        </Link>
        <Link className="button dashboard-action" href="/notes">
          Open study notes
        </Link>
        <Link className="button dashboard-action" href="/flashcards">
          Study flashcards {dueCount !== null && dueCount > 0 ? `(${dueCount} due)` : ""}
        </Link>
      </section>
    </main>
  );
}
