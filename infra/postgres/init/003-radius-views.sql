CREATE TABLE radacct (
  radacctid BIGSERIAL PRIMARY KEY,
  acctsessionid TEXT NOT NULL,
  acctuniqueid TEXT NOT NULL UNIQUE,
  username TEXT,
  realm TEXT,
  nasipaddress INET,
  nasportid TEXT,
  nasporttype TEXT,
  acctstarttime TIMESTAMPTZ,
  acctupdatetime TIMESTAMPTZ,
  acctstoptime TIMESTAMPTZ,
  acctinterval INTEGER,
  acctsessiontime BIGINT,
  acctauthentic TEXT,
  connectinfo_start TEXT,
  connectinfo_stop TEXT,
  acctinputoctets BIGINT,
  acctoutputoctets BIGINT,
  calledstationid TEXT,
  callingstationid TEXT,
  acctterminatecause TEXT,
  servicetype TEXT,
  framedprotocol TEXT,
  framedipaddress INET,
  nasidentifier TEXT,
  class TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_radacct_username ON radacct(username);
CREATE INDEX idx_radacct_session ON radacct(acctsessionid);
CREATE INDEX idx_radacct_active ON radacct(acctstoptime);

CREATE TABLE radpostauth (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  pass TEXT,
  reply TEXT,
  authdate TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE radgroupcheck (
  id BIGSERIAL PRIMARY KEY,
  groupname TEXT NOT NULL,
  attribute TEXT NOT NULL,
  op TEXT NOT NULL DEFAULT ':=',
  value TEXT NOT NULL
);

CREATE TABLE radgroupreply (
  id BIGSERIAL PRIMARY KEY,
  groupname TEXT NOT NULL,
  attribute TEXT NOT NULL,
  op TEXT NOT NULL DEFAULT ':=',
  value TEXT NOT NULL
);

CREATE TABLE radusergroup (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  groupname TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE nas (
  id BIGSERIAL PRIMARY KEY,
  nasname TEXT NOT NULL,
  shortname TEXT,
  type TEXT DEFAULT 'other',
  ports INTEGER,
  secret TEXT,
  server TEXT,
  community TEXT,
  description TEXT
);

CREATE OR REPLACE VIEW radius_active_plans AS
SELECT DISTINCT ON (cp.client_id)
  cp.client_id,
  p.id AS plan_id,
  p.name AS plan_name,
  p.download_kbps,
  p.upload_kbps,
  p.quota_mb,
  p.session_timeout_seconds,
  p.idle_timeout_seconds
FROM client_plans cp
JOIN plans p ON p.id = cp.plan_id
WHERE cp.active = TRUE
  AND p.active = TRUE
  AND (cp.ends_at IS NULL OR cp.ends_at > NOW())
ORDER BY cp.client_id, cp.starts_at DESC, cp.created_at DESC;

CREATE OR REPLACE VIEW radcheck AS
SELECT
  ROW_NUMBER() OVER (ORDER BY c.created_at, c.id)::BIGINT AS id,
  c.wifi_username AS username,
  'Crypt-Password'::TEXT AS attribute,
  c.wifi_password_hash AS value,
  ':='::TEXT AS op
FROM clients c
WHERE c.status = 'active';

CREATE OR REPLACE VIEW radreply AS
SELECT
  ROW_NUMBER() OVER (ORDER BY src.username, src.attribute)::BIGINT AS id,
  src.username,
  src.attribute,
  src.value,
  ':='::TEXT AS op
FROM (
  SELECT
    c.wifi_username AS username,
    'Mikrotik-Rate-Limit'::TEXT AS attribute,
    format('%sk/%sk', rap.download_kbps, rap.upload_kbps) AS value
  FROM clients c
  JOIN radius_active_plans rap ON rap.client_id = c.id
  WHERE c.status = 'active'

  UNION ALL

  SELECT
    c.wifi_username,
    'Session-Timeout'::TEXT,
    rap.session_timeout_seconds::TEXT
  FROM clients c
  JOIN radius_active_plans rap ON rap.client_id = c.id
  WHERE c.status = 'active'
    AND rap.session_timeout_seconds IS NOT NULL

  UNION ALL

  SELECT
    c.wifi_username,
    'Idle-Timeout'::TEXT,
    rap.idle_timeout_seconds::TEXT
  FROM clients c
  JOIN radius_active_plans rap ON rap.client_id = c.id
  WHERE c.status = 'active'
    AND rap.idle_timeout_seconds IS NOT NULL
) src;

