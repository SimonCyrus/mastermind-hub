import { requireUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { SideNav, TabBar, PARTICIPANT_NAV, COACH_NAV } from "@/components/nav";
import { initials } from "@/lib/format";
import { signOut } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const isCoach = profile.role === "coach";
  const items = isCoach ? COACH_NAV : PARTICIPANT_NAV;
  return (
    <div className="shell">
      <aside className={`sidebar${isCoach ? " dark" : ""}`}>
        <Brand />
        <SideNav items={items} />
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className={`avatar sm${isCoach ? "" : " ink"}`}>{initials(profile.full_name)}</span>
            <div className="meta">
              <span>{profile.full_name || "Ohne Namen"}</span>
              <span>{isCoach ? "Coach" : "Teilnehmer"}</span>
            </div>
          </div>
          <form action={signOut}>
            <button className="linkbtn" type="submit">Abmelden</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
      <TabBar items={items} />
    </div>
  );
}
