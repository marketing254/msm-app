import { cookies } from "next/headers";

export const SESSION_COOKIE = "msm_session";

export type Role = "Admin" | "Reviewer" | "AE" | "Viewer";

export interface Session { name: string; email: string; role: Role }

export const ROLE_DESCRIPTION: Record<Role, string> = {
  Admin: "Manage users and connections",
  Reviewer: "Generate, review and approve reports",
  AE: "Generate when the reviewer is unavailable, receive and approve report links",
  Viewer: "Open and search all reports, read only",
};

/** Allow-list. Later this becomes the admin_users table in Supabase. */
export const ALLOWED_USERS: (Session & { team: string })[] = [
  { name: "Dulmini Dodawatte", email: "dulmini@ekwa.com", role: "Reviewer", team: "Sales" },
  { name: "Lila Stone", email: "lila@ekwa.com", role: "AE", team: "Sales" },
  { name: "Chamika", email: "chamika@ekwa.com", role: "Viewer", team: "Oversight" },
  { name: "Naren", email: "naren@ekwa.com", role: "Admin", team: "Operations" },
];

export const AE_LIST = ALLOWED_USERS.filter((u) => u.role === "AE" || u.role === "Reviewer").map((u) => u.name);

export function findUser(email: string): Session | undefined {
  const e = email.trim().toLowerCase();
  const known = ALLOWED_USERS.find((u) => u.email === e);
  if (known) return { name: known.name, email: known.email, role: known.role };
  // Demo convenience: any @ekwa.com address signs in as a viewer.
  if (e.endsWith("@ekwa.com")) {
    const local = e.split("@")[0];
    return { name: local.charAt(0).toUpperCase() + local.slice(1), email: e, role: "Viewer" };
  }
  return undefined;
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Session;
    return s && s.email ? s : null;
  } catch { return null; }
}

export function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
}
