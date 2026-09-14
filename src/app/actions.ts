"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { encodeSession, findUser, getSession, SESSION_COOKIE } from "@/lib/auth";
import * as store from "@/lib/store";
import type { Finding, Intake, NotifyChannel, Vertical } from "@/lib/types";

export interface ActionState { error?: string }

/* ---------------- auth ---------------- */
export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const user = findUser(email);
  if (!user) return { error: "That email is not on the allow-list. Ask an admin to add you in Settings." };
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your email." };
  (await cookies()).set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8,
  });
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") ? next : "/reports");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in");
}

/* ---------------- reports ---------------- */
const VERTICALS: Vertical[] = ["Medical", "Dental", "Med spa", "Legal"];

export async function createReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const vertical = get("vertical") as Vertical;
  const intake: Intake = {
    name: get("name"), company: get("company"), cell: get("cell"), office: get("office"), email: get("email"),
    website: get("website"), address: get("address"), referral: get("referral"), vertical, comments: get("comments"),
  };
  if (!intake.company) return { error: "Firm or company name is required." };
  if (!intake.website) return { error: "Website is required." };
  if (!/^https?:\/\//i.test(intake.website)) intake.website = "https://" + intake.website.replace(/^\/+/, "");
  if (!intake.address) return { error: "Location address is required." };
  if (!VERTICALS.includes(vertical)) return { error: "Choose a vertical." };
  const ae = get("ae") || "Lila Stone";
  const notifyRaw = get("notify");
  const notify: NotifyChannel = notifyRaw === "Slack" || notifyRaw === "Email" ? notifyRaw : "Slack + Email";
  const r = store.createReport(intake, ae, notify);
  revalidatePath("/reports");
  redirect(`/reports/${r.id}`);
}

export async function approveKeywords(formData: FormData) {
  const id = String(formData.get("id"));
  const cities = formData.getAll("city").map(String);
  const keywords = formData.getAll("keyword").map(String).map((k) => k.trim()).filter(Boolean);
  store.approveKeywords(id, cities, Array.from(new Set(keywords)));
  revalidatePath("/reports");
  redirect(`/reports/${id}`);
}

export async function pickCompetitors(formData: FormData) {
  const id = String(formData.get("id"));
  const ids = formData.getAll("competitor").map(String);
  store.pickCompetitors(id, ids);
  revalidatePath("/reports");
  redirect(`/reports/${id}`);
}

export async function confirmListings(formData: FormData) {
  const id = String(formData.get("id"));
  const urls: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("url:")) urls[k.slice(4)] = String(v);
  const checked = formData.getAll("ai").map(String);
  store.confirmListings(id, urls, checked);
  revalidatePath("/reports");
  redirect(`/reports/${id}`);
}

export async function approveReport(formData: FormData) {
  const id = String(formData.get("id"));
  const session = await getSession();
  const bottomLine = String(formData.get("bottomLine") ?? "");
  const levels = formData.getAll("level").map(String) as Finding["level"][];
  const texts = formData.getAll("finding").map(String);
  const findings: Finding[] = texts.map((text, i) => ({ level: levels[i] ?? "watch", text }));
  store.approveReport(id, bottomLine, findings, session?.name ?? "Reviewer");
  revalidatePath("/reports");
  redirect(`/reports/${id}?approved=1`);
}

export async function sendBack(formData: FormData) {
  const id = String(formData.get("id"));
  store.sendBack(id);
  revalidatePath("/reports");
  redirect(`/reports/${id}/listings`);
}
