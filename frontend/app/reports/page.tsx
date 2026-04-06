"use client";

import { FormEvent, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type ReportRow = {
  id: number;
  username?: string | null;
  client_name?: string | null;
  cpf_masked?: string | null;
  nas_identifier?: string | null;
  nas_ip_address?: string | null;
  framed_ip_address?: string | null;
  acct_session_id: string;
  calling_station_id?: string | null;
  called_station_id?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  ended_at?: string | null;
  session_time_seconds?: number | null;
  input_octets?: number | null;
  output_octets?: number | null;
  terminate_cause?: string | null;
};

const now = new Date();
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { token, ready, logout } = useSessionToken();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    started_from: formatDateInput(sevenDaysAgo),
    started_to: formatDateInput(now),
    mac: "",
    cpf: "",
    ip: "",
    nas: "",
    limit: "500",
  });

  if (!ready || !token) {
    return null;
  }

  function buildParams() {
    const params = new URLSearchParams();
    if (form.started_from) {
      params.set("started_from", `${form.started_from}T00:00:00Z`);
    }
    if (form.started_to) {
      params.set("started_to", `${form.started_to}T23:59:59Z`);
    }
    if (form.mac.trim()) {
      params.set("mac", form.mac.trim());
    }
    if (form.cpf.trim()) {
      params.set("cpf", form.cpf.trim());
    }
    if (form.ip.trim()) {
      params.set("ip", form.ip.trim());
    }
    if (form.nas.trim()) {
      params.set("nas", form.nas.trim());
    }
    if (form.limit.trim()) {
      params.set("limit", form.limit.trim());
    }
    return params;
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(() => {
      void (async () => {
        try {
          const params = buildParams();
          const result = await apiFetch<ReportRow[]>(`/reports/marco-civil?${params.toString()}`, {
            token,
          });
          setRows(result);
          setMessage(
            result.length
              ? `${result.length} registro(s) localizados para o relatorio.`
              : "Nenhum registro encontrado com os filtros informados.",
          );
        } catch (error) {
          setRows([]);
          setMessage(error instanceof ApiError ? error.message : "Falha ao consultar relatorio");
        }
      })();
    });
  }

  async function exportCsv() {
    setMessage("");
    try {
      const params = buildParams();
      const response = await fetch(`/api/reports/marco-civil/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        let detail = "Falha ao exportar CSV";
        try {
          const payload = (await response.json()) as { detail?: string };
          if (payload.detail) {
            detail = payload.detail;
          }
        } catch {}
        throw new Error(detail);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const fileNameMatch = disposition?.match(/filename="([^"]+)"/);
      anchor.href = downloadUrl;
      anchor.download = fileNameMatch?.[1] || "marco_civil.csv";
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      setMessage("CSV exportado com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao exportar CSV");
    }
  }

  return (
    <DashboardShell
      title="Relatorios"
      description="Consulta historica de sessoes e exportacao CSV para atendimento operacional e eventual requisicao de autoridade."
      chip="Marco Civil"
      onLogout={logout}
    >
      <section className="grid two-col">
        <section className="panel">
          <h3 className="section-title">Relatorio de sessoes</h3>
          <form className="form-grid" onSubmit={handleSearch}>
            <div className="field-inline">
              <div className="field">
                <label>Periodo inicial</label>
                <input
                  type="date"
                  value={form.started_from}
                  onChange={(event) => setForm({ ...form, started_from: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Periodo final</label>
                <input
                  type="date"
                  value={form.started_to}
                  onChange={(event) => setForm({ ...form, started_to: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>MAC do cliente</label>
                <input
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={form.mac}
                  onChange={(event) => setForm({ ...form, mac: event.target.value })}
                />
              </div>
              <div className="field">
                <label>CPF</label>
                <input
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(event) => setForm({ ...form, cpf: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>IP</label>
                <input
                  placeholder="IP do cliente ou NAS"
                  value={form.ip}
                  onChange={(event) => setForm({ ...form, ip: event.target.value })}
                />
              </div>
              <div className="field">
                <label>NAS</label>
                <input
                  placeholder="NAS-Identifier ou IP do NAS"
                  value={form.nas}
                  onChange={(event) => setForm({ ...form, nas: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Limite</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={form.limit}
                  onChange={(event) => setForm({ ...form, limit: event.target.value })}
                />
              </div>
            </div>

            <p className="muted">
              Este relatorio usa os registros de `radacct` e nao inclui conteudo de navegacao.
            </p>

            {message ? <div className="muted">{message}</div> : null}

            <div className="button-row">
              <button className="button" type="submit" disabled={isPending}>
                {isPending ? "Consultando..." : "Buscar registros"}
              </button>
              <button className="ghost-button" type="button" onClick={() => void exportCsv()}>
                Exportar CSV
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h3 className="section-title">Escopo do relatorio</h3>
          <div className="feature-list">
            <div className="feature-item">Periodo da sessao</div>
            <div className="feature-item">Usuario, cliente e CPF mascarado</div>
            <div className="feature-item">IP do cliente, NAS e MAC</div>
            <div className="feature-item">Session ID, bytes e causa de encerramento</div>
            <div className="feature-item">Exportacao CSV auditada em `audit_logs`</div>
          </div>
        </section>
      </section>

      <ResourceTable
        title="Resultado do relatorio"
        subtitle="Foco em rastreabilidade de conexao para operacao e atendimento inicial de requisicoes."
        columns={["Inicio", "Fim", "Usuario", "Cliente", "CPF", "IP", "MAC", "NAS", "Sessao"]}
        rows={
          rows.length ? (
            <>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.started_at ? new Date(row.started_at).toLocaleString("pt-BR") : "-"}</td>
                  <td>{row.ended_at ? new Date(row.ended_at).toLocaleString("pt-BR") : "-"}</td>
                  <td>{row.username || "-"}</td>
                  <td>{row.client_name || "-"}</td>
                  <td>{row.cpf_masked || "-"}</td>
                  <td>{row.framed_ip_address || row.nas_ip_address || "-"}</td>
                  <td>{row.calling_station_id || "-"}</td>
                  <td>{row.nas_identifier || row.nas_ip_address || "-"}</td>
                  <td>
                    <strong>{row.acct_session_id}</strong>
                    <div className="muted">
                      up {row.input_octets ?? 0} / down {row.output_octets ?? 0}
                    </div>
                  </td>
                </tr>
              ))}
            </>
          ) : (
            <tr>
              <td colSpan={9} className="empty-state">
                Nenhum registro carregado.
              </td>
            </tr>
          )
        }
      />
    </DashboardShell>
  );
}
