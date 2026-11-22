import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { Icon, type IconName } from "./icons";
import { Landscape, Logo } from "./art";
import { ThemeToggle } from "./ui";
import { usePrefs } from "../prefs";
import { usePoll, useStored } from "../hooks";
import { get } from "../api";

const NAV: { group: string; items: { to: string; end?: boolean; label: string; icon: IconName; title: string }[] }[] = [
  { group: "Workspace", items: [
    { to: "/app", end: true, label: "Overview", icon: "home", title: "Overview" }, { to: "/app/scanner", label: "Fruit Scanner", icon: "scan", title: "Fruit Scanner" },
    { to: "/app/lab", label: "Image Lab", icon: "flask", title: "Image Lab" }, { to: "/app/history", label: "Scan History", icon: "clock", title: "Scan History" }, { to: "/app/analytics", label: "Analytics", icon: "chart", title: "Analytics" } ] },
  { group: "Information", items: [
    { to: "/app/library", label: "Fruit Library", icon: "leaf", title: "Fruit Library" }, { to: "/app/model", label: "About Model", icon: "cpu", title: "About Model" }, { to: "/app/settings", label: "Settings", icon: "sliders", title: "Settings" } ] },
];

export default function Shell() {
  const { pathname } = useLocation(); const { theme, toggleTheme } = usePrefs();
  const [collapsed, setCollapsed] = useStored<boolean>("fv-sb", false); const [open, setOpen] = useState(false);
  const health = usePoll(() => get("/api/health"), 8000); const act = usePoll(() => get<{ active: any }>("/api/models/active"), 15000);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [open]);
  const title = NAV.flatMap(g => g.items).find(i => (i.end ? pathname === i.to || pathname === i.to + "/" : pathname.startsWith(i.to)))?.title ?? "FruitVision";
  const online = !!health.data && !health.error; const hasModel = !!act.data?.active;

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""} ${open ? "drawer-open" : ""}`}>
      <a href="#main" className="skip">Lewati ke konten</a>
      {open && <div className="drawer-veil" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar ${collapsed ? "tip-on" : ""}`} aria-label="Sidebar">
        <Link to="/" className="brand-row" aria-label="FruitVision, ke halaman utama"><Logo size={32} /><span className="brand-name">FruitVision</span></Link>
        <nav aria-label="Navigasi utama" style={{ display: "contents" }}>
          {NAV.map(g => (
            <div key={g.group} style={{ display: "contents" }}>
              <div className="nav-group"><span>{g.group}</span></div>
              {g.items.map(i => <NavLink key={i.to} to={i.to} end={i.end} className="nav-item" data-tip={i.label} aria-label={i.label}><Icon name={i.icon} /><span className="lbl">{i.label}</span></NavLink>)}
            </div>
          ))}
        </nav>
        <div className="spacer" />
        <button className="nav-item collapse-btn" style={{ background: "transparent", border: 0, cursor: "pointer", width: "100%" }} onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? "Perluas sidebar" : "Perkecil sidebar"} data-tip={collapsed ? "Perluas" : "Perkecil"}>
          <Icon name={collapsed ? "chevR" : "chevL"} /><span className="lbl">Perkecil sidebar</span>
        </button>
      </aside>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="topbar">
          <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="Buka menu navigasi" aria-expanded={open}><Icon name="menu" /></button>
          <h1>{title}</h1><div style={{ flex: 1 }} />
          <span className="badge neutral" title={online ? "Backend terhubung" : "Backend tidak terhubung"}><Icon name={online ? "wifi" : "slash"} size={14} /><span className="hidden sm:inline">{online ? "Backend online" : "Backend offline"}</span><span className="sr-only sm:hidden">{online ? "online" : "offline"}</span></span>
          <Link to="/app/settings" className={`badge ${hasModel ? "info" : "warn"} hidden md:inline-flex`} style={{ textDecoration: "none" }}><Icon name="cpu" size={14} />{hasModel ? "Model aktif" : "Belum ada model aktif"}</Link>
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
        <main id="main" className="main" tabIndex={-1}><div key={pathname} className="page-in"><Outlet /></div></main>
        <footer style={{ position: "relative", height: "clamp(130px, 17vw, 200px)", marginTop: "2.5rem" }} className="orchard-sky"><Landscape height="100%" seed={21} /></footer>
      </div>
    </div>
  );
}
