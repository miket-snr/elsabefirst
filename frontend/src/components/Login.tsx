import { useState } from "react";
import type { FormEvent } from "react";
import { api, TOKEN_KEY } from "../api";
import type { User } from "../types";
import brandLogo from "../Screenshot 2026-03-06 134726.png";

interface LoginProps {
  onSignedIn: (user: User) => void;
}

export default function Login({ onSignedIn }: LoginProps) {
  const [identifier, setIdentifier] = useState("");
  const [temporaryToken, setTemporaryToken] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"identifier" | "otp">("identifier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.requestOtp(identifier);
      setTemporaryToken(result.temporary_token);
      setStage("otp");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start sign-in");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.verifyOtp(temporaryToken, otp);
      localStorage.setItem(TOKEN_KEY, result.token);
      onSignedIn(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify OTP");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-brand-dark px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -bottom-48 -left-20 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="relative">
          <img alt="Mirjat Consultants" className="h-auto w-48 rounded-lg bg-white p-2" src={brandLogo} />
        </div>
        <div className="relative max-w-lg pb-12">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.22em] text-emerald-200">
            People, thoughtfully connected
          </p>
          <h1 className="text-5xl font-semibold leading-tight">
            Your people.
            <br />
            All in one place.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/70">
            A calm, simple workspace for the people who make your organization
            what it is.
          </p>
        </div>
        <p className="relative text-sm text-white/50">Secure access to your people workspace</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-12 lg:hidden">
            <img alt="Mirjat Consultants" className="h-auto w-48 object-contain" src={brandLogo} />
          </div>
          <div className="mb-9">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              Welcome back
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              {stage === "identifier" ? "Sign in to your account" : "Check your details"}
            </h2>
            <p className="mt-3 leading-6 text-muted">
              {stage === "identifier"
                ? "Enter the email address or mobile number associated with your account."
                : `We’ve created a sign-in challenge for ${identifier}. Enter your one-time code to continue.`}
            </p>
          </div>

          {stage === "identifier" ? (
            <form className="space-y-5" onSubmit={requestOtp}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Email or mobile number</span>
                <input
                  autoComplete="username"
                  className="field"
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@example.com or +1 555 010 1000"
                  required
                  value={identifier}
                />
              </label>
              <button className="primary-button w-full" disabled={busy} type="submit">
                {busy ? "Please wait…" : "Continue"}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={verifyOtp}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">One-time password</span>
                <input
                  autoComplete="one-time-code"
                  className="field"
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="Enter your OTP"
                  required
                  value={otp}
                />
              </label>
              <button className="primary-button w-full" disabled={busy} type="submit">
                {busy ? "Verifying…" : "Verify and sign in"}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
              <button
                className="w-full py-2 text-sm font-medium text-muted hover:text-ink"
                onClick={() => {
                  setStage("identifier");
                  setTemporaryToken("");
                  setOtp("");
                  setError("");
                }}
                type="button"
              >
                Use a different email or mobile
              </button>
            </form>
          )}

          {error && (
            <p className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="mt-8 rounded-xl bg-canvas px-4 py-3 text-sm leading-6 text-muted">
            <span className="font-semibold text-ink">Development access:</span>{" "}
            Demo account <code className="rounded bg-white px-1.5 py-0.5 text-ink">demo@example.com</code>,
            OTP <code className="rounded bg-white px-1.5 py-0.5 text-ink">Hellothere</code>.
          </div>
        </div>
      </section>
    </main>
  );
}
