# Stealth Production Hardening Runbook

This document describes the production rollout for stealth hardening: dynamic claim fee handling, RPC routing, Supabase metadata persistence, wallet session auth, and encrypted identity recovery.

## Required Environment Variables

### RPC

- `NEXT_PUBLIC_STARKNET_RPC_URL` (primary RPC endpoint)
- `NEXT_PUBLIC_STARKNET_RPC_FALLBACKS` (comma-separated fallback RPC endpoints)
- `STARKNET_RPC_URL` (server-side primary override, optional)
- `STARKNET_RPC_FALLBACKS` (server-side fallback override, optional)

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Auth

- `HUSH_AUTH_SECRET` (strong random secret for session/challenge JWT signing)

## Database Migration

Apply schema from:

- `docs/sql/supabase-stealth-hardening.sql`
- Verify with:
  - `docs/sql/verify-supabase-stealth-hardening.sql`

The migration creates:

- `privacy_public_keys`
- `encrypted_messages` (indexed by `tx_hash`, recipient/sender, and `created_at`)
- `encrypted_identities`

## Rollout Steps

1. Configure env vars in staging.
2. Apply SQL migration.
3. Run verification SQL and confirm:
   - `encrypted_messages` indexed by `tx_hash`, `recipient_address`, `stealth_address`
   - RLS enabled on privacy tables
   - policies present for read/write scoping
4. Deploy app.
5. Validate wallet challenge/verify flow:
   - `POST /api/auth/challenge`
   - `POST /api/auth/verify`
6. Validate privacy APIs with authenticated session cookie:
   - writes reject unauthenticated access
   - reads return wallet-scoped data
7. Validate stealth claim flow:
   - deploy and claim phases logged independently
   - dynamic fee plan log includes `estimatedFee`, `spendable`, `transferAmount`
   - claim success requires positive receiver delta

## Validation Checklist

- No static claim fee reserve in claim execution path.
- Claim failure is emitted when receiver delta is zero.
- RPC provider selection logs selected node URL for claim.
- Metadata writes are idempotent by `id` and deduplicated by `tx_hash`.
- Message reads support cursor pagination (`cursor`, `limit`).
- Encryption identity backup is encrypted client-side and recoverable on new device.
- Nonce challenges are one-time and invalidated after successful verification.
- Identity backup overwrite requires recent wallet re-authentication.
- Privacy write endpoints are rate-limited.

## Rollback Plan

1. Keep previous deployment image available.
2. If auth/session issues occur:
   - rollback app deployment
   - keep DB schema (backward-compatible for reads)
3. If Supabase access fails:
   - verify service-role key and RLS policy configuration
   - rollback to prior app release after incident capture

## Notes

- Build can run without RPC env (local fallback), but production should always set dedicated primary/fallback RPC values.
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-side only.

# Stealth Production Hardening Runbook

This document describes the production rollout for stealth hardening: dynamic claim fee handling, RPC routing, Supabase metadata persistence, wallet session auth, and encrypted identity recovery.

## Required Environment Variables

### RPC

- `NEXT_PUBLIC_STARKNET_RPC_URL` (primary RPC endpoint)
- `NEXT_PUBLIC_STARKNET_RPC_FALLBACKS` (comma-separated fallback RPC endpoints)
- `STARKNET_RPC_URL` (server-side primary override, optional)
- `STARKNET_RPC_FALLBACKS` (server-side fallback override, optional)

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Auth

- `HUSH_AUTH_SECRET` (strong random secret for session/challenge JWT signing)

## Database Migration

Apply schema from:

- `docs/sql/supabase-stealth-hardening.sql`

The migration creates:

- `privacy_public_keys`
- `encrypted_messages` (indexed by `tx_hash`, recipient/sender, and `created_at`)
- `encrypted_identities`

## Rollout Steps

1. Configure env vars in staging.
2. Apply SQL migration.
3. Deploy app.
4. Validate wallet challenge/verify flow:
   - `POST /api/auth/challenge`
   - `POST /api/auth/verify`
5. Validate privacy APIs with authenticated session cookie:
   - writes reject unauthenticated access
   - reads return wallet-scoped data
6. Validate stealth claim flow:
   - deploy and claim phases logged independently
   - dynamic fee plan log includes `estimatedFee`, `spendable`, `transferAmount`
   - claim success requires positive receiver delta

## Validation Checklist

- No static claim fee reserve in claim execution path.
- Claim failure is emitted when receiver delta is zero.
- RPC provider selection logs selected node URL for claim.
- Metadata writes are idempotent by `id` and deduplicated by `tx_hash`.
- Message reads support cursor pagination (`cursor`, `limit`).
- Encryption identity backup is encrypted client-side and recoverable on new device.

## Rollback Plan

1. Keep previous deployment image available.
2. If auth/session issues occur:
   - rollback app deployment
   - keep DB schema (backward-compatible for reads)
3. If Supabase access fails:
   - verify service-role key and RLS policy configuration
   - rollback to prior app release after incident capture

## Notes

- Build can run without RPC env (local fallback), but production should always set dedicated primary/fallback RPC values.
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-side only.

