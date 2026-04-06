export type RouterOsVersion = "v6" | "v7";

export type MikrotikScriptConfig = {
  version: RouterOsVersion;
  hotspotName: string;
  hotspotProfileName: string;
  hotspotInterface: string;
  hotspotAddress: string;
  hotspotNetwork: string;
  poolName: string;
  poolRangeStart: string;
  poolRangeEnd: string;
  dhcpServerName: string;
  leaseTime: string;
  dnsServers: string;
  portalDomain: string;
  apiDomain: string;
  radiusServerIp: string;
  radiusSecret: string;
  radiusSrcAddress: string;
  radiusTimeout: string;
  radiusInterimUpdate: string;
  nasIdentifier: string;
  nasPortType: string;
  createWalledGarden: boolean;
  createApiWalledGarden: boolean;
  createDhcp: boolean;
  configureDns: boolean;
};

export function getDefaultMikrotikConfig(version: RouterOsVersion): MikrotikScriptConfig {
  return {
    version,
    hotspotName: "hotspot-academia",
    hotspotProfileName: "hsprof-academia",
    hotspotInterface: "bridge-lan",
    hotspotAddress: "10.10.10.1",
    hotspotNetwork: "10.10.10.0/24",
    poolName: "pool-hotspot",
    poolRangeStart: "10.10.10.100",
    poolRangeEnd: "10.10.10.250",
    dhcpServerName: "dhcp-hotspot",
    leaseTime: "1h",
    dnsServers: "1.1.1.1,8.8.8.8",
    portalDomain: "wifi.example.com",
    apiDomain: "api.example.com",
    radiusServerIp: "10.10.10.10",
    radiusSecret: "change_me_radius_secret",
    radiusSrcAddress: "10.10.10.1",
    radiusTimeout: version === "v7" ? "1100ms" : "1s",
    radiusInterimUpdate: "5m",
    nasIdentifier: "mikrotik-academia",
    nasPortType: "wireless-802.11",
    createWalledGarden: true,
    createApiWalledGarden: true,
    createDhcp: true,
    configureDns: true,
  };
}

function buildWalledGarden(config: MikrotikScriptConfig): string[] {
  const lines: string[] = [];

  if (!config.createWalledGarden) {
    return lines;
  }

  lines.push("# Walled garden");
  lines.push(
    `/ip hotspot walled-garden add server=${config.hotspotName} dst-host=${config.portalDomain}`,
  );

  if (config.createApiWalledGarden && config.apiDomain && config.apiDomain !== config.portalDomain) {
    lines.push(
      `/ip hotspot walled-garden add server=${config.hotspotName} dst-host=${config.apiDomain}`,
    );
  }

  return lines;
}

export function generateMikrotikScript(config: MikrotikScriptConfig): string {
  const lines: string[] = [];

  lines.push(`# RouterOS ${config.version} - HotSpot + RADIUS para captive portal`);
  lines.push("# Ajuste os valores antes de executar em producao.");
  lines.push("");

  if (config.configureDns) {
    lines.push("# DNS local");
    lines.push(`/ip dns set allow-remote-requests=yes servers=${config.dnsServers}`);
    lines.push("");
  }

  if (config.createDhcp) {
    lines.push("# Pool e DHCP");
    lines.push(
      `/ip pool add name=${config.poolName} ranges=${config.poolRangeStart}-${config.poolRangeEnd}`,
    );
    lines.push(
      `/ip dhcp-server network add address=${config.hotspotNetwork} gateway=${config.hotspotAddress} dns-server=${config.hotspotAddress}`,
    );
    lines.push(
      `/ip dhcp-server add name=${config.dhcpServerName} interface=${config.hotspotInterface} address-pool=${config.poolName} lease-time=${config.leaseTime} disabled=no`,
    );
    lines.push("");
  }

  lines.push("# Profile do HotSpot");
  lines.push(
    `/ip hotspot profile add name=${config.hotspotProfileName} hotspot-address=${config.hotspotAddress} dns-name=${config.portalDomain} login-by=http-pap radius-accounting=yes radius-interim-update=${config.radiusInterimUpdate} use-radius=yes nas-port-type=${config.nasPortType}`,
  );
  lines.push("");

  lines.push("# Servidor HotSpot");
  lines.push(
    `/ip hotspot add name=${config.hotspotName} interface=${config.hotspotInterface} profile=${config.hotspotProfileName} address-pool=${config.poolName} disabled=no`,
  );
  lines.push("");

  lines.push("# Cliente RADIUS");
  lines.push(
    `/radius add service=hotspot address=${config.radiusServerIp} secret=${config.radiusSecret} authentication-port=1812 accounting-port=1813 src-address=${config.radiusSrcAddress} timeout=${config.radiusTimeout}`,
  );
  lines.push("");

  lines.push("# Garantir uso de RADIUS no profile");
  lines.push(
    `/ip hotspot profile set ${config.hotspotProfileName} use-radius=yes radius-accounting=yes radius-interim-update=${config.radiusInterimUpdate}`,
  );
  lines.push("");

  lines.push(...buildWalledGarden(config));

  if (config.createWalledGarden) {
    lines.push("");
  }

  lines.push("# Opcional: alinhar identidade do roteador ao NAS-Identifier");
  lines.push(`# /system identity set name=${config.nasIdentifier}`);

  if (config.version === "v7") {
    lines.push("");
    lines.push(
      "# RouterOS v7: se este HotSpot veio de instalacao antiga, revise o HTML/api.json para captive portal detection.",
    );
  }

  return lines.join("\n");
}

export function generateMikrotikValidationScript(config: MikrotikScriptConfig): string {
  return [
    `# Validacao RouterOS ${config.version}`,
    "/radius print detail",
    "/radius monitor 0",
    `/ip hotspot profile print detail where name=${config.hotspotProfileName}`,
    `/ip hotspot print detail where name=${config.hotspotName}`,
    `/ip hotspot walled-garden print where server=${config.hotspotName}`,
    '/log print where topics~"radius|hotspot"',
    "/ip hotspot active print",
  ].join("\n");
}

export function generateMikrotikNotes(config: MikrotikScriptConfig): string[] {
  const notes = [
    "Use `login-by=http-pap` neste projeto porque o backend entrega senha em hash para validacao no FreeRADIUS.",
    "Confirme que o `secret` no RouterOS e em `infra/freeradius/clients.conf` sao identicos.",
    "O `src-address` deve ser um IP do proprio MikroTik que alcance o servidor RADIUS.",
    "Se o portal e a API ficarem no mesmo dominio, voce pode desmarcar o walled garden extra da API.",
  ];

  if (config.version === "v6") {
    notes.push(
      "Em RouterOS v6, alguns equipamentos usam armazenamento em `/flash`; se voce personalizar HTML do HotSpot, valide o caminho do diretório.",
    );
    notes.push(
      "O gerador usa `timeout=1s` em v6 por compatibilidade ampla entre builds antigos.",
    );
  }

  if (config.version === "v7") {
    notes.push(
      "RouterOS v7 documenta `timeout=1100ms` no cliente RADIUS e suporte atual a captive portal detection via `api.json` nas versoes recentes.",
    );
  }

  return notes;
}
