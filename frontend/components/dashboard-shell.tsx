"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Resumo" },
  { href: "/settings", label: "Configuracoes" },
  { href: "/mikrotik", label: "MikroTik" },
  { href: "/vouchers", label: "Vouchers" },
  { href: "/online", label: "Online" },
  { href: "/clients", label: "Clientes" },
  { href: "/devices", label: "Dispositivos" },
  { href: "/plans", label: "Planos" },
  { href: "/routers", label: "Roteadores" },
  { href: "/sessions", label: "Sessoes" },
  { href: "/auditoria", label: "Auditoria" },
];

type DashboardShellProps = {
  title: string;
  description: string;
  chip?: string;
  onLogout: () => void;
  children: React.ReactNode;
};

export function DashboardShell({
  title,
  description,
  chip = "Operacao em tempo real",
  onLogout,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-kicker">MikroTik + RADIUS</span>
          <h1>Wi-Fi Portal</h1>
          <p>Operacao, auditoria e regras de acesso em um unico painel.</p>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              data-active={pathname === item.href}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <small className="muted">Sessao administrativa</small>
          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="ghost-button" onClick={onLogout} type="button">
              Encerrar sessao
            </button>
          </div>
        </div>
      </aside>

      <main className="content">
        <section className="hero">
          <div className="hero-top">
            <div>
              <div className="hero-kicker">{chip}</div>
              <h2>{title}</h2>
              <p className="muted">{description}</p>
            </div>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
