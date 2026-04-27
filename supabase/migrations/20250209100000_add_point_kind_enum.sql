-- Флаг точки: место встречи.
-- Применение: supabase db push или выполнить в SQL Editor

-- Откат старой схемы с enum (если миграция уже применялась)
alter table public.map_points drop column if exists point_kind;
drop type if exists public.point_kind;

alter table public.map_points
  drop column if exists is_poi,
  add column if not exists is_meeting boolean not null default false;

comment on column public.map_points.is_meeting is 'Точка — место встречи.';
