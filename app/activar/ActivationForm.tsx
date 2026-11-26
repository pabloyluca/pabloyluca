"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
export function ActivationForm() {
  const [invite, setInvite] = useState<URLSearchParams | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (window.location.hash) {
      setInvite(new URLSearchParams(window.location.hash.slice(1)));
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !invite) return;
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirm")) { setError("Las contraseñas deben coincidir."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/activar", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        access: invite.get("access_token"), refresh: invite.get("refresh_token"),
        invitation: invite.get("token_hash"), password: form.get("password")
      })});
      if (!res.ok) throw new Error((await res.json()).error);
      location.replace("/admin");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo activar el acceso."); setBusy(false); }
  }
  return <>
    {invite && (invite.has("token_hash") || invite.has("access_token")) ? <form onSubmit={activate}>
      <p>Elige la contraseña que usarás para entrar al CMS.</p>
      <label>Nueva contraseña (mínimo 12 caracteres)<input required name="password" type="password" minLength={12} maxLength={72} autoComplete="new-password" /></label>
      <label>Confirmar contraseña<input required name="confirm" type="password" autoComplete="new-password" /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Activando…" : "Activar y entrar"}</button>
    </form> : <p>Abre la invitación que recibiste por correo para elegir tu contraseña.</p>}
    <Link href="/login">Ir al inicio de sesión</Link>
  </>;
}
