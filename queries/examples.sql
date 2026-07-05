-- Example queries for morpheus-ai-base-data.
--
-- Build the database first (see README, "Open it"):
--   gunzip -k morpheus-ai-base-data-<block>.sql.gz
--   sqlite3 morpheus.db < schema.sql
--   sqlite3 morpheus.db < morpheus-ai-base-data-<block>.sql
--
-- Then:  sqlite3 morpheus.db < queries/examples.sql
--
-- Amounts on-chain are stored as wei-scale strings (18 decimals). Divide by
-- 1e18 for whole MOR. Timestamps are unix seconds (UTC).

-- Top compute providers by lifetime sessions served.
SELECT provider,
       COUNT(*) AS sessions
FROM sessions
GROUP BY provider
ORDER BY sessions DESC
LIMIT 10;

-- MOR holders and total MOR held (positive balances only).
SELECT COUNT(*)                                    AS holders,
       ROUND(SUM(CAST(mor_balance_wei AS REAL)) / 1e18) AS total_mor
FROM mor_holders
WHERE CAST(mor_balance_wei AS REAL) > 0;

-- MOR/USD price range and coverage of the series.
SELECT datetime(MIN(ts), 'unixepoch') AS first_point,
       datetime(MAX(ts), 'unixepoch') AS last_point,
       ROUND(MIN(usd), 4)             AS low_usd,
       ROUND(MAX(usd), 4)             AS high_usd,
       COUNT(*)                       AS points
FROM price_history;

-- Builder-subnet stake leaders: wallets with the most MOR staked to fund agents/apps.
SELECT wallet,
       ROUND(CAST(deposited AS REAL) / 1e18, 1) AS mor_staked
FROM builder_stakes
ORDER BY CAST(deposited AS REAL) DESC
LIMIT 10;

-- Network usage over time: compute sessions opened per calendar month.
SELECT strftime('%Y-%m', opened_at, 'unixepoch') AS month,
       COUNT(*)                                  AS sessions_opened
FROM sessions
WHERE opened_at > 0
GROUP BY month
ORDER BY month;

-- Most-used models by the sessions that ran against them.
SELECT s.model_id,
       m.name,
       COUNT(*) AS sessions
FROM sessions s
LEFT JOIN models m ON m.model_id = s.model_id
GROUP BY s.model_id
ORDER BY sessions DESC
LIMIT 10;

-- Provider quality: success rate and mean time-to-first-token, busiest first.
SELECT provider,
       total_sessions,
       success_count,
       ROUND(100.0 * success_count / NULLIF(total_sessions, 0), 1) AS success_pct,
       ttft_ms
FROM provider_stats
ORDER BY total_sessions DESC
LIMIT 10;

-- Daily network economics: how the staking factor and compute balance moved.
SELECT date,
       ROUND(CAST(compute_balance AS REAL) / 1e18) AS compute_balance_mor,
       staking_factor
FROM economics_history
ORDER BY date DESC
LIMIT 30;
