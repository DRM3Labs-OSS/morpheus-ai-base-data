PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE providers (address TEXT PRIMARY KEY, endpoint TEXT, stake TEXT DEFAULT '0', created_at INTEGER, updated_block INTEGER);
CREATE TABLE bids (bid_id TEXT PRIMARY KEY, provider TEXT, model_id TEXT, price_per_second TEXT, nonce INTEGER, created_at INTEGER, deleted_at INTEGER, updated_block INTEGER);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_address TEXT, bid_id TEXT, provider TEXT, model_id TEXT, stake TEXT DEFAULT '0', opened_at INTEGER DEFAULT 0, ends_at INTEGER DEFAULT 0, closed_at INTEGER DEFAULT 0, is_active INTEGER DEFAULT 0, updated_block INTEGER, closeout_type INTEGER DEFAULT 0, provider_withdrawn TEXT DEFAULT '0', open_tx_hash TEXT DEFAULT NULL, close_tx_hash TEXT DEFAULT NULL);
CREATE TABLE models (model_id TEXT PRIMARY KEY, name TEXT, tags TEXT, updated_at INTEGER, description TEXT, created_at INTEGER);
CREATE TABLE api_keys (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, rate_limit INTEGER DEFAULT 1000, created_at INTEGER NOT NULL, last_used_at INTEGER, daily_cap INTEGER, monthly_cap INTEGER);
CREATE TABLE provider_stats (provider TEXT, model_id TEXT, success_count INTEGER DEFAULT 0, dispute_count INTEGER DEFAULT 0, early_termination_count INTEGER DEFAULT 0, total_sessions INTEGER DEFAULT 0, tps_scaled INTEGER DEFAULT 0, ttft_ms INTEGER DEFAULT 0, updated_at INTEGER, avg_duration_secs INTEGER DEFAULT 0, PRIMARY KEY (provider, model_id));
CREATE TABLE gas_costs (tx_hash TEXT PRIMARY KEY, session_id TEXT, operation TEXT, gas_used INTEGER, gas_price TEXT, eth_cost TEXT, block_number INTEGER, fetched_at INTEGER);
CREATE TABLE network_economics (id INTEGER PRIMARY KEY CHECK (id = 1), compute_balance TEXT, total_mor_supply TEXT, todays_budget TEXT, staking_factor REAL, updated_at INTEGER, total_supply TEXT);
CREATE TABLE economics_history (date TEXT PRIMARY KEY, compute_balance TEXT, total_mor_supply TEXT, staking_factor REAL, providers_claimed TEXT);
CREATE TABLE provenance_receipts (id TEXT PRIMARY KEY, action TEXT NOT NULL, timestamp TEXT NOT NULL, input_hash TEXT NOT NULL, output_hash TEXT NOT NULL, public_key TEXT NOT NULL, signature TEXT NOT NULL, receipt_json TEXT NOT NULL, chain_root TEXT, chain_id TEXT);
CREATE TABLE signer_attestations (derived_address TEXT PRIMARY KEY, staking_wallet TEXT NOT NULL, signature TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE ci_wallets (wallet TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE builder_subnets (subnet_id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', admin TEXT NOT NULL DEFAULT '', claim_admin TEXT DEFAULT '', minimal_deposit TEXT DEFAULT '0', withdraw_lock_period INTEGER DEFAULT 604800, total_deposited TEXT DEFAULT '0', pending_rewards TEXT DEFAULT '0', created_at INTEGER, updated_at INTEGER, metadata_name TEXT DEFAULT '', metadata_description TEXT DEFAULT '', metadata_url TEXT DEFAULT '', metadata_logo TEXT DEFAULT '', staker_count TEXT DEFAULT '', chain TEXT DEFAULT NULL);
CREATE TABLE builder_stakes (id INTEGER PRIMARY KEY AUTOINCREMENT, subnet_id TEXT NOT NULL, wallet TEXT NOT NULL, deposited TEXT DEFAULT '0', last_deposit_at INTEGER, unlock_at INTEGER, created_at INTEGER, updated_at INTEGER, UNIQUE(subnet_id, wallet));
CREATE TABLE builder_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, subnet_id TEXT NOT NULL, wallet TEXT, amount TEXT, tx_hash TEXT, block_number INTEGER, block_timestamp INTEGER, log_index INTEGER);
CREATE TABLE builder_sync_state (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE service_attestations (id TEXT PRIMARY KEY, service TEXT NOT NULL DEFAULT 'cashew', merkle_root TEXT NOT NULL, receipt_count INTEGER NOT NULL, from_timestamp TEXT NOT NULL, to_timestamp TEXT NOT NULL, signature TEXT NOT NULL, public_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE mor_holders (wallet TEXT PRIMARY KEY, mor_balance_wei TEXT DEFAULT '0', eth_balance_wei TEXT DEFAULT '0', last_transfer_block INTEGER, has_sessions INTEGER DEFAULT 0, updated_at INTEGER);
CREATE TABLE key_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  key TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  expected_valid_until TEXT,
  status TEXT NOT NULL CHECK(status IN ('current','superseded','compromised','revoked','retired')),
  rotation_reason TEXT,
  note TEXT,
  UNIQUE(path, key)
);
CREATE TABLE diamond_upgrades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_number INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      log_index INTEGER NOT NULL,
      facet_changes TEXT NOT NULL,
      facet_count INTEGER NOT NULL,
      block_timestamp INTEGER NOT NULL,
      UNIQUE(tx_hash, log_index)
    );
CREATE TABLE wallet_stats (
        wallet TEXT PRIMARY KEY,
        total_sessions INTEGER DEFAULT 0,
        active_sessions INTEGER DEFAULT 0,
        closed_sessions INTEGER DEFAULT 0,
        claimable_sessions INTEGER DEFAULT 0,
        active_stake_wei REAL DEFAULT 0,
        claimable_stake_wei REAL DEFAULT 0,
        total_historical_wei REAL DEFAULT 0,
        first_session INTEGER,
        last_session INTEGER,
        avg_duration_sec REAL,
        updated_at INTEGER
      );
CREATE TABLE usage_counters (key_id TEXT NOT NULL, bucket TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (key_id, bucket));
CREATE TABLE notify_list (email TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE price_history (ts INTEGER PRIMARY KEY, usd REAL, eth_usd REAL);
CREATE TABLE alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, level TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, resolved INTEGER DEFAULT 0);
DELETE FROM sqlite_sequence;
CREATE INDEX idx_sessions_user_address ON sessions(user_address);
CREATE INDEX idx_sessions_active ON sessions(is_active, ends_at);
CREATE INDEX idx_sessions_opened ON sessions(opened_at DESC);
CREATE INDEX idx_prov_action ON provenance_receipts(action);
CREATE INDEX idx_prov_timestamp ON provenance_receipts(timestamp DESC);
CREATE INDEX idx_attestations_wallet ON signer_attestations(staking_wallet);
CREATE INDEX idx_builder_stakes_wallet ON builder_stakes(wallet);
CREATE INDEX idx_builder_stakes_subnet ON builder_stakes(subnet_id);
CREATE INDEX idx_builder_events_subnet ON builder_events(subnet_id);
CREATE INDEX idx_builder_events_block ON builder_events(block_number DESC);
CREATE INDEX idx_builder_events_type ON builder_events(event_type);
CREATE INDEX idx_sessions_provider ON sessions(provider);
CREATE INDEX idx_sessions_model_id ON sessions(model_id);
CREATE INDEX idx_sessions_bid_id ON sessions(bid_id);
CREATE INDEX idx_sessions_closeout ON sessions(closeout_type, closed_at DESC);
CREATE INDEX idx_bids_provider ON bids(provider);
CREATE INDEX idx_bids_model_id ON bids(model_id);
CREATE INDEX idx_bids_active ON bids(deleted_at);
CREATE INDEX idx_gas_costs_session ON gas_costs(session_id);
CREATE INDEX idx_sessions_user ON sessions(user_address, opened_at DESC);
CREATE INDEX idx_bids_deleted ON bids(deleted_at);
CREATE UNIQUE INDEX idx_builder_events_dedup ON builder_events (tx_hash, log_index, event_type);
CREATE INDEX idx_sessions_provider_model ON sessions(provider, model_id);
CREATE INDEX idx_alerts_ts ON alerts(ts DESC);
CREATE INDEX idx_sessions_closed_at ON sessions(closed_at DESC);
CREATE INDEX idx_mor_holders_updated ON mor_holders(updated_at);
