"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/(app)/actions";

export type CommentView = { id: string; author: string; mine: boolean; when: string; body: string };

export function CommentThread({ comments, action, placeholder }: {
  comments: CommentView[];
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      {comments.length === 0 && <span className="sub">Noch kein Austausch. Fragen, Erkenntnisse, Aufnahmen: alles, was zu diesem Engpass gehört, kommt hierhin.</span>}
      {comments.map((c) => (
        <div key={c.id} className="stack sm" style={{ alignItems: c.mine ? "flex-end" : "flex-start" }}>
          <span className="small muted"><b style={{ color: "var(--text)" }}>{c.author}</b> · {c.when}</span>
          <p className={`bubble${c.mine ? " mine" : ""}`} style={{ maxWidth: "92%" }}>{c.body}</p>
        </div>
      ))}
      <form ref={formRef} action={formAction} className="stack sm">
        <label className="field">
          <span>Antworten</span>
          <textarea className="textarea" name="body" rows={2} placeholder={placeholder} maxLength={4000} required />
        </label>
        {state?.error && <p className="form-error">{state.error}</p>}
        <div><button className="btn btn-dark btn-sm" type="submit" disabled={pending}>{pending ? "Sendet …" : "Senden"}</button></div>
      </form>
    </div>
  );
}
