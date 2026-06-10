"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { authApi } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sessionReady && user) router.replace("/dashboard");
  }, [router, sessionReady, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const session = await authApi.login({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      setSession(session);
      router.replace("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Login failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Continue your quest."
      description="Sign in to return to your lessons, reviews, and progress."
      footerText="New to English Quest?"
      footerLink="/register"
      footerLabel="Create an account"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-message form-error">{error}</p>}
        <button className="button auth-submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
