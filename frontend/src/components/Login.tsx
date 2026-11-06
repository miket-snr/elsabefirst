import { useState } from "react";
import type { FormEvent } from "react";
import { api, TOKEN_KEY } from "../api";
import type { AuthResponse, User } from "../types";
import brandLogo from "../Screenshot 2026-03-06 134726.png";

type Stage = "identifier" | "otp" | "reset";

const MIN_PASSWORD_LENGTH = 8;

interface LoginProps {
  onSignedIn: (user: User) => void;
}

export default function Login({ onSignedIn }: LoginProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [temporaryToken, setTemporaryToken] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stage, setStage] = useState<Stage>("identifier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function completeSignIn(result: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, result.token);
    onSignedIn(result.user);
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function startOtpChallenge(nextStage: "otp" | "reset") {
    const result = await api.requestOtp(identifier);
    setTemporaryToken(result.temporary_token);
    setOtp("");
    setStage(nextStage);
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password) {
      void run(
        async () => completeSignIn(await api.loginWithPassword(identifier, password)),
        "Could not sign in",
      );
    } else {
      void run(() => startOtpChallenge("otp"), "Could not start sign-in");
    }
  }

  function forgotPassword() {
    if (identifier.trim().length < 3) {
      setError("Enter your email address or mobile number first.");
      return;
    }
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    void run(() => startOtpChallenge("reset"), "Could not start password reset");
  }

  function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      async () => completeSignIn(await api.verifyOtp(temporaryToken, otp)),
      "Could not verify OTP",
    );
  }

  function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    void run(
      async () => completeSignIn(await api.resetPassword(temporaryToken, otp, newPassword)),
      "Could not reset password",
    );
  }

  function backToSignIn() {
    setStage("identifier");
    setTemporaryToken("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  }

  const heading: Record<Stage, string> = {
    identifier: "Sign in to your account",
    otp: "Check your details",
    reset: "Reset your password",
  };
  const intro: Record<Stage, string> = {
    identifier:
      "Enter your email address or mobile number and your password. No password yet? Leave it blank and we’ll send you a one-time code.",
    otp: `We’ve sent a one-time code for ${identifier}. Enter it to continue.`,
    reset: `We’ve sent a one-time code for ${identifier}. Enter it along with your new password.`,
  };

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
            <h2 className="text-3xl font-semibold tracking-tight text-ink">{heading[stage]}</h2>
            <p className="mt-3 leading-6 text-muted">{intro[stage]}</p>
          </div>

          {stage === "identifier" && (
            <form className="space-y-5" onSubmit={signIn}>
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
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <label className="text-sm font-medium text-ink" htmlFor="login-password">
                    Password <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <button
                    className="text-sm font-medium text-brand hover:underline disabled:opacity-60"
                    disabled={busy}
                    onClick={forgotPassword}
                    type="button"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  autoComplete="current-password"
                  className="field"
                  id="login-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Leave blank to sign in with a one-time code"
                  type="password"
                  value={password}
                />
              </div>
              <button className="primary-button w-full" disabled={busy} type="submit">
                {busy ? "Please wait…" : password ? "Sign in" : "Send one-time code"}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}

          {stage === "otp" && (
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
                onClick={backToSignIn}
                type="button"
              >
                Use a different email or mobile
              </button>
            </form>
          )}

          {stage === "reset" && (
            <form className="space-y-5" onSubmit={resetPassword}>
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
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">New password</span>
                <input
                  autoComplete="new-password"
                  className="field"
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  required
                  type="password"
                  value={newPassword}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Confirm new password</span>
                <input
                  autoComplete="new-password"
                  className="field"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>
              <button className="primary-button w-full" disabled={busy} type="submit">
                {busy ? "Saving…" : "Reset password and sign in"}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
              <button
                className="w-full py-2 text-sm font-medium text-muted hover:text-ink"
                onClick={backToSignIn}
                type="button"
              >
                Back to sign in
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
            OTP <code className="rounded bg-white px-1.5 py-0.5 text-ink">Hellothere</code>. Use
            “Forgot password?” to set a password.
          </div>
        </div>
      </section>
    </main>
  );
}
