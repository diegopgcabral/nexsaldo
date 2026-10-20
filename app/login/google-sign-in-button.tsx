"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithGoogle() {
    setErrorMessage(undefined);
    setIsLoading(true);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/dashboard");

      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });

      if (!error) {
        return;
      }
    } catch {
      // Use the same message for provider and local configuration failures.
    }

    setErrorMessage("Não foi possível iniciar o login com Google.");
    setIsLoading(false);
  }

  return (
    <div className="space-y-3">
      <button
        className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-base font-bold text-slate-950 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onClick={signInWithGoogle}
        type="button"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-white p-1 shadow-sm">
          <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09A6.94 6.94 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l2.85-2.22.81-.63Z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
              fill="#EA4335"
            />
          </svg>
        </span>
        {isLoading ? "Redirecionando..." : "Entrar com Google"}
      </button>
      {errorMessage ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-red-400/20 bg-red-950/50 px-3 py-2 text-sm text-red-200"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
