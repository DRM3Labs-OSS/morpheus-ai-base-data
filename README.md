# morpheus-ai-base-data

[![License CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-blue.svg)](./LICENSE)
[![CI](https://github.com/DRM3Labs-OSS/morpheus-ai-base-data/actions/workflows/ci.yml/badge.svg)](https://github.com/DRM3Labs-OSS/morpheus-ai-base-data/actions/workflows/ci.yml)
[![Provenance Ed25519 signed](https://img.shields.io/badge/Provenance-Ed25519_signed-2ea44f.svg)](./morpheus-ai-base-data.receipt.json)
[![Data Morpheus on Base](https://img.shields.io/badge/Data-Morpheus_on_Base-6f42c1.svg)](#coverage)
[![Format SQLite / DuckDB](https://img.shields.io/badge/Format-SQLite_%2F_DuckDB-fe7d37.svg)](#open-it)
[![Watermark block 48241881 / 2026-07-05](https://img.shields.io/badge/Watermark-block_48241881_%2F_2026--07--05-informational.svg)](./manifest.json)

A signed, portable snapshot of the **Morpheus AI network's on-chain activity on Base mainnet**, decoded from raw events into a queryable SQL database. One gzip file, one manifest, one provenance receipt you can verify against a key committed to this repo.

The snapshot in this repo covers Base mainnet through block **48241881** (see [`manifest.json`](./manifest.json) for the exact watermark, row counts, and hashes of the copy you hold).

## Updates

DRM3 Labs publishes refreshed snapshots periodically. Each snapshot is signed and carries its own watermark block and date, and the latest release is always the current one.

## Coverage

Coverage is per contract, not uniform: each part of the dataset scans a contract from its Base deploy block, the first block on Base where that contract has code. The overall span runs from Base block **15,002,375 (2024-05-27)**, where the MOR token was deployed on Base, to the watermark at block **48,241,881 (2026-07-05)**. This dataset reaches back to each contract's Base day one.

| Data | From block | From date | To block | To date |
|------|-----------|-----------|----------|---------|
| MOR holders | 15,002,375 | 2024-05-27 | 48,241,881 | 2026-07-05 |
| Builder subnets/stakes | 24,381,796 | 2024-12-30 | 48,241,881 | 2026-07-05 |
| Compute sessions | 39,593,197 | 2025-12-17 | 48,241,881 | 2026-07-05 |
| MOR/USD price | n/a | 2026-04-05 | n/a | 2026-07-05 |

Compute moved to Base recently, so the sessions and marketplace tables begin at the compute contract's Base deploy block 39,593,197 (2025-12-17); the token and builder history run much deeper. The `price_history` series is a separate case: it is a roughly 90-day recording window (2026-04-05 to 2026-07-05, the point at which price recording started), not a replay from the token's DEX origin. Read it as recent price coverage, distinct from the event-derived tables.

## Why this exists

The Morpheus network runs on Base as a stream of smart-contract events: sessions opened and closed, bids posted, stake deposited, tokens transferred. Read directly, that is raw logs and ABI decoding, and reconstructing the current state means replaying close to two years of Base blocks (the MOR token was deployed on Base at block 15,002,375 in May 2024, roughly 33 million blocks back). This dataset is that activity already decoded and reconciled into clean tables, so you can study the network or bootstrap your own index without running a full historical sync.

It is public, verifiable, and reproducible. The numbers are re-derivable by anyone from Base; the signature attests who produced this copy and that it has not been altered. Everything here is CC0 (public domain).

For exactly how raw Base chain events become these tables, and how to reproduce the dataset yourself, see [`docs/METHODOLOGY.md`](./docs/METHODOLOGY.md): the indexed contracts and event-to-table mapping, the forward projector plus historical backfill, the completeness watermark, and the snapshot signing and verification steps.

## What is in it

A single SQLite-compatible SQL dump of 15 tables. Highlights of the current snapshot, with the coverage of each:

| Data | Count | From block | From date | To block | To date |
|------|-------|-----------|-----------|----------|---------|
| Compute sessions | 113,200 | 39,593,197 | 2025-12-17 | 48,241,881 | 2026-07-05 |
| MOR holders | 18,061 wallets | 15,002,375 | 2024-05-27 | 48,241,881 | 2026-07-05 |
| Compute providers | 21 | 39,593,197 | 2025-12-17 | 48,241,881 | 2026-07-05 |
| Model bids | 403 across 102 models | 39,593,197 | 2025-12-17 | 48,241,881 | 2026-07-05 |
| Builder subnets/stakes | 280 / 262 | 24,381,796 | 2024-12-30 | 48,241,881 | 2026-07-05 |
| MOR/USD price | 2,406 | n/a | 2026-04-05 | n/a | 2026-07-05 |

Compressed size is 15.8 MB gzip (84.8 MB raw). Full per-table counts are in [`manifest.json`](./manifest.json). The schema is [`schema.sql`](./schema.sql), and it is the exact schema the data was dumped under.

## Uses

Concrete ways to consume this snapshot:

- **Network research and analytics.** Sessions, providers, bids, stake, and holders in clean SQL: rank providers by throughput, chart usage over time, size the holder distribution, study the builder program, without touching a node.
- **Dashboards without a node.** Point SQLite or DuckDB at the file and drive charts and tables directly. The data is already decoded and reconciled, so a dashboard is a few queries, not an indexer.
- **Bootstrap your own index.** Load the snapshot, then resume live sync from `watermark_block` instead of replaying from each contract's Base deploy block. You start caught up to 2026-07-05 and only fetch the delta from there.
- **Feed an AI agent.** Hand an agent [`schema.sql`](./schema.sql), the data dictionary below, and [`queries/examples.sql`](./queries/examples.sql), and it can answer network questions against a local database. [`llms.txt`](./llms.txt) is the fetch-verify-query runbook for exactly that.
- **Cross-check a published stat.** Any Morpheus number you see elsewhere (session counts, provider standings, supply, price) can be checked against this snapshot, and in turn re-derived from Base with the filters in [`docs/METHODOLOGY.md`](./docs/METHODOLOGY.md).

## Files

| File | What it is | In git? |
|------|-----------|---------|
| `morpheus-ai-base-data-<block>.sql.gz` | the data, gzip'd SQL | no, it is a [Release](../../releases) asset |
| `schema.sql` | table + index definitions | yes |
| `manifest.json` | watermark, row counts, sha256, sizes | yes |
| `morpheus-ai-base-data.receipt.json` | Ed25519 provenance receipt over the manifest | yes |
| `keys.json` | the dataset public key (verification anchor) | yes |
| `verify.mjs` | one-command verifier | yes |
| `queries/examples.sql` | worked example queries | yes |
| `docs/METHODOLOGY.md` | how the data is produced from Base, and how to reproduce it | yes |

The data blob is large and changes each snapshot, so it lives as a Release download. Everything needed to verify and understand it is committed here.

## Verify it

Verification uses only files in this repo. No network calls, no dependency on any live service.

```bash
npm install
node verify.mjs morpheus-ai-base-data-<block>.sql.gz
```

This checks that the blob's sha256 matches the manifest, that the receipt's signature is valid, that it was signed by the key in [`keys.json`](./keys.json), that the receipt commits to this exact manifest, and that `schema.sql` matches its manifest hash. A pass means these bytes were produced and signed by the holder of the dataset key and were not tampered with in transit.

To check the repo without the Release blob (the four signature and schema checks, no sha256 of the data), run:

```bash
npm run check
```

Prefer to check the blob by hand:

```bash
shasum -a 256 morpheus-ai-base-data-<block>.sql.gz   # compare to "sha256" in manifest.json
```

## Open it

Build a local database, then query it with SQLite or DuckDB.

```bash
gunzip -k morpheus-ai-base-data-<block>.sql.gz
sqlite3 morpheus.db < schema.sql
sqlite3 morpheus.db < morpheus-ai-base-data-<block>.sql
```

**SQLite:**

```bash
sqlite3 morpheus.db "SELECT provider, COUNT(*) AS sessions
                     FROM sessions GROUP BY provider ORDER BY sessions DESC LIMIT 5;"
```

**DuckDB** (attach the SQLite file directly, no conversion):

```bash
duckdb -c "INSTALL sqlite; LOAD sqlite; ATTACH 'morpheus.db' AS m (TYPE sqlite);
           SELECT COUNT(*) FROM m.mor_holders WHERE CAST(mor_balance_wei AS DOUBLE) > 0;"
```

More in [`queries/examples.sql`](./queries/examples.sql).

## Quick answers

Real questions, answered against the snapshot in this repo:

```sql
-- Top providers by lifetime compute sessions served
SELECT provider, COUNT(*) AS sessions
FROM sessions GROUP BY provider ORDER BY sessions DESC LIMIT 5;
-- 0xb399e0009784bf0eb871e946643c92dc1055e362   58123
-- 0x5a42cb63f5e994ae01c38e4b515b954ecd092d08   52674
```

```sql
-- Holders and total MOR held
SELECT COUNT(*) AS holders,
       ROUND(SUM(CAST(mor_balance_wei AS REAL)) / 1e18) AS total_mor
FROM mor_holders WHERE CAST(mor_balance_wei AS REAL) > 0;
-- 14553 holders, about 4.74M MOR
```

```sql
-- MOR/USD range over the recorded 90-day series
SELECT ROUND(MIN(usd), 4) AS low, ROUND(MAX(usd), 4) AS high, COUNT(*) AS points
FROM price_history;
-- low 1.2839, high 3.6542, over 2406 points
```

## Data dictionary

Amounts that live on-chain are stored as **wei-scale decimal strings** (18 decimals); divide by `1e18` for whole MOR. Timestamps are **unix seconds, UTC**. Addresses are lowercase hex. `updated_block` columns record the Base block a row was last touched at.

### MOR price and market

**`price_history`** is the MOR/USD time series, read on-chain from a Base DEX (no third-party price feed), roughly one point every ten minutes. Coverage is a recent, roughly 90-day recording window: 2026-04-05 to 2026-07-05, from the point price recording started, not from the token's DEX origin. It powers change-over-time and charting, and is an independent on-chain record of the token's price without trusting an exchange API.

| column | type | meaning |
|--------|------|---------|
| `ts` | INTEGER | unix seconds (primary key) |
| `usd` | REAL | MOR price in USD |
| `eth_usd` | REAL | ETH price in USD at the same read |

**`network_economics`** is a single current-state row: circulating and total MOR supply, the compute balance, today's emission budget, and the staking factor. **`economics_history`** is the same figures snapshotted per day, so you can see how emissions and the staking factor move. Economics coverage tracks the compute contract, from block 39,593,197 (2025-12-17) forward.

| `network_economics` | type | meaning |
|--------|------|---------|
| `compute_balance` | TEXT | MOR in the compute pool (wei) |
| `total_mor_supply` | TEXT | total MOR supply (wei) |
| `todays_budget` | TEXT | today's emission budget (wei) |
| `staking_factor` | REAL | current staking factor |
| `total_supply` | TEXT | total supply including locked (wei) |

| `economics_history` | type | meaning |
|--------|------|---------|
| `date` | TEXT | UTC date `YYYY-MM-DD` (primary key) |
| `compute_balance` | TEXT | compute balance that day (wei) |
| `total_mor_supply` | TEXT | supply that day (wei) |
| `staking_factor` | REAL | staking factor that day |
| `providers_claimed` | TEXT | MOR claimed by providers that day (wei) |

### Holders

**`mor_holders`** is one row per wallet that has ever held MOR, with current MOR and ETH balances read from Base. It covers the token from its Base deploy block 15,002,375 (2024-05-27) to the watermark, and answers who holds the network's token and in what size. Balances reflect the snapshot; holders discovered but not yet balance-checked carry `updated_at = 0`.

| column | type | meaning |
|--------|------|---------|
| `wallet` | TEXT | holder address (primary key) |
| `mor_balance_wei` | TEXT | MOR balance (wei) |
| `eth_balance_wei` | TEXT | ETH balance (wei) |
| `last_transfer_block` | INTEGER | last block this wallet moved MOR |
| `has_sessions` | INTEGER | 1 if the wallet has opened compute sessions |
| `updated_at` | INTEGER | unix seconds of the last balance read (0 = pending) |

### Compute sessions

**`sessions`** is the core usage signal: each row is a Morpheus compute session, where a consumer stakes/pays to use a provider's AI inference for a bounded period. It covers the compute contract from block 39,593,197 (2025-12-17) to the watermark, and carries the provider, the model, the stake, open/close times, how it ended, and the on-chain transaction hashes. Session volume is the most direct measure of real network usage.

| column | type | meaning |
|--------|------|---------|
| `id` | TEXT | session id (primary key) |
| `user_address` | TEXT | consumer wallet |
| `bid_id` | TEXT | the bid this session was opened against |
| `provider` | TEXT | provider address |
| `model_id` | TEXT | model served |
| `stake` | TEXT | staked amount (wei) |
| `opened_at` / `closed_at` / `ends_at` | INTEGER | lifecycle timestamps (unix seconds) |
| `is_active` | INTEGER | 1 while open |
| `closeout_type` | INTEGER | how it ended (normal, early, dispute) |
| `provider_withdrawn` | TEXT | amount the provider withdrew (wei) |
| `open_tx_hash` / `close_tx_hash` | TEXT | Base transaction hashes |
| `updated_block` | INTEGER | last block this row changed at |

**`wallet_stats`** is a per-wallet rollup of session activity (totals, active vs closed, historical stake, average duration) for fast per-user views.

### Providers

**`providers`** lists the compute providers serving inference, with their advertised endpoint and total stake. **`provider_stats`** is per-provider, per-model performance: sessions served, successes, disputes, throughput, and time-to-first-token. Both derive from the compute contract, block 39,593,197 (2025-12-17) forward, and together show who is serving the network and how well.

| `providers` | type | meaning |
|--------|------|---------|
| `address` | TEXT | provider address (primary key) |
| `endpoint` | TEXT | advertised inference endpoint |
| `stake` | TEXT | total stake (wei) |
| `updated_block` | INTEGER | last block this row changed at |

| `provider_stats` | type | meaning |
|--------|------|---------|
| `provider` + `model_id` | TEXT | composite key |
| `total_sessions` / `success_count` / `dispute_count` / `early_termination_count` | INTEGER | outcome counts |
| `tps_scaled` | INTEGER | tokens/sec, scaled |
| `ttft_ms` | INTEGER | mean time to first token (ms) |
| `avg_duration_secs` | INTEGER | mean session duration |

### Marketplace: bids and models

**`bids`** is the provider-side marketplace: a provider offering to serve a specific model at a price per second. It covers the compute contract from block 39,593,197 (2025-12-17) to the watermark. A deleted bid has `deleted_at` set. **`models`** is the catalog of models referenced by bids and sessions.

| `bids` | type | meaning |
|--------|------|---------|
| `bid_id` | TEXT | bid id (primary key) |
| `provider` | TEXT | provider address |
| `model_id` | TEXT | model offered |
| `price_per_second` | TEXT | price (wei/second) |
| `nonce` | INTEGER | bid nonce |
| `deleted_at` | INTEGER | set when retracted (NULL = active) |
| `updated_block` | INTEGER | last block this row changed at |

| `models` | type | meaning |
|--------|------|---------|
| `model_id` | TEXT | model id (primary key) |
| `name` / `description` | TEXT | human labels |
| `tags` | TEXT | tag list |

### Builders program

The Morpheus Builders program funds agents and apps through subnets that MOR is staked into. These tables cover BuildersV4 from its Base deploy block 24,381,796 (2024-12-30) to the watermark. **`builder_subnets`** is one row per subnet (name, admin, deposit rules, totals, metadata). **`builder_stakes`** is per-wallet stake in a subnet. **`builder_events`** is the raw deposit/withdraw/claim event log behind those totals.

| `builder_subnets` | type | meaning |
|--------|------|---------|
| `subnet_id` | TEXT | subnet id (primary key) |
| `name` / `metadata_*` | TEXT | subnet identity and metadata |
| `admin` / `claim_admin` | TEXT | controlling addresses |
| `minimal_deposit` / `total_deposited` / `pending_rewards` | TEXT | economics (wei) |
| `withdraw_lock_period` | INTEGER | lock seconds |
| `staker_count` | TEXT | number of stakers |

| `builder_stakes` | type | meaning |
|--------|------|---------|
| `subnet_id` + `wallet` | TEXT | who staked where (unique) |
| `deposited` | TEXT | amount staked (wei) |
| `last_deposit_at` / `unlock_at` | INTEGER | timing |

| `builder_events` | type | meaning |
|--------|------|---------|
| `event_type` | TEXT | deposit / withdraw / claim / ... |
| `subnet_id` / `wallet` | TEXT | subnet and actor |
| `amount` | TEXT | amount (wei) |
| `tx_hash` / `block_number` / `log_index` / `block_timestamp` | | on-chain location |

### Supporting

**`gas_costs`** records the gas used and ETH cost of indexed transactions (open, close, and so on), keyed by transaction hash, for cost analysis. **`diamond_upgrades`** logs upgrades to the Morpheus diamond proxy contract (which facets changed, at which block), useful for correlating behavior changes with contract upgrades.

## Tables

The dump is the 15 chain-derived tables above; `manifest.json` records the included tables under `tables` and the excluded ones under `excluded_tables`.

## Provenance

DRM3 Labs produces and signs each snapshot. The Ed25519 receipt proves authorship and integrity: these exact bytes came from the holder of the dataset key in `keys.json`, unaltered. Every figure is derived from Base mainnet and re-derivable there by anyone.

`watermark_block` is the Base block through which both the event stream and the builder stream are complete. Rows a few blocks past the watermark may be present, since indexing is continuous, but are not guaranteed complete; treat the watermark as the completeness line.

## How it is produced

The snapshot is built by [`scripts/make-snapshot.mjs`](./scripts/make-snapshot.mjs) against a source database that holds the decoded index (schema in `schema.sql`). It reads the watermark, exports the tables above as a data-only SQL dump, captures the schema, gzips and hashes the blob, writes the manifest, and signs a provenance receipt with the `dataset/morpheus-base` key. The source index and signing key are passed in by environment (`SOURCE_DB`, `DATASET_SIGNING_MNEMONIC`), so the tool is not wired to any one operator.

The full account, from Base chain events all the way to the signed blob (indexed contracts and addresses, the event-to-table mapping, the read layer, decode and normalization rules, the watermark, and reproducibility), is in [`docs/METHODOLOGY.md`](./docs/METHODOLOGY.md).

## License

[CC0 1.0 Universal](./LICENSE). Public domain dedication. Use it for anything, no attribution required. (CC0 covers the data. It waives copyright, not trademarks or patents.)
</content>
</invoke>
