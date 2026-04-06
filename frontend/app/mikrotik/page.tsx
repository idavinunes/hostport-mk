"use client";

import { ChangeEvent, useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { useSessionToken } from "@/lib/auth";
import {
  generateMikrotikNotes,
  generateMikrotikScript,
  generateMikrotikValidationScript,
  getDefaultMikrotikConfig,
  MikrotikScriptConfig,
  RouterOsVersion,
} from "@/lib/mikrotik-script";

type RouterRecord = {
  id: string;
  name: string;
  nas_identifier: string;
  ip_address: string;
  routeros_version: RouterOsVersion;
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
};

type AppSettings = {
  company_name: string;
  portal_domain: string;
  api_domain: string;
  radius_server_ip: string;
  default_dns_servers: string;
  default_radius_interim_update: string;
};

export default function MikrotikPage() {
  const { token, ready, logout } = useSessionToken();
  const [routers, setRouters] = useState<RouterRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedRouterId, setSelectedRouterId] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [config, setConfig] = useState<MikrotikScriptConfig>(() => getDefaultMikrotikConfig("v7"));

  useEffect(() => {
    if (!token) {
      return;
    }
    void Promise.all([
      apiFetch<RouterRecord[]>("/routers", { token }),
      apiFetch<AppSettings>("/settings", { token }),
    ])
      .then(([routersResponse, settingsResponse]) => {
        setRouters(routersResponse);
        setSettings(settingsResponse);
        setConfig((current) => ({
          ...current,
          portalDomain: settingsResponse.portal_domain,
          apiDomain: settingsResponse.api_domain,
          radiusServerIp: settingsResponse.radius_server_ip,
          dnsServers: settingsResponse.default_dns_servers,
          radiusInterimUpdate: settingsResponse.default_radius_interim_update,
        }));
      })
      .catch(() => {
        setRouters([]);
        setSettings(null);
      });
  }, [token]);

  useEffect(() => {
    setCopyMessage("");
  }, [config.version]);

  if (!ready || !token) {
    return null;
  }

  const mainScript = generateMikrotikScript(config);
  const validationScript = generateMikrotikValidationScript(config);
  const notes = generateMikrotikNotes(config);

  function updateField<K extends keyof MikrotikScriptConfig>(field: K, value: MikrotikScriptConfig[K]) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function handleVersionChange(event: ChangeEvent<HTMLSelectElement>) {
    const version = event.target.value as RouterOsVersion;
    setConfig((current) => {
      const nextDefaults = getDefaultMikrotikConfig(version);
      return {
        ...nextDefaults,
        hotspotName: current.hotspotName,
        hotspotProfileName: current.hotspotProfileName,
        hotspotInterface: current.hotspotInterface,
        hotspotAddress: current.hotspotAddress,
        hotspotNetwork: current.hotspotNetwork,
        poolName: current.poolName,
        poolRangeStart: current.poolRangeStart,
        poolRangeEnd: current.poolRangeEnd,
        dhcpServerName: current.dhcpServerName,
        leaseTime: current.leaseTime,
        dnsServers: current.dnsServers,
        portalDomain: current.portalDomain,
        apiDomain: current.apiDomain,
        radiusServerIp: current.radiusServerIp,
        radiusSecret: current.radiusSecret,
        radiusSrcAddress: current.radiusSrcAddress,
        radiusInterimUpdate: current.radiusInterimUpdate,
        nasIdentifier: current.nasIdentifier,
        nasPortType: current.nasPortType,
        createWalledGarden: current.createWalledGarden,
        createApiWalledGarden: current.createApiWalledGarden,
        createDhcp: current.createDhcp,
        configureDns: current.configureDns,
      };
    });
  }

  function applyRouter(routerId: string) {
    setSelectedRouterId(routerId);
    const router = routers.find((item) => item.id === routerId);
    if (!router) {
      return;
    }
    setConfig((current) => ({
      ...current,
      version: router.routeros_version,
      hotspotName: router.hotspot_name,
      hotspotProfileName: router.hotspot_profile_name,
      hotspotInterface: router.hotspot_interface,
      hotspotAddress: router.hotspot_address,
      hotspotNetwork: router.hotspot_network,
      poolName: router.pool_name,
      poolRangeStart: router.pool_range_start,
      poolRangeEnd: router.pool_range_end,
      dhcpServerName: router.dhcp_server_name,
      leaseTime: router.lease_time,
      nasPortType: router.nas_port_type,
      radiusSrcAddress: router.radius_src_address,
      radiusTimeout: router.radius_timeout,
      radiusInterimUpdate: router.radius_interim_update,
      nasIdentifier: router.nas_identifier,
      configureDns: router.configure_dns,
      createDhcp: router.create_dhcp,
      createWalledGarden: router.create_walled_garden,
      createApiWalledGarden: router.create_api_walled_garden,
    }));
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage("Script copiado.");
    } catch {
      setCopyMessage("Nao foi possivel copiar automaticamente.");
    }
  }

  return (
    <DashboardShell
      title="Gerador de script MikroTik"
      description="Monte comandos prontos para RouterOS v6 e v7, com HotSpot, RADIUS, accounting e testes de validacao."
      chip="Integracao RouterOS"
      onLogout={logout}
    >
      <section className="grid script-layout">
        <section className="panel">
          <h3 className="section-title">Parametros</h3>
          <p className="muted">
            O gerador cria um script base de integracao. Ajuste a rede, o dominio e o IP do servidor antes de colar no MikroTik.
          </p>
          {settings ? (
            <div className="note-list" style={{ marginBottom: 18 }}>
              <div className="note-item">
                Empresa carregada: <strong>{settings.company_name}</strong>
              </div>
            </div>
          ) : null}

          <div className="form-grid">
            <div className="field-inline">
              <div className="field">
                <label>Versao RouterOS</label>
                <select value={config.version} onChange={handleVersionChange}>
                  <option value="v7">RouterOS v7</option>
                  <option value="v6">RouterOS v6</option>
                </select>
              </div>
              <div className="field">
                <label>Roteador cadastrado</label>
                <select value={selectedRouterId} onChange={(event) => applyRouter(event.target.value)}>
                  <option value="">Nao usar cadastro</option>
                  {routers.map((router) => (
                    <option key={router.id} value={router.id}>
                      {router.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Nome do HotSpot</label>
                <input
                  value={config.hotspotName}
                  onChange={(event) => updateField("hotspotName", event.target.value)}
                />
              </div>
              <div className="field">
                <label>Nome do profile</label>
                <input
                  value={config.hotspotProfileName}
                  onChange={(event) => updateField("hotspotProfileName", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Interface do Wi-Fi</label>
                <input
                  value={config.hotspotInterface}
                  onChange={(event) => updateField("hotspotInterface", event.target.value)}
                />
              </div>
              <div className="field">
                <label>NAS-Identifier</label>
                <input
                  value={config.nasIdentifier}
                  onChange={(event) => updateField("nasIdentifier", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>IP do MikroTik</label>
                <input
                  value={config.hotspotAddress}
                  onChange={(event) => updateField("hotspotAddress", event.target.value)}
                />
              </div>
              <div className="field">
                <label>Rede do HotSpot</label>
                <input
                  value={config.hotspotNetwork}
                  onChange={(event) => updateField("hotspotNetwork", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Pool inicial</label>
                <input
                  value={config.poolRangeStart}
                  onChange={(event) => updateField("poolRangeStart", event.target.value)}
                />
              </div>
              <div className="field">
                <label>Pool final</label>
                <input
                  value={config.poolRangeEnd}
                  onChange={(event) => updateField("poolRangeEnd", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>IP do servidor RADIUS</label>
                <input
                  value={config.radiusServerIp}
                  onChange={(event) => updateField("radiusServerIp", event.target.value)}
                />
              </div>
              <div className="field">
                <label>src-address no MikroTik</label>
                <input
                  value={config.radiusSrcAddress}
                  onChange={(event) => updateField("radiusSrcAddress", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Secret RADIUS</label>
                <input
                  value={config.radiusSecret}
                  onChange={(event) => updateField("radiusSecret", event.target.value)}
                />
              </div>
              <div className="field">
                <label>Timeout RADIUS</label>
                <input
                  value={config.radiusTimeout}
                  onChange={(event) => updateField("radiusTimeout", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Interim-update</label>
                <input
                  value={config.radiusInterimUpdate}
                  onChange={(event) => updateField("radiusInterimUpdate", event.target.value)}
                />
              </div>
              <div className="field">
                <label>DNS externos</label>
                <input
                  value={config.dnsServers}
                  onChange={(event) => updateField("dnsServers", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <div className="field">
                <label>Dominio do portal</label>
                <input
                  value={config.portalDomain}
                  onChange={(event) => updateField("portalDomain", event.target.value)}
                />
              </div>
              <div className="field">
                <label>Dominio da API</label>
                <input
                  value={config.apiDomain}
                  onChange={(event) => updateField("apiDomain", event.target.value)}
                />
              </div>
            </div>

            <div className="field-inline">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={config.configureDns}
                  onChange={(event) => updateField("configureDns", event.target.checked)}
                />
                <span>Configurar DNS local</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={config.createDhcp}
                  onChange={(event) => updateField("createDhcp", event.target.checked)}
                />
                <span>Criar pool e DHCP</span>
              </label>
            </div>

            <div className="field-inline">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={config.createWalledGarden}
                  onChange={(event) => updateField("createWalledGarden", event.target.checked)}
                />
                <span>Criar walled garden do portal</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={config.createApiWalledGarden}
                  onChange={(event) => updateField("createApiWalledGarden", event.target.checked)}
                  disabled={!config.createWalledGarden}
                />
                <span>Adicionar dominio da API</span>
              </label>
            </div>
          </div>
        </section>

        <section className="grid script-stack">
          <section className="panel">
            <div className="script-header">
              <div>
                <h3 className="section-title">Script principal</h3>
                <p className="muted">
                  Bloco para colar no terminal do MikroTik. O gerador troca timeout e observacoes conforme a versao selecionada.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => void copyText(mainScript)}>
                Copiar script
              </button>
            </div>

            <pre className="script-block">{mainScript}</pre>
          </section>

          <section className="panel">
            <div className="script-header">
              <div>
                <h3 className="section-title">Bloco de validacao</h3>
                <p className="muted">Use depois da configuracao para confirmar RADIUS, profile e sessoes ativas.</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => void copyText(validationScript)}>
                Copiar validacao
              </button>
            </div>

            <pre className="script-block">{validationScript}</pre>
          </section>

          <section className="panel">
            <h3 className="section-title">Observacoes</h3>
            <div className="note-list">
              {notes.map((note) => (
                <div key={note} className="note-item">
                  {note}
                </div>
              ))}
            </div>

            {copyMessage ? <p className="muted" style={{ marginTop: 14 }}>{copyMessage}</p> : null}
          </section>
        </section>
      </section>
    </DashboardShell>
  );
}
