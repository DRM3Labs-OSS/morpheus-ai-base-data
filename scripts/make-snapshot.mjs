#!/usr/bin/env node
// make-snapshot.mjs - produce the signed morpheus-ai-base-data snapshot.
//
// This is the dataset's reproducibility story: given read access to a source
// Cloudflare D1 that holds a decoded index of the Morpheus AI network on Base
// (the schema in schema.sql), it exports the chain-derived tables up to a
// watermark block and produces:
//
//   dist/morpheus-ai-base-data-<block>.sql.gz  gzip'd data-only SQL (Release asset)
//   schema.sql                                 the schema the data was dumped under
//   manifest.json                              watermark, row counts, sha256, sizes
//   morpheus-ai-base-data.receipt.json         Ed25519 provenance receipt over the manifest
//   keys.json                                  the dataset public key (in-repo verify anchor)
//
// The snapshot is signed with a dataset-specific key derived at
// `dataset/morpheus-base`, published in keys.json, so a consumer verifies with no
// network calls and the dataset stays verifiable wherever it lives.
//
// Environment:
//   DATASET_SIGNING_MNEMONIC  BIP39 mnemonic that owns dataset/morpheus-base (required)
//   SOURCE_DB                 source D1 database name          (default: morscan)
//   SOURCE_WRANGLER_CONFIG    path to the source wrangler config (optional; else
//                             wrangler's default resolution / global auth)
//   OUT_DIR                   where the blob is written        (default: ./dist)
//
// Requires an authed wrangler (wrangler login or CLOUDFLARE_API_TOKEN) with read
// access to the source D1. Read-only against it.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

const DATASET = 'morpheus-ai-base-data';
const SIGNER_PATH = 'dataset/morpheus-base';
const RECEIPT_FILE = `${DATASET}.receipt.json`;

const SOURCE_DB = process.env.SOURCE_DB || 'morscan';
const SOURCE_WRANGLER_CONFIG = process.env.SOURCE_WRANGLER_CONFIG || '';
const OUT_DIR = resolve(REPO, process.env.OUT_DIR || 'dist');
const MNEMONIC = process.env.DATASET_SIGNING_MNEMONIC || process.env.MORSCAN_MNEMONIC;

if (!MNEMONIC) {
  console.error('ERROR: DATASET_SIGNING_MNEMONIC is required (BIP39 mnemonic that owns dataset/morpheus-base).');
  process.exit(1);
}

// Chain-derived Morpheus network data - re-derivable by anyone from Base mainnet
// (plus the on-chain DEX reads for price). This is the dataset.
const SEED_TABLES = [
  'providers', 'bids', 'sessions', 'models', 'provider_stats', 'gas_costs',
  'network_economics', 'economics_history', 'builder_subnets', 'builder_stakes',
  'builder_events', 'mor_holders', 'diamond_upgrades', 'wallet_stats', 'price_history',
];

// Operational, secret, or indexer-identity tables - deliberately NOT shipped.
const EXCLUDED_TABLES = [
  { name: 'sync_state', reason: 'internal indexer sync cursors; a consumer resumes from watermark_block' },
  { name: 'builder_sync_state', reason: 'internal builder-sync cursor; consumer resumes from watermark_block' },
  { name: 'api_keys', reason: 'indexer API credentials (secret)' },
  { name: 'usage_counters', reason: 'indexer API usage counters (tied to api_keys)' },
  { name: 'config', reason: 'indexer configuration' },
  { name: 'ci_wallets', reason: 'indexer CI wallet allowlist' },
  { name: 'key_history', reason: "the indexer's own signing-key history (operational identity)" },
  { name: 'provenance_receipts', reason: "the indexer's per-response signatures over its cached data; the dataset carries its own signed receipt instead" },
  { name: 'signer_attestations', reason: "the indexer's signer identity (derived-address to staking-wallet binding)" },
  { name: 'service_attestations', reason: "the indexer's signed Merkle rollups (operational identity)" },
  { name: 'notify_list', reason: 'captured launch-list emails (PII)' },
  { name: 'alerts', reason: 'indexer operational alert log' },
];

const EPHEMERAL_SYNC_KEYS = new Set([
  'alert_state', 'backfill_cron_lock', 'full_sync_running', 'last_sync_ts',
  'last_rehydration_ts', 'last_rehydration_stale_count', 'mor_price',
  'mor_circulating_supply', 'token_prices', 'fatboy_cache',
  'mor_holder_backfill_elapsed_ms', 'mor_holder_backfill_started_at',
  'mor_holder_backfill_updated_at',
]);
const isEphemeralSyncKey = (k) =>
  EPHEMERAL_SYNC_KEYS.has(k) || k.startsWith('wallet:') || k.endsWith(':ts');

const configArgs = SOURCE_WRANGLER_CONFIG ? ['--config', SOURCE_WRANGLER_CONFIG] : [];
function wrangler(args, { capture = true } = {}) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
}
function d1Query(sql) {
  const out = wrangler([
    'd1', 'execute', SOURCE_DB, ...configArgs, '--remote', '--json', '--yes', '--command', sql,
  ]);
  const start = out.indexOf('[');
  return JSON.parse(out.slice(start))[0]?.results ?? [];
}

try {
  if (/not authenticated/i.test(wrangler(['whoami']))) throw new Error('unauth');
} catch {
  console.error("ERROR: wrangler is not authenticated. Run 'npx wrangler login' or set CLOUDFLARE_API_TOKEN.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Building "${DATASET}" from source D1 "${SOURCE_DB}"${SOURCE_WRANGLER_CONFIG ? ` (config: ${SOURCE_WRANGLER_CONFIG})` : ''}`);

// 1. Watermark: the Base block through which BOTH the event and builder streams
// are complete = min(last_event_block, last_builder_event_block). Resuming an
// index from this block cannot miss an event.
console.log('Reading watermark...');
const syncRows = d1Query('SELECT key, value FROM sync_state');
const builderRows = d1Query('SELECT key, value FROM builder_sync_state');
const syncMap = Object.fromEntries(syncRows.filter((r) => !isEphemeralSyncKey(r.key)).map((r) => [r.key, r.value]));
const builderMap = Object.fromEntries(builderRows.map((r) => [r.key, r.value]));
const lastEventBlock = Number.parseInt(syncMap.last_event_block ?? '0', 10);
const lastBuilderBlock = Number.parseInt(builderMap.last_builder_event_block ?? '0', 10);
const chainHead = Number.parseInt(syncMap.current_block ?? '0', 10);
if (!lastEventBlock) {
  console.error('ERROR: no last_event_block cursor found; refusing to build a genesis-less snapshot.');
  process.exit(1);
}
const watermarkBlock = lastBuilderBlock > 0 ? Math.min(lastEventBlock, lastBuilderBlock) : lastEventBlock;
console.log(`  watermark_block = ${watermarkBlock}  (event=${lastEventBlock}, builder=${lastBuilderBlock || 'n/a'})`);
console.log(`  chain head at export = ${chainHead}`);

// 2. Row counts.
console.log('Counting rows...');
const tables = SEED_TABLES.map((name) => ({
  name,
  rows: Number(d1Query(`SELECT COUNT(*) AS n FROM ${name}`)[0]?.n ?? 0),
}));
for (const { name, rows } of tables) console.log(`  ${name}: ${rows}`);

// 3. Combined data-only SQL dump.
const rawSqlPath = join(OUT_DIR, `${DATASET}.sql`);
console.log('Exporting combined SQL dump (data only)...');
wrangler([
  'd1', 'export', SOURCE_DB, ...configArgs, '--remote', '--no-schema',
  '--output', rawSqlPath, '--skip-confirmation', ...SEED_TABLES.flatMap((t) => ['--table', t]),
], { capture: false });
const rawSql = readFileSync(rawSqlPath);
const rawBytes = rawSql.byteLength;

// 3b. The schema the data was dumped under (all tables + indexes).
const schemaPath = join(REPO, 'schema.sql');
console.log('Exporting schema (no data)...');
wrangler([
  'd1', 'export', SOURCE_DB, ...configArgs, '--remote', '--no-data',
  '--output', schemaPath, '--skip-confirmation',
], { capture: false });
const schemaSql = readFileSync(schemaPath);
const schemaSha256 = createHash('sha256').update(schemaSql).digest('hex');

// 4. gzip + sha256.
console.log('Compressing + hashing...');
const gz = gzipSync(rawSql, { level: 9 });
const assetName = `${DATASET}-${watermarkBlock}.sql.gz`;
writeFileSync(join(OUT_DIR, assetName), gz);
const gzBytes = gz.byteLength;
const sha256 = createHash('sha256').update(gz).digest('hex');
console.log(`  raw:  ${rawBytes} bytes`);
console.log(`  gzip: ${gzBytes} bytes  (${(rawBytes / gzBytes).toFixed(1)}x smaller)`);
console.log(`  sha256(gzip) = ${sha256}`);

// 5. Provenance signing (dataset/morpheus-base).
console.log(`Signing provenance receipt (${SIGNER_PATH})...`);
const provJs = require.resolve('@drm3labs-oss/provenance/drm3_provenance.js');
const provWasm = require.resolve('@drm3labs-oss/provenance/drm3_provenance_bg.wasm');
const prov = await import(provJs);
await prov.default({ module_or_path: readFileSync(provWasm) });
const { Keyring, Receipt, canonicalize } = prov;
const keypair = Keyring.fromMnemonic(MNEMONIC).derive(SIGNER_PATH);
const publicKey = keypair.publicKeyPrefixed();
const generatedAt = new Date().toISOString();

// 6. manifest.json (neutral, signed).
const manifest = {
  schema: `${DATASET}/v1`,
  dataset: DATASET,
  network: 'base-mainnet',
  description:
    'On-chain activity of the Morpheus AI network on Base mainnet, decoded from ' +
    'events into a queryable SQL snapshot, complete through watermark_block.',
  format: 'gzip-sql',
  generated_at: generatedAt,
  watermark_block: watermarkBlock,
  chain_head_at_export: chainHead,
  asset: assetName,
  sha256,
  byte_size: gzBytes,
  raw_byte_size: rawBytes,
  schema_asset: { file: 'schema.sql', sha256: schemaSha256, byte_size: schemaSql.byteLength },
  tables,
  excluded_tables: EXCLUDED_TABLES,
  signer: SIGNER_PATH,
  public_key: publicKey,
  provenance:
    `Snapshot produced and signed by DRM3 Labs. Verify ${RECEIPT_FILE} against the Ed25519 key in keys.json.`,
};

const canonicalManifest = canonicalize(manifest);
const receipt = Receipt.create('morpheus.base.dataset')
  .inputs({
    dataset: DATASET,
    network: 'base-mainnet',
    watermark_block: watermarkBlock,
    chain_head_at_export: chainHead,
    table_count: tables.length,
    generated_at: generatedAt,
  })
  .outputs({
    asset: assetName,
    sha256,
    byte_size: gzBytes,
    format: 'gzip-sql',
    _meta: {
      protocol: 'drm3-provenance-v1',
      dataset: DATASET,
      signer: SIGNER_PATH,
      content_uri: 'keys.json',
      timestamp: generatedAt,
      network: 'Base Mainnet',
      attestation:
        'DRM3 Labs attests this snapshot is authentic Morpheus AI network activity indexed from ' +
        'Base mainnet through the watermark block. The signature binds these bytes to the dataset ' +
        'key; it does not make the data trustless (the data is re-derivable from Base).',
    },
  })
  .contentPayload(Buffer.from(canonicalManifest, 'utf8'))
  .sign(keypair);

const receiptJson = receipt.toJson();
if (!Receipt.fromJson(receiptJson).verify()) {
  console.error('ERROR: freshly-signed receipt failed self-verify.');
  process.exit(1);
}

// 7. keys.json (in-repo verification anchor).
const keysDoc = {
  algorithm: 'Ed25519',
  dataset: DATASET,
  keys: [{ id: SIGNER_PATH, public_key: publicKey, status: 'current' }],
  provenance:
    'Public key for verifying morpheus-ai-base-data provenance receipts. Snapshots are produced ' +
    'and signed by DRM3 Labs. This file is the verification anchor - checking a receipt needs only ' +
    'this repo, no network calls.',
  generated_at: generatedAt,
};

writeFileSync(join(REPO, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(REPO, RECEIPT_FILE), `${receiptJson}\n`);
writeFileSync(join(REPO, 'keys.json'), `${JSON.stringify(keysDoc, null, 2)}\n`);

console.log('');
console.log('Snapshot built:');
console.log(`  ${join(OUT_DIR, assetName)}  (Release asset - NOT committed to git)`);
console.log(`  ${schemaPath}`);
console.log(`  ${join(REPO, 'manifest.json')}`);
console.log(`  ${join(REPO, RECEIPT_FILE)}`);
console.log(`  ${join(REPO, 'keys.json')}`);
console.log(`  dataset public key = ${publicKey}`);
console.log('');
console.log(`Next: publish ${assetName} as a GitHub Release asset, and commit the four files above.`);
