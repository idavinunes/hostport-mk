"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type AppSettings = {
  id: number;
  company_name: string;
  legal_name?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
  portal_domain: string;
  api_domain: string;
  radius_server_ip: string;
  default_dns_servers: string;
  default_radius_interim_update: string;
  default_terms_version: string;
  default_privacy_version: string;
};

const initialForm: AppSettings = {
  id: 1,
  company_name: "",
  legal_name: "",
  support_email: "",
  support_phone: "",
  portal_domain: "",
  api_domain: "",
  radius_server_ip: "",
  default_dns_servers: "1.1.1.1,8.8.8.8",
  default_radius_interim_update: "5m",
  default_terms_version: "v1",
  default_privacy_version: "v1",
};

export default function SettingsPage() {
  const { token, ready, logout } = useSessionToken();
  const [form, setForm] = useState<AppSettings>(initialForm);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiFetch<AppSettings>("/settings", { token }).then(setForm);
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
          const saved = await apiFetch<AppSettings>("/settings", {
            method: "PUT",
            token: activeToken,
            body: {
              ...form,
              legal_name: form.legal_name || undefined,
              support_email: form.support_email || undefined,
              support_phone: form.support_phone || undefined,
            },
          });
          setForm(saved);
          setMessage("Configuracoes salvas com sucesso.");
        } catch (error) {
          setMessage(error instanceof ApiError ? error.message : "Falha ao salvar configuracoes");
        }
      })();
    });
  }

  return (
    <DashboardShell
      title="Configuracoes da operacao"
      description="Centralize os dados da empresa, dominios e defaults usados na validacao de campo de uma unica operacao."
      chip="Single-company"
      onLogout={logout}
    >
      <section className="panel">
        <h3 className="section-title">Dados centrais</h3>
        <p className="muted">
          Esses valores abastecem o gerador MikroTik e servem como defaults do ambiente para validar uma empresa so.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field-inline">
            <div className="field">
              <label>Nome da empresa</label>
              <input
                value={form.company_name}
                onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Razao social</label>
              <input
                value={form.legal_name || ""}
                onChange={(event) => setForm({ ...form, legal_name: event.target.value })}
              />
            </div>
          </div>

          <div className="field-inline">
            <div className="field">
              <label>E-mail de suporte</label>
              <input
                value={form.support_email || ""}
                onChange={(event) => setForm({ ...form, support_email: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Telefone de suporte</label>
              <input
                value={form.support_phone || ""}
                onChange={(event) => setForm({ ...form, support_phone: event.target.value })}
              />
            </div>
          </div>

          <div className="field-inline">
            <div className="field">
              <label>Dominio do portal</label>
              <input
                value={form.portal_domain}
                onChange={(event) => setForm({ ...form, portal_domain: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Dominio da API</label>
              <input
                value={form.api_domain}
                onChange={(event) => setForm({ ...form, api_domain: event.target.value })}
              />
            </div>
          </div>

          <div className="field-inline">
            <div className="field">
              <label>IP do servidor RADIUS</label>
              <input
                value={form.radius_server_ip}
                onChange={(event) => setForm({ ...form, radius_server_ip: event.target.value })}
              />
            </div>
            <div className="field">
              <label>DNS padrao</label>
              <input
                value={form.default_dns_servers}
                onChange={(event) => setForm({ ...form, default_dns_servers: event.target.value })}
              />
            </div>
          </div>

          <div className="field-inline">
            <div className="field">
              <label>Interim-update padrao</label>
              <input
                value={form.default_radius_interim_update}
                onChange={(event) =>
                  setForm({ ...form, default_radius_interim_update: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Versao de termos padrao</label>
              <input
                value={form.default_terms_version}
                onChange={(event) => setForm({ ...form, default_terms_version: event.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Versao de privacidade padrao</label>
            <input
              value={form.default_privacy_version}
              onChange={(event) => setForm({ ...form, default_privacy_version: event.target.value })}
            />
          </div>

          {message ? <div className="muted">{message}</div> : null}

          <div className="button-row">
            <button className="button" type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar configuracoes"}
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
