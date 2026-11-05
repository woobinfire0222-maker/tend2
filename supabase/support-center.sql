create extension if not exists pgcrypto;

create or replace function public.tend_is_support_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or exists (
      select 1
      from auth.identities i
      where i.user_id = auth.uid()
        and i.provider = 'discord'
        and (
          i.identity_data ->> 'user_id' = '1318120987480424498'
          or i.identity_data ->> 'provider_id' = '1318120987480424498'
          or i.identity_data ->> 'id' = '1318120987480424498'
          or i.identity_data ->> 'sub' = '1318120987480424498'
        )
    );
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 100),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user','admin')),
  sender_name text not null default '사용자',
  content text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_updated_idx on public.support_tickets(user_id, updated_at desc);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at);

create or replace function public.tend_touch_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists tend_support_message_touch on public.support_messages;
create trigger tend_support_message_touch
after insert on public.support_messages
for each row execute function public.tend_touch_support_ticket();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support tickets read own or admin" on public.support_tickets;
create policy "support tickets read own or admin"
on public.support_tickets for select to authenticated
using (user_id = auth.uid() or public.tend_is_support_admin());

drop policy if exists "support tickets create own" on public.support_tickets;
create policy "support tickets create own"
on public.support_tickets for insert to authenticated
with check (user_id = auth.uid() and not public.tend_is_support_admin());

drop policy if exists "support tickets update admin" on public.support_tickets;
create policy "support tickets update admin"
on public.support_tickets for update to authenticated
using (public.tend_is_support_admin())
with check (public.tend_is_support_admin());

drop policy if exists "support messages read ticket participants" on public.support_messages;
create policy "support messages read ticket participants"
on public.support_messages for select to authenticated
using (
  public.tend_is_support_admin()
  or exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  )
);

drop policy if exists "support messages insert participants" on public.support_messages;
create policy "support messages insert participants"
on public.support_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    (sender_role = 'admin' and public.tend_is_support_admin())
    or (
      sender_role = 'user'
      and not public.tend_is_support_admin()
      and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid() and t.status = 'open'
      )
    )
  )
);

do $$
begin
  alter publication supabase_realtime add table public.support_tickets;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.support_messages;
exception when duplicate_object then null;
when undefined_object then null;
end $$;