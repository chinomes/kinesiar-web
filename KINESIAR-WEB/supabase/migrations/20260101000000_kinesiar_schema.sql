create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  page_content jsonb not null,
  contact jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, page_content, contact)
values (
  1,
  '{
    "heroTitleFirst": "Volvé a moverte.",
    "heroTitleSecond": "Sentite mejor.",
    "heroDescription": "Un espacio dedicado a acompañarte en tu recuperación, cuidar tu cuerpo y ayudarte a volver a disfrutar del movimiento.",
    "bookingDescription": "Completá tus datos y tu preferencia de horario. Tu solicitud quedará pendiente hasta que el consultorio la confirme.",
    "serviceOneTitle": "Rehabilitación",
    "serviceOneDescription": "Acá agregaremos la información de este servicio, sus beneficios y cómo podemos acompañarte.",
    "serviceTwoTitle": "Kinesiología",
    "serviceTwoDescription": "En este espacio irá la descripción que definamos para presentar este servicio.",
    "serviceThreeTitle": "Bienestar",
    "serviceThreeDescription": "La información, imagen y contenido de esta tarjeta se completarán más adelante."
  }'::jsonb,
  '{
    "whatsapp": "",
    "telefono": "",
    "email": "",
    "direccion": "",
    "ciudad": "",
    "instagram": "@kinesiar_salta",
    "facebook": "",
    "web": "",
    "horarios": "",
    "descripcion": ""
  }'::jsonb
)
on conflict (id) do nothing;

create table if not exists public.kinesiar_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_kinesiar_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kinesiar_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_kinesiar_admin() from public, anon;
grant execute on function public.is_kinesiar_admin() to authenticated;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  phone text not null check (length(trim(phone)) between 5 and 40),
  email text check (email is null or length(email) <= 254),
  service text not null check (length(trim(service)) between 1 and 120),
  appointment_date date not null,
  preferred_time text not null default 'A convenir' check (length(preferred_time) <= 80),
  message text check (message is null or length(message) <= 2000),
  privacy_accepted boolean not null default false,
  status text not null default 'Pendiente'
    check (status in ('Pendiente', 'Confirmado', 'Cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists public.blocked_dates (
  blocked_date date primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (length(trim(comment)) between 1 and 2000),
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Publicado', 'Rechazado')),
  created_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
alter table public.kinesiar_admins enable row level security;
alter table public.appointments enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.reviews enable row level security;

revoke all on table public.site_settings, public.kinesiar_admins,
  public.appointments, public.blocked_dates, public.reviews
from anon, authenticated;

grant select on table public.site_settings to anon, authenticated;
grant update (page_content, contact, updated_at) on table public.site_settings to authenticated;

grant insert (name, phone, email, service, appointment_date, preferred_time, message, privacy_accepted)
  on table public.appointments to anon;
grant select on table public.appointments to authenticated;
grant update (status, appointment_date, preferred_time)
  on table public.appointments to authenticated;

grant select on table public.blocked_dates to anon, authenticated;
grant insert (blocked_date) on table public.blocked_dates to authenticated;
grant delete on table public.blocked_dates to authenticated;

grant insert (name, rating, comment) on table public.reviews to anon;
grant select on table public.reviews to authenticated;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
  on public.site_settings for select to anon, authenticated
  using (true);

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
  on public.site_settings for update to authenticated
  using (public.is_kinesiar_admin())
  with check (public.is_kinesiar_admin());

drop policy if exists "Visitors can submit appointment requests" on public.appointments;
create policy "Visitors can submit appointment requests"
  on public.appointments for insert to anon
  with check (
    status = 'Pendiente'
    and privacy_accepted
    and appointment_date >= (now() at time zone 'America/Argentina/Salta')::date
    and not exists (
      select 1
      from public.blocked_dates
      where blocked_date = appointment_date
    )
  );

drop policy if exists "Admins can read appointments" on public.appointments;
create policy "Admins can read appointments"
  on public.appointments for select to authenticated
  using (public.is_kinesiar_admin());

drop policy if exists "Admins can update appointments" on public.appointments;
create policy "Admins can update appointments"
  on public.appointments for update to authenticated
  using (public.is_kinesiar_admin())
  with check (public.is_kinesiar_admin());

drop policy if exists "Public can read blocked dates" on public.blocked_dates;
create policy "Public can read blocked dates"
  on public.blocked_dates for select to anon, authenticated
  using (true);

drop policy if exists "Admins can create blocked dates" on public.blocked_dates;
create policy "Admins can create blocked dates"
  on public.blocked_dates for insert to authenticated
  with check (public.is_kinesiar_admin());

drop policy if exists "Admins can delete blocked dates" on public.blocked_dates;
create policy "Admins can delete blocked dates"
  on public.blocked_dates for delete to authenticated
  using (public.is_kinesiar_admin());

drop policy if exists "Visitors can submit reviews" on public.reviews;
create policy "Visitors can submit reviews"
  on public.reviews for insert to anon
  with check (status = 'Pendiente');

drop policy if exists "Admins can read reviews" on public.reviews;
create policy "Admins can read reviews"
  on public.reviews for select to authenticated
  using (public.is_kinesiar_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kinesiar-gallery',
  'kinesiar-gallery',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view KINESIAR gallery" on storage.objects;
create policy "Public can view KINESIAR gallery"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'kinesiar-gallery');

drop policy if exists "KINESIAR admins can upload gallery images" on storage.objects;
create policy "KINESIAR admins can upload gallery images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kinesiar-gallery' and public.is_kinesiar_admin());

drop policy if exists "KINESIAR admins can update gallery images" on storage.objects;
create policy "KINESIAR admins can update gallery images"
  on storage.objects for update to authenticated
  using (bucket_id = 'kinesiar-gallery' and public.is_kinesiar_admin())
  with check (bucket_id = 'kinesiar-gallery' and public.is_kinesiar_admin());

drop policy if exists "KINESIAR admins can delete gallery images" on storage.objects;
create policy "KINESIAR admins can delete gallery images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'kinesiar-gallery' and public.is_kinesiar_admin());
