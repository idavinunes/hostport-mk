"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type Plan = {
  id: string;
  name: string;
};

type AppSettings = {
  default_terms_version: string;
  default_privacy_version: string;
};

type Client = {
  id: string;
  registration_type: string;
  full_name: string;
  cpf_masked?: string | null;
  phone?: string | null;
  email?: string | null;
  wifi_username: string;
  status: string;
  marketing_opt_in: boolean;
  terms_version: string;
  privacy_version: string;
  current_plan?: { id: string; name: string } | null;
};

function getInitialForm(settings?: AppSettings | null) {
  return {
    registration_type: "member",
    full_name: "",
    cpf: "",
    phone: "",
    email: "",
    wifi_username: "",
    wifi_password: "",
    status: "active",
    marketing_opt_in: false,
    terms_version: settings?.default_terms_version || "v1",
    privacy_version: settings?.default_privacy_version || "v1",
    plan_id: "",
  };
}

export default function ClientsPage() {
  const { token, ready, logout } = useSessionToken();
  const [clients, setClients] = useState<Client[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [form, setForm] = useState(() => getInitialForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadData(activeToken: string) {
    const [clientsResponse, plansResponse, settingsResponse] = await Promise.all([
      apiFetch<Client[]>("/clients", { token: activeToken }),
      apiFetch<Plan[]>("/plans", { token: activeToken }),
      apiFetch<AppSettings>("/settings", { token: activeToken }),
    ]);
    setClients(clientsResponse);
    setPlans(plansResponse);
    setSettings(settingsResponse);
    if (!editingId) {
      setForm(getInitialForm(settingsResponse));
    }
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

  function resetForm() {
    setForm(getInitialForm(settings));
    setEditingId(null);
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
            cpf: form.cpf || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
            wifi_password: form.wifi_password || undefined,
            plan_id: form.plan_id || undefined,
            terms_accepted_at: new Date().toISOString(),
            privacy_accepted_at: new Date().toISOString(),
          };

          if (editingId) {
            await apiFetch(`/clients/${editingId}`, {
              method: "PUT",
              token: activeToken,
              body,
            });
          } else {
            await apiFetch("/clients", {
              method: "POST",
              token: activeToken,
              body,
            });
          }

          await loadData(activeToken);
          resetForm();
          setMessage("Cliente salvo com sucesso.");
        } catch (error) {
          setMessage(error instanceof ApiError ? error.message : "Falha ao salvar cliente");
        }
      })();
    });
  }

  return (
    <DashboardShell
      title="Clientes"
      description="Cadastre credenciais Wi-Fi, status de acesso, termos e plano atual."
      chip="Cadastro principal"
      onLogout={logout}
    >
      <section className="grid two-col">
        <section className="panel">
          <h3 className="section-title">{editingId ? "Editar cliente" : "Novo cliente"}</h3>
          <p className="muted">O hash de senha e gerado no backend para uso pelo FreeRADIUS.</p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label>Nome completo</label>
              <input
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                required
              />
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Tipo</label>
                <select
                  value={form.registration_type}
                  onChange={(event) => setForm({ ...form, registration_type: event.target.value })}
                >
                  <option value="member">Aluno</option>
                  <option value="visitor">Visitante</option>
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">Ativo</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>CPF</label>
                <input value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} />
              </div>
              <div className="field">
                <label>Telefone</label>
                <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
            </div>

            <div className="field">
              <label>E-mail</label>
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Usuario Wi-Fi</label>
                <input
                  value={form.wifi_username}
                  onChange={(event) => setForm({ ...form, wifi_username: event.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>{editingId ? "Nova senha Wi-Fi" : "Senha Wi-Fi"}</label>
                <input
                  type="password"
                  value={form.wifi_password}
                  onChange={(event) => setForm({ ...form, wifi_password: event.target.value })}
                  required={!editingId}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Versao dos termos</label>
                <input
                  value={form.terms_version}
                  onChange={(event) => setForm({ ...form, terms_version: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Versao de privacidade</label>
                <input
                  value={form.privacy_version}
                  onChange={(event) => setForm({ ...form, privacy_version: event.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>Plano</label>
              <select value={form.plan_id} onChange={(event) => setForm({ ...form, plan_id: event.target.value })}>
                <option value="">Sem plano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.marketing_opt_in}
                onChange={(event) => setForm({ ...form, marketing_opt_in: event.target.checked })}
              />
              <span>Marketing opt-in separado</span>
            </label>

            {message ? <div className="muted">{message}</div> : null}

            <div className="button-row">
              <button className="button" type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : editingId ? "Atualizar cliente" : "Criar cliente"}
              </button>
              <button className="ghost-button" type="button" onClick={resetForm}>
                Limpar
              </button>
            </div>
          </form>
        </section>

        <ResourceTable
          title="Base cadastrada"
          subtitle="Edicoes reaproveitam o formulario ao lado."
          columns={["Nome", "Usuario", "Plano", "Status", "CPF", "Acoes"]}
          rows={
            clients.length ? (
              <>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.full_name}</strong>
                      <div className="muted">{client.email || client.phone || "Sem contato"}</div>
                    </td>
                    <td>{client.wifi_username}</td>
                    <td>{client.current_plan?.name || "Sem plano"}</td>
                    <td>
                      <span className="status-pill">{client.status}</span>
                    </td>
                    <td>{client.cpf_masked || "-"}</td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                    onClick={() => {
                          setEditingId(client.id);
                          setForm({
                            registration_type: client.registration_type,
                            full_name: client.full_name,
                            cpf: "",
                            phone: client.phone || "",
                            email: client.email || "",
                            wifi_username: client.wifi_username,
                            wifi_password: "",
                            status: client.status,
                            marketing_opt_in: client.marketing_opt_in,
                            terms_version: client.terms_version,
                            privacy_version: client.privacy_version,
                            plan_id: client.current_plan?.id || "",
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
                <td colSpan={6} className="empty-state">
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )
          }
        />
      </section>
    </DashboardShell>
  );
}
