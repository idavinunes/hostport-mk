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

const initialForm = {
  name: "",
  nas_identifier: "",
  routeros_version: "v7",
  ip_address: "",
  site_name: "",
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
  const [isPending, startTransition] = useTransition();

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
            site_name: form.site_name || undefined,
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
          setEditingId(null);
          setForm(initialForm);
          setMessage("Roteador salvo com sucesso.");
        } catch (error) {
          setMessage(error instanceof ApiError ? error.message : "Falha ao salvar roteador");
        }
      })();
    });
  }

  return (
    <DashboardShell
      title="Roteadores e NAS"
      description="Mantenha o inventario dos equipamentos que enviam autenticacao e accounting."
      chip="Inventario de NAS"
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
                <label>IP</label>
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

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              <span>Roteador ativo</span>
            </label>

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
                  onChange={(event) =>
                    setForm({ ...form, create_walled_garden: event.target.checked })
                  }
                />
                <span>Criar walled garden</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.create_api_walled_garden}
                  onChange={(event) =>
                    setForm({ ...form, create_api_walled_garden: event.target.checked })
                  }
                />
                <span>Incluir API no walled garden</span>
              </label>
            </div>

            {message ? <div className="muted">{message}</div> : null}

            <div className="button-row">
              <button className="button" type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : editingId ? "Atualizar roteador" : "Criar roteador"}
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
          title="Roteadores registrados"
          subtitle="Agora o cadastro guarda parametros suficientes para o gerador MikroTik preencher quase tudo sozinho."
          columns={["Nome", "Versao", "NAS", "Interface", "Rede", "Status", "Acoes"]}
          rows={
            routers.length ? (
              <>
                {routers.map((router) => (
                  <tr key={router.id}>
                    <td>{router.name}</td>
                    <td>{router.routeros_version}</td>
                    <td>{router.nas_identifier}</td>
                    <td>{router.hotspot_interface}</td>
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
                <td colSpan={7} className="empty-state">
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
