-- Таблица заявок на новые точки/розетки.
-- Публикуемые объекты по-прежнему живут в map_points.
create table if not exists public.map_points_submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('point', 'socket')),
  title text not null check (char_length(trim(title)) > 0),
  description text null,
  coordinates jsonb not null,
  is_meeting boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

comment on table public.map_points_submissions is 'Пользовательские заявки на добавление точек и розеток.';
comment on column public.map_points_submissions.coordinates is 'Координаты [lon, lat] в формате JSON массива.';

alter table public.map_points_submissions enable row level security;

-- Разрешаем создание заявок всем клиентам приложения через anon/authenticated.
drop policy if exists "insert_map_points_submissions" on public.map_points_submissions;
create policy "insert_map_points_submissions"
  on public.map_points_submissions
  for insert
  to anon, authenticated
  with check (true);
