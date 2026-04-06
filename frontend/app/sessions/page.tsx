"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type SessionRecord = {
  id: number;
  username?: string | null;
  client_name?: string | null;
  nas_identifier?: string | null;
  framed_ip_address?: string | null;
  acct_session_id: string;
  calling_station_id?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
};

export default function SessionsPage() {
  const { token, ready, logout } = useSessionToken();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiFetch<SessionRecord[]>("/sessions", { token }).then(setSessions);
  }, [token]);

  if (!ready || !token) {
    return null;
  }

  return (
    <DashboardShell
      title="Sessoes ativas"
      description="Leitura operacional da tabela `radacct` filtrada para sessoes ainda abertas."
      chip="Accounting RADIUS"
      onLogout={logout}
    >
      <ResourceTable
        title="Conexoes em andamento"
        subtitle="Se nao houver linhas, o accounting ativo ainda nao chegou ao banco."
        columns={["Usuario", "Cliente", "NAS", "IP", "MAC", "Inicio"]}
        rows={
          sessions.length ? (
            <>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <strong>{session.username || "-"}</strong>
                    <div className="muted">{session.acct_session_id}</div>
                  </td>
                  <td>{session.client_name || "-"}</td>
                  <td>{session.nas_identifier || "-"}</td>
                  <td>{session.framed_ip_address || "-"}</td>
                  <td>{session.calling_station_id || "-"}</td>
                  <td>{session.started_at ? new Date(session.started_at).toLocaleString("pt-BR") : "-"}</td>
                </tr>
              ))}
            </>
          ) : (
            <tr>
              <td colSpan={6} className="empty-state">
                Nenhuma sessao ativa encontrada.
              </td>
            </tr>
          )
        }
      />
    </DashboardShell>
  );
}

