"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type RouterRecord = {
  id: string;
  name: string;
  nas_identifier: string;
  routeros_version: "v6" | "v7";
  ip_address: string;
  site_name?: string | null;
  integration_enabled: boolean;
  management_transport: "api" | "api-ssl";
  management_port: number;
  management_username?: string | null;
  management_verify_tls: boolean;
  management_password_configured: boolean;
  voucher_sync_enabled: boolean;
  online_monitoring_enabled: boolean;
  hotspot_interface: string;
  hotspot_name: string;
  hotspot_profile_name: string;
  hotspot_address: string;
  hotspot_network: string;
  pool_name: string;
  pool_range_start: string;
  pool_range_end: string;
  dhcp_server_name: string;
  lease_time: string;
  nas_port_type: string;
  radius_src_address: string;
  radius_timeout: string;
  radius_interim_update: string;
  configure_dns: boolean;
  create_dhcp: boolean;
  create_walled_garden: boolean;
  create_api_walled_garden: boolean;
  active: boolean;
};

type RouterForm = {
  name: string;
  nas_identifier: string;
  routeros_version: "v6" | "v7";
  ip_address: string;
  site_name: string;
  integration_enabled: boolean;
  management_transport: "api" | "api-ssl";
  management_port: number;
  management_username: string;
  management_password: string;
  management_verify_tls: boolean;
  voucher_sync_enabled: boolean;
  online_monitoring_enabled: boolean;
  hotspot_interface: string;
  hotspot_name: string;
  hotspot_profile_name: string;
  hotspot_address: string;
  hotspot_network: string;
  pool_name: string;
  pool_range_start: string;
  pool_range_end: string;
  dhcp_server_name: string;
  lease_time: string;
  nas_port_type: string;
  radius_src_address: string;
  radius_timeout: string;
  radius_interim_update: string;
  configure_dns: boolean;
  create_dhcp: boolean;
  create_walled_garden: boolean;
  create_api_walled_garden: boolean;
  active: boolean;
};

const initialForm: RouterForm = {
  name: "",
  nas_identifier: "",
  routeros_version: "v7",
  ip_address: "",
  site_name: "",
  integration_enabled: false,
  management_transport: "api",
  management_port: 8728,
  management_username: "",
  management_password: "",
  management_verify_tls: false,
  voucher_sync_enabled: true,
  online_monitoring_enabled: true,
  hotspot_interface: "bridge-lan",
  hotspot_name: "hotspot-academia",
  hotspot_profile_name: "hsprof-academia",
  hotspot_address: "10.10.10.1",
  hotspot_network: "10.10.10.0/24",
  pool_name: "pool-hotspot",
  pool_range_start: "10.10.10.100",
  pool_range_end: "10.10.10.250",
  dhcp_server_name: "dhcp-hotspot",
  lease_time: "1h",
  nas_port_type: "wireless-802.11",
  radius_src_address: "10.10.10.1",
  radius_timeout: "1100ms",
  radius_interim_update: "5m",
  configure_dns: true,
  create_dhcp: true,
  create_walled_garden: true,
  create_api_walled_garden: true,
  active: true,
};

export default function RoutersPage() {
  const { token, ready, logout } = useSessionToken();
  const [routers, setRouters] = useState<RouterRecord[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [testingId, setTestingId] = useState<string | null>(null);

  async function loadData(activeToken: string) {
    setRouters(await apiFetch<RouterRecord[]>("/routers", { token: activeToken }));
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
    setEditingId(null);
    setForm(initialForm);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setTestMessage("");
    const activeToken = token;
    if (!activeToken) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const body = {
            ...form,
            site_name: form.site_name || undefined,
            management_username: form.management_username || undefined,
            management_password: form.management_password || undefined,
          };

          if (editingId) {
            await apiFetch(`/routers/${editingId}`, {
              method: "PUT",
              token: activeToken,
              body,
            });
          } else {
            await apiFetch("/routers", {
              method: "POST",
              token: activeToken,
              body,
            });
          }

          await loadData(activeToken);
          resetForm();
          setMessage("Roteador salvo com sucesso.");
        } catch (error) {
          setMessage(error instanceof ApiError ? error.message : "Falha ao salvar roteador");
        }
      })();
    });
  }

  async function testConnection(routerId: string) {
    if (!token) {
      return;
    }
    setTestingId(routerId);
    setTestMessage("");
    try {
      const result = await apiFetch<{
        identity?: string | null;
        version?: string | null;
        board_name?: string | null;
      }>(`/mikrotik/routers/${routerId}/test-connection`, {
        method: "POST",
        token,
      });
      setTestMessage(
        `Conexao OK: ${result.identity || "router"}${result.version ? ` (${result.version})` : ""}${
          result.board_name ? ` - ${result.board_name}` : ""
        }`,
      );
    } catch (error) {
      setTestMessage(error instanceof ApiError ? error.message : "Falha ao testar conexao");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <DashboardShell
      title="Roteadores e NAS"
      description="Mantenha o inventario dos equipamentos, o onboarding RADIUS e as credenciais para integracao ativa com o MikroTik."
      chip="Inventario + Integracao"
      onLogout={logout}
    >
      <section className="grid two-col">
        <section className="panel">
          <h3 className="section-title">{editingId ? "Editar roteador" : "Novo roteador"}</h3>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field-inline">
              <div className="field">
                <label>Nome</label>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="field">
                <label>Versao RouterOS</label>
                <select
                  value={form.routeros_version}
                  onChange={(event) => {
                    const version = event.target.value as "v6" | "v7";
                    setForm({
                      ...form,
                      routeros_version: version,
                      radius_timeout: version === "v7" ? "1100ms" : "1s",
                    });
                  }}
                >
                  <option value="v7">v7</option>
                  <option value="v6">v6</option>
                </select>
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>NAS-Identifier</label>
                <input
                  value={form.nas_identifier}
                  onChange={(event) => setForm({ ...form, nas_identifier: event.target.value })}
                />
              </div>
              <div className="field">
                <label>IP de gestao</label>
                <input
                  value={form.ip_address}
                  onChange={(event) => setForm({ ...form, ip_address: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Unidade</label>
                <input
                  value={form.site_name}
                  onChange={(event) => setForm({ ...form, site_name: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.integration_enabled}
                  onChange={(event) => setForm({ ...form, integration_enabled: event.target.checked })}
                />
                <span>Habilitar integracao ativa</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                <span>Roteador ativo</span>
              </label>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Transporte de gestao</label>
                <select
                  value={form.management_transport}
                  onChange={(event) => {
                    const managementTransport = event.target.value as "api" | "api-ssl";
                    setForm({
                      ...form,
                      management_transport: managementTransport,
                      management_port: managementTransport === "api-ssl" ? 8729 : 8728,
                    });
                  }}
                >
                  <option value="api">API TCP 8728</option>
                  <option value="api-ssl">API-SSL TCP 8729</option>
                </select>
              </div>
              <div className="field">
                <label>Porta de gestao</label>
                <input
                  type="number"
                  value={form.management_port}
                  onChange={(event) => setForm({ ...form, management_port: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="field">
                <label>Usuario de gestao</label>
                <input
                  value={form.management_username}
                  onChange={(event) => setForm({ ...form, management_username: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Senha de gestao</label>
                <input
                  type="password"
                  placeholder={editingId ? "Deixe em branco para manter a atual" : ""}
                  value={form.management_password}
                  onChange={(event) => setForm({ ...form, management_password: event.target.value })}
                />
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.management_verify_tls}
                  onChange={(event) => setForm({ ...form, management_verify_tls: event.target.checked })}
                />
                <span>Validar certificado TLS</span>
              </label>
            </div>

            <div className="field-inline">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.voucher_sync_enabled}
                  onChange={(event) => setForm({ ...form, voucher_sync_enabled: event.target.checked })}
                />
                <span>Permitir sync de vouchers</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.online_monitoring_enabled}
                  onChange={(event) => setForm({ ...form, online_monitoring_enabled: event.target.checked })}
                />
                <span>Permitir leitura online</span>
              </label>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Interface HotSpot</label>
                <input
                  value={form.hotspot_interface}
                  onChange={(event) => setForm({ ...form, hotspot_interface: event.target.value })}
                />
              </div>
              <div className="field">
                <label>IP do HotSpot</label>
                <input
                  value={form.hotspot_address}
                  onChange={(event) => setForm({ ...form, hotspot_address: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Nome do HotSpot</label>
                <input
                  value={form.hotspot_name}
                  onChange={(event) => setForm({ ...form, hotspot_name: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Profile do HotSpot</label>
                <input
                  value={form.hotspot_profile_name}
                  onChange={(event) => setForm({ ...form, hotspot_profile_name: event.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>Rede do HotSpot</label>
              <input
                value={form.hotspot_network}
                onChange={(event) => setForm({ ...form, hotspot_network: event.target.value })}
              />
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Nome do pool</label>
                <input
                  value={form.pool_name}
                  onChange={(event) => setForm({ ...form, pool_name: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Servidor DHCP</label>
                <input
                  value={form.dhcp_server_name}
                  onChange={(event) => setForm({ ...form, dhcp_server_name: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Pool inicial</label>
                <input
                  value={form.pool_range_start}
                  onChange={(event) => setForm({ ...form, pool_range_start: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Pool final</label>
                <input
                  value={form.pool_range_end}
                  onChange={(event) => setForm({ ...form, pool_range_end: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Lease time</label>
                <input
                  value={form.lease_time}
                  onChange={(event) => setForm({ ...form, lease_time: event.target.value })}
                />
              </div>
              <div className="field">
                <label>NAS port type</label>
                <input
                  value={form.nas_port_type}
                  onChange={(event) => setForm({ ...form, nas_port_type: event.target.value })}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>src-address RADIUS</label>
                <input
                  value={form.radius_src_address}
                  onChange={(event) => setForm({ ...form, radius_src_address: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Timeout RADIUS</label>
                <input
                  value={form.radius_timeout}
                  onChange={(event) => setForm({ ...form, radius_timeout: event.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>Interim update</label>
              <input
                value={form.radius_interim_update}
                onChange={(event) => setForm({ ...form, radius_interim_update: event.target.value })}
              />
            </div>

            <div className="field-inline">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.configure_dns}
                  onChange={(event) => setForm({ ...form, configure_dns: event.target.checked })}
                />
                <span>Configurar DNS</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.create_dhcp}
                  onChange={(event) => setForm({ ...form, create_dhcp: event.target.checked })}
                />
                <span>Criar DHCP</span>
              </label>
            </div>

            <div className="field-inline">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.create_walled_garden}
                  onChange={(event) => setForm({ ...form, create_walled_garden: event.target.checked })}
                />
                <span>Criar walled garden</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.create_api_walled_garden}
                  onChange={(event) => setForm({ ...form, create_api_walled_garden: event.target.checked })}
                />
                <span>Incluir API no walled garden</span>
              </label>
            </div>

            {message ? <div className="muted">{message}</div> : null}
            {testMessage ? <div className="muted">{testMessage}</div> : null}

            <div className="button-row">
              <button className="button" type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : editingId ? "Atualizar roteador" : "Criar roteador"}
              </button>
              <button className="ghost-button" type="button" onClick={resetForm}>
                Limpar
              </button>
            </div>
          </form>
        </section>

        <ResourceTable
          title="Roteadores registrados"
          subtitle="Agora o cadastro tambem guarda credenciais para emitir vouchers e consultar usuarios online."
          columns={["Nome", "Versao", "NAS", "Integracao", "Rede", "Status", "Acoes"]}
          rows={
            routers.length ? (
              <>
                {routers.map((router) => (
                  <tr key={router.id}>
                    <td>{router.name}</td>
                    <td>{router.routeros_version}</td>
                    <td>{router.nas_identifier}</td>
                    <td>
                      {router.integration_enabled ? `${router.management_transport}:${router.management_port}` : "Desligada"}
                    </td>
                    <td>{router.hotspot_network}</td>
                    <td>
                      <span className="status-pill">{router.active ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingId(router.id);
                          setForm({
                            name: router.name,
                            nas_identifier: router.nas_identifier,
                            routeros_version: router.routeros_version,
                            ip_address: router.ip_address,
                            site_name: router.site_name || "",
                            integration_enabled: router.integration_enabled,
                            management_transport: router.management_transport,
                            management_port: router.management_port,
                            management_username: router.management_username || "",
                            management_password: "",
                            management_verify_tls: router.management_verify_tls,
                            voucher_sync_enabled: router.voucher_sync_enabled,
                            online_monitoring_enabled: router.online_monitoring_enabled,
                            hotspot_interface: router.hotspot_interface,
                            hotspot_name: router.hotspot_name,
                            hotspot_profile_name: router.hotspot_profile_name,
                            hotspot_address: router.hotspot_address,
                            hotspot_network: router.hotspot_network,
                            pool_name: router.pool_name,
                            pool_range_start: router.pool_range_start,
                            pool_range_end: router.pool_range_end,
                            dhcp_server_name: router.dhcp_server_name,
                            lease_time: router.lease_time,
                            nas_port_type: router.nas_port_type,
                            radius_src_address: router.radius_src_address,
                            radius_timeout: router.radius_timeout,
                            radius_interim_update: router.radius_interim_update,
                            configure_dns: router.configure_dns,
                            create_dhcp: router.create_dhcp,
                            create_walled_garden: router.create_walled_garden,
                            create_api_walled_garden: router.create_api_walled_garden,
                            active: router.active,
                          });
                          setTestMessage(
                            router.management_password_configured
                              ? "Senha de gestao configurada. Deixe em branco para manter."
                              : "Defina a senha de gestao para habilitar integracao ativa.",
                          );
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void testConnection(router.id)}
                        disabled={testingId === router.id || !router.integration_enabled}
                      >
                        {testingId === router.id ? "Testando..." : "Testar conexao"}
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td colSpan={6} className="empty-state">
                  Nenhum roteador cadastrado.
                </td>
              </tr>
            )
          }
        />
      </section>
    </DashboardShell>
  );
}
