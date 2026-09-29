"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(app)/actions";

export function ActionForm({
  action,
  children,
  submit,
  submitClass = "btn btn-primary",
  className = "stack",
  footer,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
  submitClass?: string;
  className?: string;
  footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <button className={submitClass} type="submit" disabled={pending}>{pending ? "Speichert …" : submit}</button>
        {state?.ok && !pending && <span className="small strong good">{state.ok}</span>}
        {footer}
      </div>
    </form>
  );
}

/** Button, der eine Server-Aktion ohne Formularfelder auslöst (mit Rückfrage) */
export function ActionButton({ action, label, className = "btn btn-soft btn-sm", confirm }: {
  action: () => Promise<FormState | void>;
  label: string;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(async () => (await action()) ?? undefined, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
    >
      <button className={className} type="submit" disabled={pending}>{pending ? "…" : label}</button>
      {state?.error && <span className="small warn">{state.error}</span>}
    </form>
  );
}
