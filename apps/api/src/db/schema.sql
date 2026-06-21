-- Run this SQL in the Supabase SQL editor to initialize the database.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific data
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  banned       boolean not null default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── MIGRATION (run this if you already have an existing database) ───────────
-- alter table public.profiles add column if not exists banned boolean not null default false;

-- ─── TOKEN WALLETS ────────────────────────────────────────────────────────────
create table public.wallets (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  balance      bigint not null default 0,  -- stored in tokens (integer, never float)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(user_id)
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
create type transaction_type as enum ('purchase', 'deduction', 'refund', 'bonus');

create table public.transactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            transaction_type not null,
  amount          bigint not null,           -- positive = credit, negative = debit
  balance_after   bigint not null,           -- wallet balance after this transaction
  description     text,
  metadata        jsonb default '{}',        -- stripe payment_intent, model used, etc.
  created_at      timestamptz default now()
);

-- ─── CONVERSATIONS ────────────────────────────────────────────────────────────
create table public.conversations (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null default 'New conversation',
  model        text not null,               -- e.g. "openai/gpt-4o-mini"
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── MESSAGES ─────────────────────────────────────────────────────────────────
create type message_role as enum ('user', 'assistant', 'system');

create table public.messages (
  id                uuid primary key default uuid_generate_v4(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  role              message_role not null,
  content           text not null,
  tokens_used       integer,               -- only set on assistant messages
  model             text,                  -- which model generated this
  created_at        timestamptz default now()
);

-- ─── STRIPE ORDERS ────────────────────────────────────────────────────────────
create type order_status as enum ('pending', 'completed', 'failed', 'refunded');

create table public.orders (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  stripe_payment_intent text unique,
  amount_usd_cents      integer not null,
  tokens_granted        bigint not null,
  status                order_status not null default 'pending',
  created_at            timestamptz default now(),
  completed_at          timestamptz
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.wallets      enable row level security;
alter table public.transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages     enable row level security;
alter table public.orders       enable row level security;

-- Users can only read/write their own data
create policy "own profile"       on public.profiles     for all using (auth.uid() = id);
create policy "own wallet"        on public.wallets      for all using (auth.uid() = user_id);
create policy "own transactions"  on public.transactions for all using (auth.uid() = user_id);
create policy "own conversations" on public.conversations for all using (auth.uid() = user_id);
create policy "own messages"      on public.messages     for all using (auth.uid() = user_id);
create policy "own orders"        on public.orders       for all using (auth.uid() = user_id);

-- ─── FUNCTIONS ────────────────────────────────────────────────────────────────
-- Auto-create wallet and profile when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  insert into public.wallets (user_id, balance)
    values (new.id, 500000);  -- 500K free tokens on signup
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Deduct tokens atomically — returns false if insufficient balance
create or replace function public.deduct_tokens(
  p_user_id     uuid,
  p_amount      bigint,
  p_description text,
  p_metadata    jsonb default '{}'
)
returns boolean language plpgsql security definer as $$
declare
  v_balance bigint;
  v_new_balance bigint;
begin
  -- Lock the wallet row
  select balance into v_balance
    from public.wallets
    where user_id = p_user_id
    for update;

  if v_balance < p_amount then
    return false;  -- insufficient balance
  end if;

  v_new_balance := v_balance - p_amount;

  update public.wallets
    set balance = v_new_balance, updated_at = now()
    where user_id = p_user_id;

  insert into public.transactions
    (user_id, type, amount, balance_after, description, metadata)
    values
    (p_user_id, 'deduction', -p_amount, v_new_balance, p_description, p_metadata);

  return true;
end;
$$;

-- Add tokens atomically (after successful payment)
create or replace function public.add_tokens(
  p_user_id     uuid,
  p_amount      bigint,
  p_description text,
  p_metadata    jsonb default '{}'
)
returns bigint language plpgsql security definer as $$
declare
  v_new_balance bigint;
begin
  update public.wallets
    set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id
    returning balance into v_new_balance;

  insert into public.transactions
    (user_id, type, amount, balance_after, description, metadata)
    values
    (p_user_id, 'purchase', p_amount, v_new_balance, p_description, p_metadata);

  return v_new_balance;
end;
$$;

-- Refund reserved tokens after a chat (returns unused portion to user)
create or replace function public.refund_tokens(
  p_user_id     uuid,
  p_amount      bigint,
  p_description text,
  p_metadata    jsonb default '{}'
)
returns bigint language plpgsql security definer as $$
declare
  v_new_balance bigint;
begin
  update public.wallets
    set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id
    returning balance into v_new_balance;

  insert into public.transactions
    (user_id, type, amount, balance_after, description, metadata)
    values
    (p_user_id, 'refund', p_amount, v_new_balance, p_description, p_metadata);

  return v_new_balance;
end;
$$;

-- Prevent wallet balance from ever going negative (hard DB-level guard)
alter table public.wallets add constraint balance_non_negative check (balance >= 0);

-- ─── ADMIN HELPER: per-user message count (efficient aggregate) ──────────────
-- Used by GET /api/admin/users and GET /api/admin/stats
create or replace function public.get_user_message_counts()
returns table(user_id uuid, count bigint) language sql security definer as $$
  select user_id, count(*) as count
  from public.messages
  where role = 'assistant'
  group by user_id;
$$;

-- ─── MIGRATION CHECKLIST (run in order if upgrading an existing DB) ──────────
-- 1. alter table public.profiles add column if not exists banned boolean not null default false;
-- 2. Run the get_user_message_counts() function above.
-- 3. Run the refund_tokens() function above.
-- 4. alter table public.wallets add constraint balance_non_negative check (balance >= 0);
