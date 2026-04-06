"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ResourceTable } from "@/components/resource-table";
import { apiFetch, ApiError } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";

type ClientOption = {
  id: string;
  full_name: string;
};

type Device = {
  id: string;
  client_id: string;
  client_name?: string | null;
  mac_masked: string;
  nickname?: string | null;
  blocked: boolean;
};

const initialForm = {
  client_id: "",
  mac: "",
  nickname: "",
  blocked: false,
};

export default function DevicesPage() {
  const { token, ready, logout } = useSessionToken();
  const [devices, setDevices] = useState<Device[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadData(activeToken: string) {
    const [devicesResponse, clientsResponse] = await Promise.all([
      apiFetch<Device[]>("/devices", { token: activeToken }),
      apiFetch<ClientOption[]>("/clients", { token: activeToken }),
    ]);
    setDevices(devicesResponse);
    setClients(clientsResponse);
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
    setForm(initialForm);
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
            nickname: form.nickname || undefined,
          };

          if (editingId) {
            await apiFetch(`/devices/${editingId}`, {
              method: "PUT",
              token: activeToken,
              body,
            });
          } else {
            await apiFetch("/devices", {
              method: "POST",
              token: activeToken,
              body,
            });
          }

          await loadData(activeToken);
          resetForm();
          setMessage("Dispositivo salvo com sucesso.");
        } catch (error) {
          setMessage(error instanceof ApiError ? error.message : "Falha ao salvar dispositivo");
        }
      })();
    });
  }

  return (
    <DashboardShell
      title="Dispositivos autorizados"
      description="Relacione cada MAC a um cliente para facilitar identificacao operacional."
      chip="Controle de MAC"
      onLogout={logout}
    >
      <section className="grid two-col">
        <section className="panel">
          <h3 className="section-title">{editingId ? "Editar dispositivo" : "Novo dispositivo"}</h3>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label>Cliente</label>
              <select
                value={form.client_id}
                onChange={(event) => setForm({ ...form, client_id: event.target.value })}
                required
              >
                <option value="">Selecione</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>MAC address</label>
              <input
                value={form.mac}
                onChange={(event) => setForm({ ...form, mac: event.target.value })}
                placeholder="AA:BB:CC:DD:EE:FF"
                required={!editingId}
              />
            </div>

            <div className="field">
              <label>Apelido</label>
              <input
                value={form.nickname}
                onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                placeholder="iPhone do aluno"
              />
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.blocked}
                onChange={(event) => setForm({ ...form, blocked: event.target.checked })}
              />
              <span>Dispositivo bloqueado</span>
            </label>

            {message ? <div className="muted">{message}</div> : null}

            <div className="button-row">
              <button className="button" type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : editingId ? "Atualizar dispositivo" : "Criar dispositivo"}
              </button>
              <button className="ghost-button" type="button" onClick={resetForm}>
                Limpar
              </button>
            </div>
          </form>
        </section>

        <ResourceTable
          title="Inventario atual"
          subtitle="A interface mostra MAC mascarado para evitar exposicao desnecessaria."
          columns={["Cliente", "MAC", "Apelido", "Status", "Acoes"]}
          rows={
            devices.length ? (
              <>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td>{device.client_name || "-"}</td>
                    <td>{device.mac_masked}</td>
                    <td>{device.nickname || "-"}</td>
                    <td>
                      <span className="status-pill">{device.blocked ? "Bloqueado" : "Liberado"}</span>
                    </td>
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingId(device.id);
                          setForm({
                            client_id: device.client_id,
                            mac: "",
                            nickname: device.nickname || "",
                            blocked: device.blocked,
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
                  Nenhum dispositivo cadastrado.
                </td>
              </tr>
            )
          }
        />
      </section>
    </DashboardShell>
  );
}
