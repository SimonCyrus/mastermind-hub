"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconTarget, IconPlus, IconChat, IconSettings, IconUsers, IconBook } from "./icons";

type Item = { href: string; label: string; short: string; icon: keyof typeof ICONS; exact?: boolean };

const ICONS = { home: IconHome, target: IconTarget, plus: IconPlus, chat: IconChat, settings: IconSettings, users: IconUsers, book: IconBook };

export const PARTICIPANT_NAV: Item[] = [
  { href: "/", label: "Übersicht", short: "Übersicht", icon: "home", exact: true },
  { href: "/engpass", label: "Trainingsplan", short: "Engpass", icon: "target" },
  { href: "/checkin", label: "Tages-Check-in", short: "Check-in", icon: "plus" },
  { href: "/reflexion", label: "Call-Reflexion", short: "Reflexion", icon: "chat" },
  { href: "/einstellungen", label: "Ziele & Profil", short: "Profil", icon: "settings" },
];

export const COACH_NAV: Item[] = [
  { href: "/coach", label: "Teilnehmer", short: "Teilnehmer", icon: "users", exact: true },
  { href: "/coach/bibliothek", label: "Engpass-Bibliothek", short: "Bibliothek", icon: "book" },
  { href: "/einstellungen", label: "Einstellungen", short: "Einstellungen", icon: "settings" },
];

function isActive(path: string, item: Item) {
  if (item.exact) return path === item.href || (item.href === "/coach" && path.startsWith("/coach/teilnehmer"));
  return path === item.href || path.startsWith(item.href + "/");
}

export function SideNav({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <Link key={item.href} href={item.href} className={isActive(path, item) ? "active" : undefined}>
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Navigation">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <Link key={item.href} href={item.href} className={isActive(path, item) ? "active" : undefined}>
            <Icon />
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}
