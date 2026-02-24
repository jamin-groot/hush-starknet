-- Supabase Postgres schema for production stealth hardening.

create table if not exists privacy_public_keys (
  address text primary key,
  public_key_jwk jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists encrypted_messages (
  id text primary key,
  tx_hash text unique,
  request_id text,
  kind text,
  sender_address text,
  recipient_address text,
  payload_json jsonb not null,
  stealth_address text,
  stealth_public_key text,
  ephemeral_pubkey text,
  metadata_json jsonb,
  paid_tx_hash text,
  amount text,
  status text,
  expires_at bigint,
  is_stealth boolean not null default false,
  claim_status text,
  claim_tx_hash text,
  stealth_deploy_tx_hash text,
  stealth_salt text,
  stealth_class_hash text,
  derivation_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_encrypted_messages_created_at
  on encrypted_messages (created_at desc);
create index if not exists idx_encrypted_messages_tx_hash
  on encrypted_messages (tx_hash);
create index if not exists idx_encrypted_messages_recipient
  on encrypted_messages (recipient_address);
create index if not exists idx_encrypted_messages_sender
  on encrypted_messages (sender_address);
create index if not exists idx_encrypted_messages_stealth_address
  on encrypted_messages (stealth_address);
create index if not exists idx_encrypted_messages_request_id
  on encrypted_messages (request_id);

create table if not exists encrypted_identities (
  wallet_address text primary key,
  encrypted_blob text not null,
  nonce text not null,
  algorithm text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists auth_challenges (
  nonce text primary key,
  wallet_address text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_challenges_wallet_expires
  on auth_challenges (wallet_address, expires_at desc);

alter table privacy_public_keys enable row level security;
alter table encrypted_messages enable row level security;
alter table encrypted_identities enable row level security;

drop policy if exists privacy_public_keys_select_own on privacy_public_keys;
create policy privacy_public_keys_select_own
  on privacy_public_keys for select
  using (address = lower(auth.jwt() ->> 'wallet_address'));

drop policy if exists privacy_public_keys_write_own on privacy_public_keys;
create policy privacy_public_keys_write_own
  on privacy_public_keys for all
  using (address = lower(auth.jwt() ->> 'wallet_address'))
  with check (address = lower(auth.jwt() ->> 'wallet_address'));

drop policy if exists encrypted_messages_select_own on encrypted_messages;
create policy encrypted_messages_select_own
  on encrypted_messages for select
  using (
    recipient_address = lower(auth.jwt() ->> 'wallet_address')
    or sender_address = lower(auth.jwt() ->> 'wallet_address')
  );

drop policy if exists encrypted_messages_insert_sender on encrypted_messages;
create policy encrypted_messages_insert_sender
  on encrypted_messages for insert
  with check (sender_address = lower(auth.jwt() ->> 'wallet_address'));

drop policy if exists encrypted_messages_update_sender on encrypted_messages;
create policy encrypted_messages_update_sender
  on encrypted_messages for update
  using (sender_address = lower(auth.jwt() ->> 'wallet_address'))
  with check (sender_address = lower(auth.jwt() ->> 'wallet_address'));

drop policy if exists encrypted_identities_own on encrypted_identities;
create policy encrypted_identities_own
  on encrypted_identities for all
  using (wallet_address = lower(auth.jwt() ->> 'wallet_address'))
  with check (wallet_address = lower(auth.jwt() ->> 'wallet_address'));

