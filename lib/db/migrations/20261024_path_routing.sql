BEGIN;
CREATE TABLE IF NOT EXISTS path_routing_cache (
  key text PRIMARY KEY,
  result jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS path_routing_cache_expiry_idx ON path_routing_cache(expires_at);
CREATE TABLE IF NOT EXISTS path_routing_usage (
  bucket text PRIMARY KEY,
  requests integer NOT NULL,
  expires_at timestamptz NOT NULL
);
COMMIT;
