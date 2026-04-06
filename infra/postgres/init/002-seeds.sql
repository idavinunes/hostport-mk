INSERT INTO plans (name, download_kbps, upload_kbps, quota_mb, session_timeout_seconds, idle_timeout_seconds, price_cents)
VALUES
  ('Visitante 10M', 10240, 10240, NULL, 14400, 900, 0),
  ('Aluno 50M', 51200, 51200, NULL, 28800, 900, 0)
ON CONFLICT (name) DO NOTHING;

INSERT INTO routers (name, nas_identifier, ip_address, site_name)
VALUES
  ('MikroTik Academia', 'mikrotik-academia', '10.10.10.1', 'Unidade Principal')
ON CONFLICT (nas_identifier) DO NOTHING;

INSERT INTO app_settings (
  id,
  company_name,
  legal_name,
  support_email,
  support_phone,
  portal_domain,
  api_domain,
  radius_server_ip,
  default_dns_servers,
  default_radius_interim_update,
  default_terms_version,
  default_privacy_version
)
VALUES (
  1,
  'Sua Academia',
  'Sua Academia LTDA',
  'infra@example.com',
  '+55 11 99999-9999',
  'wifi.example.com',
  'api.example.com',
  '10.10.10.10',
  '1.1.1.1,8.8.8.8',
  '5m',
  'v1',
  'v1'
)
ON CONFLICT (id) DO NOTHING;
