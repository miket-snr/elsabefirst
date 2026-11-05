import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import type { User, UserFields } from "../types";

interface UserDialogProps {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyFields: UserFields = {
  username: "",
  firstnames: "",
  surname: "",
  email: "",
  cellno: "",
  validfrom: new Date().toISOString().slice(0, 10),
  validto: "",
};

export default function UserDialog({ user, onClose, onSaved }: UserDialogProps) {
  const [fields, setFields] = useState<UserFields>(user ?? emptyFields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function updateField(key: keyof UserFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (user) await api.updateUser(user.id, fields);
      else await api.createUser(fields);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save user");
    } finally {
      setBusy(false);
    }
  }

  const inputFields: Array<{
    key: keyof UserFields;
    label: string;
    type?: string;
    autoComplete?: string;
  }> = [
    { key: "username", label: "Username", autoComplete: "username" },
    { key: "firstnames", label: "First names", autoComplete: "given-name" },
    { key: "surname", label: "Surname", autoComplete: "family-name" },
    { key: "email", label: "Email address", type: "email", autoComplete: "email" },
    { key: "cellno", label: "Mobile number", type: "tel", autoComplete: "tel" },
    { key: "validfrom", label: "Valid from", type: "date" },
    { key: "validto", label: "Valid to", type: "date" },
  ];

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="user-dialog-title"
        aria-modal="true"
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">{user ? "USER DETAILS" : "NEW RECORD"}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink" id="user-dialog-title">{user ? "Edit user" : "Add a user"}</h2>
            <p className="mt-1 text-sm text-muted">Complete the user's profile and validity period.</p>
          </div>
          <button aria-label="Close dialog" className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink" onClick={onClose} type="button">
            <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
            {inputFields.map(({ key, label, type, autoComplete }) => (
              <label className="block" key={key}>
                <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
                <input
                  autoComplete={autoComplete}
                  className="field"
                  max={key === "validfrom" ? fields.validto || undefined : undefined}
                  min={key === "validto" ? fields.validfrom : undefined}
                  onChange={(event) => updateField(key, event.target.value)}
                  required
                  type={type ?? "text"}
                  value={fields[key]}
                />
              </label>
            ))}
          </div>
          {error && <p className="mx-6 mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8" role="alert">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 sm:px-8">
            <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : user ? "Save changes" : "Create user"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
