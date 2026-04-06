CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_type TEXT NOT NULL CHECK (registration_type IN ('visitor', 'member')),
  full_name TEXT NOT NULL,
  cpf_ciphertext BYTEA,
  cpf_hash TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  wifi_username TEXT NOT NULL UNIQUE,
  wifi_password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'inactive')),
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  download_kbps INTEGER NOT NULL CHECK (download_kbps > 0),
  upload_kbps INTEGER NOT NULL CHECK (upload_kbps > 0),
  quota_mb BIGINT,
  session_timeout_seconds INTEGER,
  idle_timeout_seconds INTEGER,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE client_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  mac_ciphertext BYTEA NOT NULL,
  mac_hash TEXT NOT NULL UNIQUE,
  nickname TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE routers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nas_identifier TEXT NOT NULL UNIQUE,
  routeros_version TEXT NOT NULL DEFAULT 'v7' CHECK (routeros_version IN ('v6', 'v7')),
  ip_address INET NOT NULL,
  site_name TEXT,
  integration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  management_transport TEXT NOT NULL DEFAULT 'api' CHECK (management_transport IN ('api', 'api-ssl')),
  management_port INTEGER NOT NULL DEFAULT 8728 CHECK (management_port > 0 AND management_port <= 65535),
  management_username TEXT,
  management_password_ciphertext BYTEA,
  management_verify_tls BOOLEAN NOT NULL DEFAULT FALSE,
  voucher_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  online_monitoring_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  hotspot_interface TEXT NOT NULL DEFAULT 'bridge-lan',
  hotspot_name TEXT NOT NULL DEFAULT 'hotspot-academia',
  hotspot_profile_name TEXT NOT NULL DEFAULT 'hsprof-academia',
  hotspot_address INET NOT NULL DEFAULT '10.10.10.1',
  hotspot_network TEXT NOT NULL DEFAULT '10.10.10.0/24',
  pool_name TEXT NOT NULL DEFAULT 'pool-hotspot',
  pool_range_start INET NOT NULL DEFAULT '10.10.10.100',
  pool_range_end INET NOT NULL DEFAULT '10.10.10.250',
  dhcp_server_name TEXT NOT NULL DEFAULT 'dhcp-hotspot',
  lease_time TEXT NOT NULL DEFAULT '1h',
  nas_port_type TEXT NOT NULL DEFAULT 'wireless-802.11',
  radius_src_address INET NOT NULL DEFAULT '10.10.10.1',
  radius_timeout TEXT NOT NULL DEFAULT '1100ms',
  radius_interim_update TEXT NOT NULL DEFAULT '5m',
  configure_dns BOOLEAN NOT NULL DEFAULT TRUE,
  create_dhcp BOOLEAN NOT NULL DEFAULT TRUE,
  create_walled_garden BOOLEAN NOT NULL DEFAULT TRUE,
  create_api_walled_garden BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  router_id UUID NOT NULL REFERENCES routers(id) ON DELETE RESTRICT,
  username TEXT NOT NULL UNIQUE,
  password_ciphertext BYTEA NOT NULL,
  comment TEXT,
  profile_name TEXT,
  server_name TEXT,
  limit_uptime TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_error TEXT,
  mikrotik_user_id TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL,
  legal_name TEXT,
  support_email TEXT,
  support_phone TEXT,
  portal_domain TEXT NOT NULL,
  api_domain TEXT NOT NULL,
  radius_server_ip INET NOT NULL,
  default_dns_servers TEXT NOT NULL DEFAULT '1.1.1.1,8.8.8.8',
  default_radius_interim_update TEXT NOT NULL DEFAULT '5m',
  default_terms_version TEXT NOT NULL DEFAULT 'v1',
  default_privacy_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  source_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_devices_client_id ON devices(client_id);
CREATE INDEX idx_client_plans_client_active ON client_plans(client_id, active);
CREATE INDEX idx_routers_nas_identifier ON routers(nas_identifier);
CREATE INDEX idx_vouchers_router_id ON vouchers(router_id);

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_routers_updated_at
BEFORE UPDATE ON routers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vouchers_updated_at
BEFORE UPDATE ON vouchers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
