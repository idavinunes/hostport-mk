"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type RouterOption = {
  id: string;
  name: string;
  site_name?: string | null;
  integration_enabled: boolean;
  voucher_sync_enabled: boolean;
};

type VoucherRecord = {
  id: string;
  router_id: string;
  router_name: string;
  router_site_name?: string | null;
  username: string;
  password_masked: string;
  plain_password?: string | null;
  comment?: string | null;
  profile_name?: string | null;
  server_name?: string | null;
  limit_uptime?: string | null;
  active: boolean;
  sync_status: "pending" | "synced" | "failed";
  sync_error?: string | null;
  mikrotik_user_id?: string | null;
  synced_at?: string | null;
  created_at: string;
};

const initialForm = {
  router_id: "",
  username: "",
  password: "",
  comment: "",
  profile_name: "",
  server_name: "",
  limit_uptime: "1d",
  active: true,
};

export default function VouchersPage() {
  const { token, ready, logout } = useSessionToken();
  const [routers, setRouters] = useState<RouterOption[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [issuedVoucher, setIssuedVoucher] = useState<VoucherRecord | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData(activeToken: string) {
    const [routerData, voucherData] = await Promise.all([
      apiFetch<RouterOption[]>("/routers", { token: activeToken }),
      apiFetch<VoucherRecord[]>("/vouchers", { token: activeToken }),
    ]);

    const integratedRouters = routerData.filter((router) => router.integration_enabled && router.voucher_sync_enabled);
    setRouters(integratedRouters);
    setVouchers(voucherData);
    setForm((current) => ({
      ...current,
      router_id: current.router_id || integratedRouters[0]?.id || "",
    }));
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
    setIssuedVoucher(null);
    const activeToken = token;
    if (!activeToken) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const created = await apiFetch<VoucherRecord>("/vouchers", {
            method: "POST",
            token: activeToken,
            body: {
              router_id: form.router_id,
              username: form.username || undefined,
              password: form.password || undefined,
              comment: form.comment || undefined,
              profile_name: form.profile_name || undefined,
              server_name: form.server_name || undefined,
              limit_uptime: form.limit_uptime || undefined,
              active: form.active,
            },
          });
          await loadData(activeToken);
          setIssuedVoucher(created);
          setForm((current) => ({
            ...initialForm,
            router_id: current.router_id,
          }));
          setMessage(
            created.sync_status === "synced"
              ? "Voucher emitido e sincronizado com o MikroTik."
              : `Voucher salvo, mas a sincronizacao falhou: ${created.sync_error || "erro desconhecido"}`,
          );
        } catch (error) {
          setMessage(error instanceof ApiError ? error.message : "Falha ao emitir voucher");
        }
      })();
    });
  }

  async function syncVoucher(voucherId: string) {
    const activeToken = token;
    if (!activeToken) {
      return;
    }
    setSyncingId(voucherId);
    setMessage("");
    try {
      await apiFetch<VoucherRecord>(`/vouchers/${voucherId}/sync`, {
        method: "POST",
        token: activeToken,
      });
      await loadData(activeToken);
      setMessage("Voucher reenviado para o MikroTik com sucesso.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Falha ao sincronizar voucher");
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <DashboardShell
      title="Vouchers HotSpot"
      description="Emita credenciais locais de HotSpot e sincronize no MikroTik no momento da criacao."
      chip="Provisionamento local"
      onLogout={logout}
    >
      <section className="grid two-col">
        <section className="panel">
          <h3 className="section-title">Novo voucher</h3>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label>Roteador</label>
              <select
                value={form.router_id}
                onChange={(event) => setForm({ ...form, router_id: event.target.value })}
              >
                {routers.length ? null : <option value="">Nenhum roteador integrado disponivel</option>}
                {routers.map((router) => (
                  <option key={router.id} value={router.id}>
                    {router.name}
                    {router.site_name ? ` - ${router.site_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Usuario do voucher</label>
                <input
                  placeholder="Deixe em branco para gerar automaticamente"
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Senha</label>
                <input
                  placeholder="Deixe em branco para gerar automaticamente"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Perfil local do HotSpot</label>
                <input
                  value={form.profile_name}
                  onChange={(event) => setForm({ ...form, profile_name: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Servidor HotSpot</label>
                <input
                  value={form.server_name}
                  onChange={(event) => setForm({ ...form, server_name: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Limite de uptime</label>
                <input
                  value={form.limit_uptime}
                  onChange={(event) => setForm({ ...form, limit_uptime: event.target.value })}
                />
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                <span>Voucher ativo</span>
              </label>
            </div>

            <div className="field">
              <label>Comentario</label>
              <input
                value={form.comment}
                onChange={(event) => setForm({ ...form, comment: event.target.value })}
              />
            </div>

            {message ? <div className="muted">{message}</div> : null}

            {issuedVoucher ? (
              <div className="panel" style={{ marginTop: 10 }}>
                <strong>Credencial emitida</strong>
                <p className="muted">Guarde agora. A senha completa so aparece neste momento.</p>
                <div className="feature-list" style={{ marginTop: 10 }}>
                  <div className="feature-item">Usuario: {issuedVoucher.username}</div>
                  <div className="feature-item">Senha: {issuedVoucher.plain_password || "-"}</div>
                  <div className="feature-item">
                    Status de sync: {issuedVoucher.sync_status}
                    {issuedVoucher.sync_error ? ` - ${issuedVoucher.sync_error}` : ""}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="button-row">
              <button className="button" type="submit" disabled={isPending || !form.router_id}>
                {isPending ? "Emitindo..." : "Emitir voucher"}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setForm((current) => ({ ...initialForm, router_id: current.router_id }))}
              >
                Limpar
              </button>
            </div>
          </form>
        </section>

        <ResourceTable
          title="Vouchers emitidos"
          subtitle="Cada emissao cria ou atualiza o usuario local do HotSpot no MikroTik configurado."
          columns={["Roteador", "Usuario", "Senha", "Limite", "Sync", "Acoes"]}
          rows={
            vouchers.length ? (
              <>
                {vouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td>
                      {voucher.router_name}
                      {voucher.router_site_name ? ` - ${voucher.router_site_name}` : ""}
                    </td>
                    <td>{voucher.username}</td>
                    <td>{voucher.password_masked}</td>
                    <td>{voucher.limit_uptime || "-"}</td>
                    <td>
                      <span className="status-pill">{voucher.sync_status}</span>
                      {voucher.sync_error ? <div className="muted">{voucher.sync_error}</div> : null}
                    </td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void syncVoucher(voucher.id)}
                        disabled={syncingId === voucher.id}
                      >
                        {syncingId === voucher.id ? "Sincronizando..." : "Reenviar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td colSpan={6} className="empty-state">
                  Nenhum voucher emitido.
                </td>
              </tr>
            )
          }
        />
      </section>
    </DashboardShell>
  );
}
