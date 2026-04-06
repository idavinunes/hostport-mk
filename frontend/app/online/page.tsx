"use client";

import { useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type RouterOption = {
  id: string;
  name: string;
  site_name?: string | null;
  integration_enabled: boolean;
  online_monitoring_enabled: boolean;
};

type OnlineUser = {
  router_id: string;
  router_name: string;
  router_site_name?: string | null;
  username?: string | null;
  client_name?: string | null;
  device_nickname?: string | null;
  address?: string | null;
  mac_address?: string | null;
  server?: string | null;
  login_by?: string | null;
  uptime?: string | null;
  session_time_left?: string | null;
  idle_time?: string | null;
  bytes_in?: string | null;
  bytes_out?: string | null;
};

export default function OnlinePage() {
  const { token, ready, logout } = useSessionToken();
  const [routers, setRouters] = useState<RouterOption[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) {
      return;
    }

    void (async () => {
      const routerData = await apiFetch<RouterOption[]>("/routers", { token });
      const enabledRouters = routerData.filter((router) => router.integration_enabled && router.online_monitoring_enabled);
      setRouters(enabledRouters);
      setSelectedRouterId(enabledRouters[0]?.id || "");
    })();
  }, [token]);

  if (!ready || !token) {
    return null;
  }

  function loadOnlineUsers(routerId: string) {
    if (!routerId) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage("");
        try {
          const response = await apiFetch<OnlineUser[]>(`/mikrotik/routers/${routerId}/online-users`, {
            token,
          });
          setOnlineUsers(response);
          setMessage(
            response.length
              ? `${response.length} usuario(s) online retornados pelo MikroTik.`
              : "Nenhum usuario online retornado pelo MikroTik.",
          );
        } catch (error) {
          setOnlineUsers([]);
          setMessage(error instanceof ApiError ? error.message : "Falha ao consultar usuarios online");
        }
      })();
    });
  }

  return (
    <DashboardShell
      title="Usuarios online"
      description="Consulta ativa no MikroTik para reconciliar quem esta online com os cadastros e dispositivos locais."
      chip="Leitura ativa do roteador"
      onLogout={logout}
    >
      <section className="panel">
        <div className="field-inline">
          <div className="field">
            <label>Roteador</label>
            <select
              value={selectedRouterId}
              onChange={(event) => setSelectedRouterId(event.target.value)}
            >
              {routers.length ? null : <option value="">Nenhum roteador com leitura online habilitada</option>}
              {routers.map((router) => (
                <option key={router.id} value={router.id}>
                  {router.name}
                  {router.site_name ? ` - ${router.site_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row" style={{ alignItems: "flex-end" }}>
            <button
              className="button"
              type="button"
              onClick={() => loadOnlineUsers(selectedRouterId)}
              disabled={isPending || !selectedRouterId}
            >
              {isPending ? "Consultando..." : "Atualizar leitura"}
            </button>
          </div>
        </div>

        {message ? <p className="muted">{message}</p> : null}
      </section>

      <ResourceTable
        title="Leitura atual do HotSpot"
        subtitle="Essa leitura complementa o accounting persistido e ajuda na conciliacao operacional com o MikroTik."
        columns={["Usuario", "Cliente", "Dispositivo", "IP", "MAC", "Uptime", "Login"]}
        rows={
          onlineUsers.length ? (
            <>
              {onlineUsers.map((user, index) => (
                <tr key={`${user.router_id}-${user.username || "anon"}-${user.mac_address || index}`}>
                  <td>{user.username || "-"}</td>
                  <td>{user.client_name || "-"}</td>
                  <td>{user.device_nickname || "-"}</td>
                  <td>{user.address || "-"}</td>
                  <td>{user.mac_address || "-"}</td>
                  <td>{user.uptime || "-"}</td>
                  <td>{user.login_by || "-"}</td>
                </tr>
              ))}
            </>
          ) : (
            <tr>
              <td colSpan={7} className="empty-state">
                Nenhum dado online carregado.
              </td>
            </tr>
          )
        }
      />
    </DashboardShell>
  );
}
