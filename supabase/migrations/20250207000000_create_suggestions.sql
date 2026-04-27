-- Таблица для пользовательских предложений (точки, розетки).
-- Выполните в Supabase SQL Editor или через CLI: supabase db push

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('point', 'socket')),
  title text,
  description text,
  coordinates jsonb not null check (jsonb_typeof(coordinates) = 'array' and jsonb_array_length(coordinates) = 2),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

-- Разрешить анонимную вставку (для формы без авторизации).
alter table public.suggestions enable row level security;

create policy "Allow anonymous insert"
  on public.suggestions
  for insert
  to anon
  with check (true);

-- Чтение можно ограничить только для авторизованных/админов или оставить для anon, если модерация через дашборд.
create policy "Allow anonymous read"
  on public.suggestions
  for select
  to anon
  using (true);

comment on table public.suggestions is 'Предложения пользователей: новые точки и розетки для карты (модерация по status).';
