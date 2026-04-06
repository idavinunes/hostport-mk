"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type Plan = {
  id: string;
  name: string;
  download_kbps: number;
  upload_kbps: number;
  session_timeout_seconds?: number | null;
  idle_timeout_seconds?: number | null;
  active: boolean;
};

const initialForm = {
  name: "",
  download_kbps: 10240,
  upload_kbps: 10240,
  session_timeout_seconds: 28800,
  idle_timeout_seconds: 900,
  active: true,
};

export default function PlansPage() {
  const { token, ready, logout } = useSessionToken();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadData(activeToken: string) {
    setPlans(await apiFetch<Plan[]>("/plans", { token: activeToken }));
  }

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadData(token);
  }, [token]);

  if (!ready || !token) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const activeToken = token;
    if (!activeToken) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const body = {
            ...form,
            session_timeout_seconds: form.session_timeout_seconds || null,
            idle_timeout_seconds: form.idle_timeout_seconds || null,
          };

          if (editingId) {
            await apiFetch(`/plans/${editingId}`, {
              method: "PUT",
              token: activeToken,
              body,
            });
          } else {
            await apiFetch("/plans", {
              method: "POST",
              token: activeToken,
              body,
            });
          }
          await loadData(activeToken);
          setEditingId(null);
          setForm(initialForm);
          setMessage("Plano salvo com sucesso.");
        } catch (error) {
          setMessage(error instanceof ApiError ? error.message : "Falha ao salvar plano");
        }
      })();
    });
  }

  return (
    <DashboardShell
      title="Planos de acesso"
      description="Os valores desta tela alimentam automaticamente a view `radreply` consumida pelo FreeRADIUS."
      chip="Banda e timeout"
      onLogout={logout}
    >
      <section className="grid two-col">
        <section className="panel">
          <h3 className="section-title">{editingId ? "Editar plano" : "Novo plano"}</h3>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label>Nome do plano</label>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="field-inline">
              <div className="field">
                <label>Download (kbps)</label>
                <input
                  type="number"
                  value={form.download_kbps}
                  onChange={(event) => setForm({ ...form, download_kbps: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label>Upload (kbps)</label>
                <input
                  type="number"
                  value={form.upload_kbps}
                  onChange={(event) => setForm({ ...form, upload_kbps: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="field-inline">
              <div className="field">
                <label>Session timeout (s)</label>
                <input
                  type="number"
                  value={form.session_timeout_seconds}
                  onChange={(event) =>
                    setForm({ ...form, session_timeout_seconds: Number(event.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label>Idle timeout (s)</label>
                <input
                  type="number"
                  value={form.idle_timeout_seconds}
                  onChange={(event) =>
                    setForm({ ...form, idle_timeout_seconds: Number(event.target.value) })
                  }
                />
              </div>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              <span>Plano ativo</span>
            </label>

            {message ? <div className="muted">{message}</div> : null}

            <div className="button-row">
              <button className="button" type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : editingId ? "Atualizar plano" : "Criar plano"}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(initialForm);
                }}
              >
                Limpar
              </button>
            </div>
          </form>
        </section>

        <ResourceTable
          title="Perfis publicados"
          subtitle="A taxa e enviada ao MikroTik no formato `download/upload`."
          columns={["Plano", "Banda", "Timeout", "Status", "Acoes"]}
          rows={
            plans.length ? (
              <>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.name}</td>
                    <td>
                      {plan.download_kbps}/{plan.upload_kbps} kbps
                    </td>
                    <td>
                      {plan.session_timeout_seconds || "-"} / {plan.idle_timeout_seconds || "-"}
                    </td>
                    <td>
                      <span className="status-pill">{plan.active ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingId(plan.id);
                          setForm({
                            name: plan.name,
                            download_kbps: plan.download_kbps,
                            upload_kbps: plan.upload_kbps,
                            session_timeout_seconds: plan.session_timeout_seconds || 0,
                            idle_timeout_seconds: plan.idle_timeout_seconds || 0,
                            active: plan.active,
                          });
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhum plano cadastrado.
                </td>
              </tr>
            )
          }
        />
      </section>
    </DashboardShell>
  );
}
