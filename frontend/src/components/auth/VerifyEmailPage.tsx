"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authApi } from "@/services/auth.service";

export function VerifyEmailPage({ token }: Readonly<{ token: string }>) {
  const [status, setStatus] = useState(
    token
      ? "Verifying your email..."
      : "The verification link is missing its token.",
  );
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    authApi
      .verifyEmail(token)
      .then((result) => {
        setStatus(result.message);
        setVerified(true);
      })
      .catch((error: unknown) => {
        setStatus(
          error instanceof Error
            ? error.message
            : "The verification link is invalid.",
        );
      });
  }, [token]);

  return (
    <main className="auth-page">
      <section className="auth-card status-card">
        <span className="status-mark">{verified ? "OK" : "EQ"}</span>
        <p className="eyebrow">Email verification</p>
        <h1>{verified ? "You are ready." : "Checking your link."}</h1>
        <p className="auth-description">{status}</p>
        <Link className="button auth-submit" href={verified ? "/login" : "/"}>
          {verified ? "Sign in" : "Return home"}
        </Link>
      </section>
    </main>
  );
}
