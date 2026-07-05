#!/usr/bin/env node
// verify.mjs - verify a morpheus-ai-base-data snapshot with no network calls.
//
// Proves, against files in THIS repo only:
//   1. the downloaded blob's sha256 matches the signed manifest,
//   2. the provenance receipt's Ed25519 signature is valid,
//   3. the receipt was signed by the dataset key published in keys.json,
//   4. the receipt commits to THIS manifest (content signature over its bytes),
//   5. the shipped schema.sql matches the hash in the manifest.
//
// A pass means: these exact bytes were produced and signed by the holder of the
// dataset key, and were not altered. The numbers are re-derivable from Base
// mainnet by anyone.
//
// Usage:
//   npm install
//   node verify.mjs path/to/morpheus-ai-base-data-<block>.sql.gz
//
// Repo-only mode (no Release blob needed, for CI): runs the four signature and
// schema checks and skips the blob sha256:
//   node verify.mjs --check        (or: npm run check)

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

const arg = process.argv[2];
const repoOnly = !arg || arg === '--check' || arg === '--repo-only';
const assetPath = repoOnly ? null : arg;

const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
const receiptObj = JSON.parse(readFileSync(join(HERE, 'morpheus-ai-base-data.receipt.json'), 'utf8'));
const receiptJson = JSON.stringify(receiptObj);
const keysDoc = JSON.parse(readFileSync(join(HERE, 'keys.json'), 'utf8'));
const asset = assetPath ? readFileSync(assetPath) : null;

const provJs = require.resolve('@drm3labs-oss/provenance/drm3_provenance.js');
const provWasm = require.resolve('@drm3labs-oss/provenance/drm3_provenance_bg.wasm');
const prov = await import(provJs);
await prov.default({ module_or_path: readFileSync(provWasm) });
const { Receipt, canonicalize, verify } = prov;

let ok = true;
const check = (name, pass, extra = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? `  ${extra}` : ''}`);
  if (!pass) ok = false;
};

// 1. blob integrity (skipped in repo-only mode, where the Release blob is absent)
if (asset) {
  const assetSha = createHash('sha256').update(asset).digest('hex');
  check('blob sha256 matches manifest', assetSha === manifest.sha256, `${assetSha.slice(0, 16)}...`);
} else {
  console.log('SKIP  blob sha256 matches manifest  (repo-only mode, no Release blob)');
}

// 2. receipt signature is internally valid
check('receipt Ed25519 signature valid', Receipt.fromJson(receiptJson).verify() === true);

// 3. receipt signed by the published dataset key
const datasetKey = (keysDoc.keys || []).find((k) => k.status === 'current');
check('dataset key present in keys.json', !!datasetKey, datasetKey?.id);
check('receipt signed by the dataset key', !!datasetKey && datasetKey.public_key === receiptObj.public_key, receiptObj.public_key);

// 4. receipt commits to THIS manifest
const canon = canonicalize(manifest);
check('receipt binds this manifest', verify(new TextEncoder().encode(canon), receiptObj.content_sig, receiptObj.public_key) === true);

// 5. shipped schema matches the manifest hash
const schemaSha = createHash('sha256').update(readFileSync(join(HERE, manifest.schema_asset.file))).digest('hex');
check('schema.sql matches manifest', schemaSha === manifest.schema_asset.sha256, `${schemaSha.slice(0, 16)}...`);

const scope = asset ? 'snapshot' : 'repo (signature and schema, blob not checked)';
console.log(ok
  ? `\nVERIFIED - authentic morpheus-ai-base-data ${scope} at Base block ${manifest.watermark_block}.`
  : '\nFAILED - do not rely on this snapshot.');
process.exit(ok ? 0 : 1);
