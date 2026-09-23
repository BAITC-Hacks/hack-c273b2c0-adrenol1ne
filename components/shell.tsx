"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  GitBranch,
  ChartNoAxesCombined,
  BookOpen,
  Rocket,
  UserRound,
  Users,
  SlidersHorizontal,
  Upload,
  ArrowLeftRight,
  Menu,
  LogOut,
  ShieldCheck,
  X,
  ChevronRight,
} from "lucide-react";
import { Brand } from "./shared";
import { Button } from "./ui/button";
const employeeNav = [
  { href: "/employee", name: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/career", name: "Career paths", icon: GitBranch },
  { href: "/employee/skills", name: "My skills", icon: ChartNoAxesCombined },
  { href: "/employee/activities", name: "Activities", icon: BookOpen },
  { href: "/missions", name: "Internal missions", icon: Rocket },
  { href: "/employee/profile", name: "My profile", icon: UserRound },
];
const hrNav = [
  { href: "/hr", name: "Overview", icon: LayoutDashboard },
  { href: "/hr/skills", name: "Skill intelligence", icon: ChartNoAxesCombined },
  { href: "/hr/employees", name: "Employees", icon: Users },
  { href: "/hr/activities", name: "Activities", icon: BookOpen },
  {
    href: "/hr/scenarios",
    name: "Workforce scenarios",
    icon: SlidersHorizontal,
  },
  { href: "/hr/import", name: "Import data", icon: Upload },
];
export function Shell({
  role,
  name,
  children,
}: {
  role: "EMPLOYEE" | "HR";
  name: string;
  children: React.ReactNode;
}) {
  const path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const nav = role === "HR" ? hrNav : employeeNav;
  const current = nav.find((n) => n.href === path)?.name ?? "Talent workspace";
  async function switchRole() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: role === "HR" ? "EMPLOYEE" : "HR" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(d.redirect);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch role");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open && (
        <button
          className="nav-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link
          href={role === "HR" ? "/hr" : "/employee"}
          aria-label="Halyk TalentOS home"
        >
          <Brand />
        </Link>
        <button
          className="mobile-close"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-label">
          {role === "HR" ? "PEOPLE & ORGANIZATION" : "YOUR GROWTH WORKSPACE"}
        </div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={path === n.href ? "nav-link active" : "nav-link"}
              aria-current={path === n.href ? "page" : undefined}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {n.name === "Internal missions" && (
                <span className="nav-new">NEW</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-card">
            <ShieldCheck size={22} />
            <strong>Your growth. Your data.</strong>
            <p>
              {role === "HR"
                ? "Organization insights, built on evidence."
                : "Your engagement history stays private."}
            </p>
          </div>
          <button onClick={switchRole} disabled={busy} className="switch-role">
            <ArrowLeftRight size={17} />
            {busy
              ? "Switching…"
              : `Switch to ${role === "HR" ? "Employee" : "HR"} demo`}
            <ChevronRight size={15} />
          </button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="sidebar-footer">
            <span className="mini-logo">H</span>
            <span>
              HackAlem AI <span className="muted">/ 2026</span>
            </span>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </Button>
            <span>{role === "HR" ? "HR control tower" : "Career Quest"}</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-tag">SYNTHETIC DEMO</span>
            <div className="avatar">
              {name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="top-user">
              <strong>{name}</strong>
              <span>{role === "HR" ? "People & Culture" : "Employee"}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await fetch("/api/logout", { method: "POST" });
                router.push("/");
                router.refresh();
              }}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            Halyk TalentOS{" "}
            <span className="muted">· Built around your potential</span>
          </span>
          <span>
            <ShieldCheck size={13} /> Evidence-based. Privacy by design.
          </span>
        </footer>
      </div>
    </div>
  );
}
