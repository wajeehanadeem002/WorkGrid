"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  FolderKanban,
  Gauge,
  ListTodo,
  Settings,
  Users,
} from "lucide-react";
import { Logo } from "./logo";
import type { Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/ui/cn";

const navItems = [
  { segment: "dashboard", label: "Dashboard", icon: Gauge },
  { segment: "projects", label: "Projects", icon: FolderKanban },
  { segment: "tasks", label: "Tasks", icon: ListTodo },
  { segment: "members", label: "Members", icon: Users },
  { segment: "audit", label: "Activity", icon: Activity, privileged: true },
  { segment: "settings", label: "Settings", icon: Settings },
];

export function WorkspaceNavigation({
  organizationName,
  organizationSlug,
  role,
}: {
  organizationName: string;
  organizationSlug: string;
  role: Role;
}) {
  const pathname = usePathname();
  const items = navItems.filter(
    (item) => !item.privileged || role !== "member",
  );
  return (
    <>
      <aside className="sidebar">
        <Logo href="/app" />
        <Link
          href="/app/organizations"
          className="sidebar__org"
          aria-label={`Switch organization. Current organization: ${organizationName}`}
        >
          <span>Organization · switch</span>
          <strong>{organizationName}</strong>
        </Link>
        <nav className="sidebar__nav" aria-label="Workspace navigation">
          {items.map(({ segment, label, icon: Icon }) => {
            const href = `/app/${organizationSlug}/${segment}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                href={href}
                key={segment}
                className={cn(
                  "sidebar__link",
                  active && "sidebar__link--active",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <div>
            <div className="sidebar__role">{role}</div>
            <Link
              href="/app/account"
              className="sidebar__link"
              style={{ padding: 0 }}
            >
              Account
            </Link>
          </div>
          <UserButton />
        </div>
      </aside>
      <header className="mobile-header">
        <Logo href="/app" />
        <UserButton />
      </header>
      <nav className="mobile-nav" aria-label="Mobile workspace navigation">
        <Link href="/app/organizations">Organizations</Link>
        {items.map(({ segment, label }) => {
          const href = `/app/${organizationSlug}/${segment}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              href={href}
              key={segment}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
