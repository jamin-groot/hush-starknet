-- Verification queries after applying supabase-stealth-hardening.sql

-- 1) Confirm core tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'privacy_public_keys',
    'encrypted_messages',
    'encrypted_identities',
    'auth_challenges'
  )
order by table_name;

-- 2) Confirm required indexes exist
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'encrypted_messages'
  and (
    indexname like '%tx_hash%'
    or indexname like '%recipient%'
    or indexname like '%stealth_address%'
  )
order by indexname;

-- 3) Confirm RLS is enabled
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in ('privacy_public_keys', 'encrypted_messages', 'encrypted_identities')
order by relname;

-- 4) Confirm policies are present
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('privacy_public_keys', 'encrypted_messages', 'encrypted_identities')
order by tablename, policyname;

