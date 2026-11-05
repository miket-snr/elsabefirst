import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api";
import type { User } from "../types";
import brandLogo from "../Screenshot 2026-03-06 134726.png";
import NotesPage from "./NotesPage";
import UserDialog from "./UserDialog";

type Page = "home" | "users" | "notes";

interface WorkspaceProps {
  user: User;
  onSignedOut: () => void;
}

export default function Workspace({ user, onSignedOut }: WorkspaceProps) {
  const [page, setPage] = useState<Page>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [dialogUser, setDialogUser] = useState<User | null | undefined>();
  const [logoutError, setLogoutError] = useState("");

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      setUsers(await api.listUsers());
    } catch (reason) {
      setUsersError(reason instanceof Error ? reason.message : "Could not load users");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (page === "users") void loadUsers();
  }, [page, loadUsers]);

  async function logout() {
    try {
      await api.logout();
    } catch (reason) {
      setLogoutError(reason instanceof Error ? reason.message : "Could not sign out");
      return;
    }
    onSignedOut();
  }

  async function saveUser() {
    setDialogUser(undefined);
    await loadUsers();
  }

  const initials = `${user.firstnames.charAt(0)}${user.surname.charAt(0)}`.toUpperCase();

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside
        className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <div className={`flex h-[76px] items-center border-b border-slate-100 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          <img
            alt="Mirjat Consultants"
            className={collapsed ? "h-auto w-12 object-contain" : "h-auto w-44 object-contain"}
            src={brandLogo}
          />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6" aria-label="Main navigation">
          <NavButton
            active={page === "home"}
            collapsed={collapsed}
            label="Overview"
            onClick={() => setPage("home")}
            icon={<HomeIcon />}
          />
          <NavButton
            active={page === "users"}
            collapsed={collapsed}
            label="Users"
            onClick={() => setPage("users")}
            icon={<PeopleIcon />}
          />
          <NavButton
            active={page === "notes"}
            collapsed={collapsed}
            label="Notes"
            onClick={() => setPage("notes")}
            icon={<NotesIcon />}
          />
        </nav>
        <div className={`border-t border-slate-100 py-4 ${collapsed ? "px-2" : "px-3"}`}>
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted hover:bg-canvas hover:text-ink"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={collapsed} />
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted">People workspace</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {page === "home" ? "Overview" : page === "users" ? "User directory" : "Notes"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink">{user.firstnames} {user.surname}</p>
              <p className="text-xs text-muted">{user.email}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-brand">
              {initials}
            </span>
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-slate-50 hover:text-ink" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">
          {logoutError && (
            <p className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {logoutError}
            </p>
          )}
          {page === "home" ? (
            <section className="mx-auto max-w-5xl">
              <div className="rounded-2xl bg-brand p-7 text-white shadow-card sm:p-10">
                <p className="text-sm font-medium text-emerald-100">YOUR PEOPLE WORKSPACE</p>
                <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Good to see you, {user.firstnames}.</h1>
                <p className="mt-3 max-w-xl leading-7 text-white/75">
                  Keep your team details organized and up to date. Visit the user directory to manage the people in your workspace.
                </p>
                <button
                  className="mt-7 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-emerald-50"
                  onClick={() => setPage("users")}
                >
                  Go to user directory <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                  <p className="text-sm text-muted">Signed in as</p>
                  <p className="mt-2 text-lg font-semibold">{user.firstnames} {user.surname}</p>
                  <p className="mt-1 text-sm text-muted">{user.email}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                  <p className="text-sm text-muted">Quick start</p>
                  <p className="mt-2 text-lg font-semibold">Manage your users</p>
                  <p className="mt-1 text-sm leading-6 text-muted">Add a new person or double-click a record to update their details.</p>
                </div>
              </div>
            </section>
          ) : page === "users" ? (
            <section className="mx-auto max-w-6xl">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-brand">DIRECTORY</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
                  <p className="mt-1 text-sm text-muted">Manage the people who have access to your workspace.</p>
                </div>
                <button className="primary-button" onClick={() => setDialogUser(null)}>
                  <span aria-hidden="true" className="text-lg leading-none">+</span> Add user
                </button>
              </div>

              {usersError && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {usersError}
                  <button className="font-semibold underline" onClick={() => void loadUsers()}>Try again</button>
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <p className="text-sm font-semibold">{users.length} {users.length === 1 ? "person" : "people"}</p>
                  <p className="hidden text-xs text-muted sm:block">Double-click a row to edit</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Username</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Mobile</th>
                        <th className="px-5 py-3">Valid period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersLoading ? (
                        <tr><td className="px-5 py-12 text-center text-muted" colSpan={5}>Loading users…</td></tr>
                      ) : users.length === 0 ? (
                        <tr><td className="px-5 py-12 text-center text-muted" colSpan={5}>No users yet. Add your first user to get started.</td></tr>
                      ) : users.map((person) => (
                        <tr
                          className="cursor-pointer transition hover:bg-emerald-50/50"
                          key={person.id}
                          onDoubleClick={() => setDialogUser(person)}
                          title="Double-click to edit"
                        >
                          <td className="px-5 py-4">
                            <span className="font-medium">{person.firstnames} {person.surname}</span>
                          </td>
                          <td className="px-5 py-4 text-muted">{person.username}</td>
                          <td className="px-5 py-4 text-muted">{person.email}</td>
                          <td className="px-5 py-4 text-muted">{person.cellno}</td>
                          <td className="px-5 py-4 text-xs text-muted">{person.validfrom} – {person.validto}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : (
            <NotesPage />
          )}
        </main>
      </div>

      {dialogUser !== undefined && (
        <UserDialog
          user={dialogUser}
          onClose={() => setDialogUser(undefined)}
          onSaved={() => void saveUser()}
        />
      )}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  collapsed: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

function NavButton({ active, collapsed, label, icon, onClick }: NavButtonProps) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center rounded-xl py-3 text-sm font-medium transition ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } ${active ? "bg-emerald-50 text-brand" : "text-muted hover:bg-slate-50 hover:text-ink"}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && label}
    </button>
  );
}

function HomeIcon() {
  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="m3.5 10 8.5-7 8.5 7v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V10Z" /><path d="M9 21v-7h6v7" /></svg>;
}

function PeopleIcon() {
  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20h-13Zm14-15.5a3.5 3.5 0 0 1 0 7m2 2.5a5 5 0 0 1 3 4.5V20h-2" /></svg>;
}

function NotesIcon() {
  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M7 3.75h7.5L19 8.25v12A1.75 1.75 0 0 1 17.25 22h-10A1.75 1.75 0 0 1 5.5 20.25v-14A2.5 2.5 0 0 1 8 3.75Z" /><path d="M14 4v5h5m-10 4h6m-6 4h6" /></svg>;
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return <svg aria-hidden="true" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m14 5-7 7 7 7" /></svg>;
}
