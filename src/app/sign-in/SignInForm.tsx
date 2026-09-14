"use client";

import { useActionState, useState } from "react";
import { signIn, type ActionState } from "@/app/actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {});
  const [sent, setSent] = useState(false);

  return (
    <form className="signin" action={action}>
      <div className="brand"><b>MSM Studio</b><small>Marketing Strategy Review</small></div>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" className="input" type="email" placeholder="you@ekwa.com" defaultValue="dulmini@ekwa.com" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="code">6-digit code</label>
        <input id="code" name="code" className="input code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required onFocus={() => setSent(true)} />
        <span className="hint">{sent ? "Code sent to your inbox. In this demo any 6 digits work." : "We email you a code. No password to remember."}</span>
      </div>
      {state.error && <div className="error">{state.error}</div>}
      <button className="btn primary" type="submit" disabled={pending} style={{ justifyContent: "center" }}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
      <span className="note" style={{ textAlign: "center" }}>Only EKWA addresses on the allow-list can sign in.</span>
    </form>
  );
}
