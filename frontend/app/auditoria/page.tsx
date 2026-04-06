"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type AuditRecord = {
  id: string;
  actor_user: string;
  action: string;
  entity_name: string;
  entity_id: string;
  created_at: string;
};

export default function AuditingPage() {
  const { token, ready, logout } = useSessionToken();
  const [logs, setLogs] = useState<AuditRecord[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiFetch<AuditRecord[]>("/audit-logs", { token }).then(setLogs);
  }, [token]);

  if (!ready || !token) {
    return null;
  }

  return (
    <DashboardShell
      title="Auditoria administrativa"
      description="Cada alteracao administrativa cria rastro com ator, entidade e timestamp."
      chip="Trilha de mudancas"
      onLogout={logout}
    >
      <ResourceTable
        title="Ultimos eventos"
        subtitle="Em producao, este feed ajuda a investigar alteracoes operacionais."
        columns={["Quando", "Usuario", "Acao", "Entidade", "Referencia"]}
        rows={
          logs.length ? (
            <>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                  <td>{log.actor_user}</td>
                  <td>{log.action}</td>
                  <td>{log.entity_name}</td>
                  <td>{log.entity_id}</td>
                </tr>
              ))}
            </>
          ) : (
            <tr>
              <td colSpan={5} className="empty-state">
                Nenhum log de auditoria encontrado.
              </td>
            </tr>
          )
        }
      />
    </DashboardShell>
  );
}
