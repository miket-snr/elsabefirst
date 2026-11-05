import { useEffect, useState } from "react";
import { api, TOKEN_KEY } from "./api";
import type { User } from "./types";
import Login from "./components/Login";
import Workspace from "./components/Workspace";

type AuthState = "checking" | "signed-out" | "signed-in";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthState("signed-out");
      return () => {
        active = false;
      };
    }

    api
      .validateToken()
      .then((authenticatedUser) => {
        if (!active) return;
        setUser(authenticatedUser);
        setAuthState("signed-in");
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem(TOKEN_KEY);
        setAuthState("signed-out");
      });

    return () => {
      active = false;
    };
  }, []);

  function onSignedIn(authenticatedUser: User) {
    setUser(authenticatedUser);
    setAuthState("signed-in");
  }

  function onSignedOut() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setAuthState("signed-out");
  }

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-muted">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Checking your session…
        </div>
      </main>
    );
  }

  if (authState === "signed-out") {
    return <Login onSignedIn={onSignedIn} />;
  }

  return <Workspace user={user!} onSignedOut={onSignedOut} />;
}
