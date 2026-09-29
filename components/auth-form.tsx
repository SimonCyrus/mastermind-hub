"use client";

import { useActionState } from "react";
import type { AuthState } from "@/app/(auth)/actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string };

export function AuthForm({
  action,
  fields,
  submit,
}: {
  action: (s: AuthState, fd: FormData) => Promise<AuthState>;
  fields: Field[];
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (state?.ok) return <p className="form-ok">{state.ok}</p>;
  return (
    <form action={formAction}>
      {fields.map((f) => (
        <label key={f.name} className="field">
          <span>{f.label}</span>
          <input className="input" name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} placeholder={f.placeholder} required />
        </label>
      ))}
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={pending} style={{ marginTop: 6 }}>
        {pending ? "Einen Moment …" : submit}
      </button>
    </form>
  );
}
