"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { LoginCard } from "@/components/login-card";
import { apiFetch } from "@/lib/api";
import { getStoredToken, useSessionToken } from "@/lib/auth";

type DashboardStats = {
  clients: number;
  devices: number;
  plans: number;
  sessions: number;
};

export default function HomePage() {
  const { token, ready, logout } = useSessionToken(false);
  const [authenticated, setAuthenticated] = useState<boolean>(() => Boolean(getStoredToken()));
  const [stats, setStats] = useState<DashboardStats>({
    clients: 0,
    devices: 0,
    plans: 0,
    sessions: 0,
  });

  useEffect(() => {
    setAuthenticated(Boolean(token));
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    Promise.all([
      apiFetch<unknown[]>("/clients", { token }),
      apiFetch<unknown[]>("/devices", { token }),
      apiFetch<unknown[]>("/plans", { token }),
      apiFetch<unknown[]>("/sessions", { token }),
    ]).then(([clients, devices, plans, sessions]) => {
      if (!active) {
        return;
      }
      setStats({
        clients: clients.length,
        devices: devices.length,
        plans: plans.length,
        sessions: sessions.length,
      });
    });

    return () => {
      active = false;
    };
  }, [token]);

  if (!ready) {
    return null;
  }

  if (!authenticated || !token) {
    return (
      <div className="login-screen">
        <div className="login-wrap">
          <section className="landing-copy">
            <span className="brand-kicker">Painel administrativo</span>
            <h1>Rede controlada, identidade auditavel, operacao simples.</h1>
            <p>
              Esta base junta MikroTik, FreeRADIUS e aplicacao propria para controlar
              acesso Wi-Fi, aplicar banda por plano e manter trilha de sessao.
            </p>
            <div className="feature-list">
              <div className="feature-item">Clientes e dispositivos com dados sensiveis mascarados.</div>
              <div className="feature-item">Planos refletidos em `radreply` para rate-limit do MikroTik.</div>
              <div className="feature-item">Accounting em `radacct` com leitura operacional no painel.</div>
            </div>
          </section>

          <LoginCard onSuccess={() => window.location.assign("/")} />
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      title="Resumo operacional"
      description="Visao rapida do estado administrativo da stack e atalhos para operacao diaria."
      onLogout={logout}
    >
      <section className="grid stats-grid">
        <div className="panel stat-card">
          <span className="chip">Clientes</span>
          <strong className="stat-value">{stats.clients}</strong>
          <span className="muted">cadastros com credencial Wi-Fi</span>
        </div>
        <div className="panel stat-card">
          <span className="chip">Dispositivos</span>
          <strong className="stat-value">{stats.devices}</strong>
          <span className="muted">MACs vinculados aos clientes</span>
        </div>
        <div className="panel stat-card">
          <span className="chip">Planos</span>
          <strong className="stat-value">{stats.plans}</strong>
          <span className="muted">perfis de banda e timeout</span>
        </div>
        <div className="panel stat-card">
          <span className="chip">Sessoes ativas</span>
          <strong className="stat-value">{stats.sessions}</strong>
          <span className="muted">registros vivos em accounting</span>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h3 className="section-title">Atalhos</h3>
        <p className="muted">
          A ordem operacional recomendada e: criar planos, cadastrar clientes, vincular
          dispositivos, registrar roteadores e validar autenticacao no RouterOS.
        </p>

        <div className="page-links">
          <Link className="page-link" href="/settings">
            Abrir configuracoes
          </Link>
          <Link className="page-link" href="/mikrotik">
            Gerar script MikroTik
          </Link>
          <Link className="page-link" href="/vouchers">
            Emitir vouchers
          </Link>
          <Link className="page-link" href="/online">
            Ver usuarios online
          </Link>
          <Link className="page-link" href="/plans">
            Abrir planos
          </Link>
          <Link className="page-link" href="/clients">
            Abrir clientes
          </Link>
          <Link className="page-link" href="/devices">
            Abrir dispositivos
          </Link>
          <Link className="page-link" href="/sessions">
            Ver sessoes
          </Link>
          <Link className="page-link" href="/auditoria">
            Ver auditoria
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
