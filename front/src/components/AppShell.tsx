import { Link } from "@tanstack/react-router";
import {
  Bell,
  Boxes,
  ClipboardList,
  GitBranch,
  LayoutDashboard,
  Menu,
  PanelsTopLeft,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { products } from "../mockData";
import { useUiStore } from "../store";
import type { HealthStatus, NavItem } from "../types";
import { Badge } from "./Primitives";

interface ShellNavItem extends NavItem {
  icon: LucideIcon;
}

const navItems: ShellNavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Products", to: "/products", icon: Boxes },
  { label: "Projects", to: "/projects", icon: PanelsTopLeft },
  { label: "Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Architecture", to: "/architecture", icon: GitBranch },
  { label: "Agent Runs", to: "/agent-runs", icon: Sparkles },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const detailRailOpen = useUiStore((state) => state.detailRailOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleDetailRail = useUiStore((state) => state.toggleDetailRail);
  const primaryProduct = products[0];
  const productName = primaryProduct?.name ?? "No product";
  const productStatus: HealthStatus = primaryProduct?.status ?? "Watch";

  return (
    <div className={`app-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <span>Tomodachi</span>
        </div>
        <nav aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="nav-link"
                activeProps={{ className: "nav-link is-active" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="shell-body">
        <header className="topbar">
          <button className="icon-button" type="button" onClick={toggleSidebar}>
            <Menu size={18} />
          </button>
          <div className="product-switcher">
            <span>{productName}</span>
            <Badge tone="warning">{productStatus}</Badge>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input placeholder="Search tasks, artifacts, agent runs" />
          </label>
          <div className="topbar-actions">
            <Badge tone="success">Sync 12m ago</Badge>
            <button className="icon-button" type="button">
              <Bell size={18} />
            </button>
            <button className="icon-button" type="button" onClick={toggleDetailRail}>
              <PanelsTopLeft size={18} />
            </button>
          </div>
        </header>

        <div className={`content-grid ${detailRailOpen ? "" : "rail-hidden"}`}>
          <main>{children}</main>
          {detailRailOpen && (
            <aside className="detail-rail">
              <span className="eyebrow">Review queue</span>
              <h2>Agent review required</h2>
              <p>
                Runs with unresolved evidence appear here after backend import.
              </p>
              <div className="rail-card">
                <strong>run_review_01</strong>
                <span>2 unresolved items on TMD-102</span>
              </div>
              <div className="rail-card">
                <strong>Stale architecture warning</strong>
                <span>RFC-004 has not been refreshed in 5 days.</span>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
