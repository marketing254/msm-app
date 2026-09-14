import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { NavLinks } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><b>MSM Studio</b><small>Marketing Strategy Review</small></div>
        <NavLinks />
        <div className="user">
          Signed in as
          <b>{session.name}</b>
          {session.role}
          <form action={signOut}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
