import type { AuthResponse, Note, NoteFields, User, UserFields } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
export const TOKEN_KEY = "testtoken";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token = localStorage.getItem(TOKEN_KEY),
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  validateToken: () => request<User>("/api/auth/userhandler"),
  requestOtp: (identifier: string) =>
    request<{ temporary_token: string; message: string }>(
      "/api/auth/request-otp",
      { method: "POST", body: JSON.stringify({ identifier }) },
      null,
    ),
  verifyOtp: (temporaryToken: string, otp: string) =>
    request<AuthResponse>(
      "/api/auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({ temporary_token: temporaryToken, otp }),
      },
      null,
    ),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  listUsers: () => request<User[]>("/api/users"),
  createUser: (fields: UserFields) =>
    request<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(fields),
    }),
  updateUser: (id: number, fields: UserFields) =>
    request<User>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(fields),
    }),
  listNotes: () => request<Note[]>("/api/notes"),
  createNote: (fields: NoteFields) =>
    request<Note>("/api/notes", {
      method: "POST",
      body: JSON.stringify(fields),
    }),
  updateNote: (id: number, fields: NoteFields) =>
    request<Note>(`/api/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(fields),
    }),
};
