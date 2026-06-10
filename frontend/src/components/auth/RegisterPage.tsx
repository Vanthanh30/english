"use client";

import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { authApi } from "@/services/auth.service";

export default function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const result = await authApi.register({
        displayName: String(form.get("displayName")),
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      setMessage(result.message);
      formElement.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Registration failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Create your learner profile"
      title="Start your first quest."
      description="Build a daily English habit with short lessons and timely review."
      footerText="Already have an account?"
      footerLink="/login"
      footerLabel="Sign in"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Display name
          <input
            name="displayName"
            type="text"
            minLength={2}
            maxLength={60}
            autoComplete="name"
            required
          />
        </label>
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
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}"
            title="Use at least 8 characters with uppercase, lowercase, and a number."
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p className="form-message form-error">{error}</p>}
        {message && <p className="form-message form-success">{message}</p>}
        <button className="button auth-submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
