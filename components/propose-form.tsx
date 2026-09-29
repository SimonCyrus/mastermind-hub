"use client";

import { useActionState } from "react";
import { proposeBottleneck, type FormState } from "@/app/(app)/actions";

export function ProposeForm({ templates, defaultTemplateId }: { templates: { id: string; name: string; category: string }[]; defaultTemplateId?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(proposeBottleneck, undefined);
  if (state?.ok) return <p className="form-ok">{state.ok}</p>;
  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Woran willst du als Nächstes arbeiten?</span>
        <select className="select" name="template_id" defaultValue={defaultTemplateId ?? ""}>
          <option value="">Eigenes Thema</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} · {t.category}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Eigener Titel (optional)</span>
        <input className="input" name="title" maxLength={120} placeholder="z. B. Ruhiger beim Preis bleiben" />
      </label>
      <label className="field">
        <span>Warum glaubst du, ist das gerade dein Engpass?</span>
        <textarea className="textarea" name="why" rows={3} maxLength={4000} placeholder="Was ist dir in deinen letzten Calls aufgefallen?" />
      </label>
      {state?.error && <p className="form-error">{state.error}</p>}
      <div><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sendet …" : "Vorschlag an Coach senden"}</button></div>
    </form>
  );
}
