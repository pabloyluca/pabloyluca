import "server-only";
import { HttpError } from "./errors";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { Role } from "./contracts";
import { staffRole } from "./domain";
import { isPublicCatalog, isVisualPreview, usesLocalData } from "./mode";

export interface Staff {
  id: string;
  role: Role;
}
const sessionCookie = "pl_local_session";
function equal(a: string, b: string) {
  const key = "pl/comparison";
  const digest = (s: string) => createHmac("sha256", key).update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
async function supabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(items) {
          try {
            for (const item of items)
              jar.set(item.name, item.value, item.options);
          } catch {
            /* Server components read cookies. The proxy refreshes them. */
          }
        },
      },
    },
  );
}
function localSecret() {
  const key = process.env.SANDBOX_SESSION_SECRET;
  if (!key || key.length < 32) throw Error("Ejecuta npm run sandbox:setup.");
  return key;
}
function sign(value: string) {
  return createHmac("sha256", localSecret()).update(value).digest("base64url");
}
export async function getStaff(): Promise<Staff | null> {
  if (isPublicCatalog()) return null;
  if (isVisualPreview() || usesLocalData()) {
    const raw = (await cookies()).get(sessionCookie)?.value;
    if (!raw) return null;
    const [role, expires, signature, ...extra] = raw.split(".");
    if (
      extra.length ||
      !["OWNER", "KITCHEN"].includes(role) ||
      !signature ||
      !Number.isFinite(Number(expires)) ||
      Number(expires) <= Date.now() ||
      !equal(sign(role + "." + expires), signature)
    )
      return null;
    return {
      id:
        role === "OWNER"
          ? "00000000-0000-4000-8000-000000000001"
          : "00000000-0000-4000-8000-000000000002",
      role: role as Role,
    };
  }
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const role = await staffRole(data.user.id);
  return role ? { id: data.user.id, role } : null;
}
export async function requirePageRole(roles: Role[]) {
  const staff = await getStaff();
  if (!staff)
    redirect("/login" + (roles.includes("KITCHEN") ? "?next=kitchen" : ""));
  if (!roles.includes(staff.role)) redirect("/kitchen");
  return staff;
}
export async function signIn(
  email: string,
  password: string,
): Promise<Staff | null> {
  if (!(isVisualPreview() || usesLocalData())) {
    const db = await supabase();
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) return null;
    const role = await staffRole(data.user.id);
    if (!role) {
      await db.auth.signOut({ scope: "local" });
      return null;
    }
    return { id: data.user.id, role };
  }
  for (const role of ["OWNER", "KITCHEN"] as const) {
    const target = process.env["SANDBOX_" + role + "_EMAIL"],
      secret = process.env["SANDBOX_" + role + "_PASSWORD"];
    if (
      target &&
      secret &&
      (!isVisualPreview() || secret.length >= 32) &&
      equal(email.toLowerCase(), target.toLowerCase()) &&
      equal(password, secret)
    ) {
      const value = role + "." + (Date.now() + 8 * 3600000);
      (await cookies()).set(sessionCookie, value + "." + sign(value), {
        httpOnly: true,
        sameSite: "lax",
        secure: !!process.env.VERCEL || process.env.APP_URL?.startsWith("https:"),
        path: "/",
        maxAge: 28800,
      });
      return getStaff();
    }
  }
  return null;
}
export async function logout() {
  if (isVisualPreview() || usesLocalData()) (await cookies()).delete(sessionCookie);
  else await (await supabase()).auth.signOut({ scope: "local" });
}
export async function realtimeToken() {
  return (
    (await (await supabase()).auth.getSession()).data.session?.access_token ??
    null
  );
}

export async function activateStaff(input: {password: string; invitation: string | null; access: string | null; refresh: string | null}) {
  const sb = await supabase();
  const session = input.invitation
    ? await sb.auth.verifyOtp({type:"invite", token_hash:input.invitation})
    : input.access && input.refresh
      ? await sb.auth.setSession({access_token:input.access,refresh_token:input.refresh})
      : null;
  if (!session || session.error) throw new HttpError(401,"La invitación venció o ya fue utilizada.");
  const {data,error} = await sb.auth.getUser();
  if (error || !data.user?.email_confirmed_at || !await staffRole(data.user.id)) {
    await sb.auth.signOut({scope:"local"});
    throw new HttpError(403,"Tu cuenta aún no tiene acceso al equipo.");
  }
  const saved = await sb.auth.updateUser({password:input.password});
  if (saved.error) throw new HttpError(400,"Supabase no aceptó la contraseña. Solicita una nueva invitación si el enlace venció.");
}
