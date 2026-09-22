import { cookies } from "next/headers";
import { has } from "./env";

export const SESSION_COOKIE = "msm_session";

export type Role = "Admin" | "Reviewer" | "AE" | "Viewer";

export interface Session { name: string; email: string; role: Role }

export const ROLE_DESCRIPTION: Record<Role, string> = {
  Admin: "Manage users and connections",
  Reviewer: "Generate, review and approve reports",
  AE: "Generate when the reviewer is unavailable, receive and approve report links",
  Viewer: "Open and search all reports, read only",
};

/** Built-in allow-list, used when the MSM Database sheet is not connected. */
export const ALLOWED_USERS: (Session & { team: string })[] = [
  { name: "Dulmini Dodawatte", email: "dulmini@ekwa.com", role: "Reviewer", team: "Sales" },
  { name: "Lila Stone", email: "lila@ekwa.com", role: "AE", team: "Sales" },
  { name: "Chamika", email: "chamika@ekwa.com", role: "Viewer", team: "Oversight" },
];

export const AE_LIST = ALLOWED_USERS.filter((u) => u.role === "AE" || u.role === "Reviewer").map((u) => u.name);

/** Current allow-list: the Users tab of the MSM Database sheet when connected, otherwise the built-in list. */
export async function allowedUsers(): Promise<{ users: (Session & { team: string })[]; source: "sheet" | "built-in" }> {
  if (has.database()) {
    try {
      const { readUsers } = await import("./google");
      const users = (await readUsers()).filter((u) => u.active);
      if (users.length) return { users, source: "sheet" };
    } catch { /* fall back */ }
  }
  return { users: ALLOWED_USERS, source: "built-in" };
}

export async function findUser(email: string): Promise<Session | undefined> {
  const e = email.trim().toLowerCase();
  const { users } = await allowedUsers();
  const known = users.find((u) => u.email === e);
  if (known) return { name: known.name, email: known.email, role: known.role };
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
