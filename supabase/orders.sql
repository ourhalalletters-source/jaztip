-- JAZZZTIP KEDIRI: pesanan, checkout aman, dan rekap read-only untuk bot.
-- Jalankan di Supabase SQL Editor SETELAH schema.sql. Aman dijalankan ulang.
--
-- Rancangan keamanan:
--   * Pelanggan (anon) TIDAK bisa membaca atau menulis tabel orders langsung.
--     Mereka hanya boleh memanggil create_order(), yang menghitung harga dari
--     tabel products (bukan dari kiriman browser) dan memvalidasi semua input.
--   * Bot (mis. OpenClaw) hanya memanggil bot_recap() dengan token rahasia.
--     Fungsi ini read-only dan hanya mengembalikan ringkasan. Catatan pelanggan
--     tidak pernah ikut, nomor WA hanya 4 digit terakhir, nama hanya jika diminta.
--   * Admin (login Supabase) mengelola pesanan lewat panel /admin.

-- ---------------------------------------------------------------- utilitas
create or replace function public.price_to_idr(t text)
returns integer
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(t, ''), '\D', '', 'g')) between 1 and 9
      then regexp_replace(t, '\D', '', 'g')::integer
  end
$$;

-- ---------------------------------------------------------------- tabel
create sequence if not exists public.order_seq;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_name text not null,
  customer_wa text not null,
  area text not null default '',
  note text not null default '',
  items jsonb not null,
  total_idr bigint not null check (total_idr >= 0),
  status text not null default 'baru'
    check (status in ('baru','dikonfirmasi','dibayar','dibeli','dikirim','selesai','batal')),
  created_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_wa_created_idx on public.orders (customer_wa, created_at desc);

alter table public.orders enable row level security;
revoke all on public.orders from anon;
drop policy if exists "admin manage orders" on public.orders;
create policy "admin manage orders" on public.orders
  for all to authenticated using (true) with check (true);

-- Token bot disimpan sebagai hash. Tidak ada policy: tidak terbaca lewat API.
create table if not exists public.bot_tokens (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'bot',
  token_hash bytea not null unique,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.bot_tokens enable row level security;
revoke all on public.bot_tokens from anon, authenticated;

-- ---------------------------------------------------------------- checkout
create or replace function public.create_order(
  p_name text, p_wa text, p_area text, p_note text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_areas text[];
  v_name text;
  v_wa text := regexp_replace(coalesce(p_wa, ''), '\D', '', 'g');
  v_area text := btrim(coalesce(p_area, ''));
  v_note text := left(btrim(coalesce(p_note, '')), 300);
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_no text;
  e record;
  v_prod record;
begin
  -- 1. Toko harus OPEN (aturan yang sama dengan tampilan situs).
  select status, string_to_array(area, ',') into v_status, v_areas from settings where id = 1;
  if upper(btrim(coalesce(v_status, 'OPEN'))) <> 'OPEN' then
    raise exception 'ORDER_CLOSED';
  end if;

  -- 2. Nama: huruf, angka, spasi, titik, koma, apostrof, strip. Maksimal 60.
  v_name := regexp_replace(coalesce(p_name, ''), '[^[:alnum:] .,''-]', '', 'g');
  v_name := left(btrim(regexp_replace(v_name, '\s+', ' ', 'g')), 60);
  if length(v_name) < 2 then raise exception 'INVALID_NAME'; end if;

  -- 3. Nomor WA Indonesia: 0812.. / 812.. / +62812.. menjadi 62812..
  if v_wa like '0%' then v_wa := '62' || substr(v_wa, 2);
  elsif v_wa like '8%' then v_wa := '62' || v_wa;
  end if;
  if v_wa !~ '^62[0-9]{8,12}$' then raise exception 'INVALID_WA'; end if;

  -- 4. Area harus salah satu area layanan di pengaturan (jika diisi).
  if v_areas is not null and array_length(v_areas, 1) > 0 then
    select a into v_area from unnest(v_areas) a where lower(btrim(a)) = lower(v_area) limit 1;
    if v_area is null then raise exception 'INVALID_AREA'; end if;
    v_area := btrim(v_area);
  end if;

  -- 5. Item: array 1..30 objek {product_id, qty 1..99}.
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'INVALID_ITEMS';
  end if;
  for e in select value as j from jsonb_array_elements(p_items) loop
    if jsonb_typeof(e.j) <> 'object'
       or coalesce(e.j->>'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(e.j->>'qty', '') !~ '^[0-9]{1,2}$'
       or (e.j->>'qty')::int < 1 then
      raise exception 'INVALID_ITEMS';
    end if;
  end loop;

  -- 6. Harga dihitung di sini dari tabel products, tidak percaya kiriman klien.
  for v_prod in
    select p.id, p.name, price_to_idr(p.price) as price_idr, x.qty
    from (select (j->>'product_id')::uuid as pid, least(sum((j->>'qty')::int), 99)::int as qty
          from jsonb_array_elements(p_items) j group by 1) x
    left join products p on p.id = x.pid
    order by p.name
  loop
    if v_prod.id is null then raise exception 'UNKNOWN_PRODUCT'; end if;
    if v_prod.price_idr is null or v_prod.price_idr not between 1 and 50000000 then
      raise exception 'PRICE_UNSET';
    end if;
    v_items := v_items || jsonb_build_object(
      'product_id', v_prod.id, 'name', v_prod.name,
      'price_idr', v_prod.price_idr, 'qty', v_prod.qty);
    v_total := v_total + v_prod.price_idr::bigint * v_prod.qty;
  end loop;

  -- 7. Pembatas spam: maks 5 pesanan per nomor per jam, 300 pesanan per jam total.
  if (select count(*) from orders where customer_wa = v_wa and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from orders where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'TOO_MANY_ORDERS';
  end if;

  v_no := 'JZ' || to_char(now() at time zone 'Asia/Jakarta', 'MMDD') || '-'
          || lpad(nextval('order_seq')::text, 3, '0');

  insert into orders (order_no, customer_name, customer_wa, area, note, items, total_idr)
  values (v_no, v_name, v_wa, v_area, v_note, v_items, v_total);

  return jsonb_build_object('order_no', v_no, 'total_idr', v_total, 'items', v_items);
end
$$;

revoke all on function public.create_order(text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- rekap bot
-- Read-only. Zona waktu Asia/Jakarta. p_days = jumlah hari ke belakang (1..31).
create or replace function public.bot_recap(
  p_token text, p_date date default null, p_days integer default 1,
  p_with_names boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_to date := coalesce(p_date, (now() at time zone 'Asia/Jakarta')::date);
  v_days integer := greatest(1, least(coalesce(p_days, 1), 31));
  v_from date;
  v_result jsonb;
begin
  v_from := v_to - (v_days - 1);

  if p_token is null or length(p_token) < 32 or not exists (
    select 1 from bot_tokens
    where token_hash = sha256(convert_to(p_token, 'UTF8')) and not revoked
  ) then
    raise exception 'UNAUTHORIZED';
  end if;

  with sel as (
    select * from orders
    where (created_at at time zone 'Asia/Jakarta')::date between v_from and v_to
  ), act as (
    select * from sel where status <> 'batal'
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'timezone', 'Asia/Jakarta'),
    'totals', jsonb_build_object(
      'orders', (select count(*) from sel),
      'active_orders', (select count(*) from act),
      'cancelled_orders', (select count(*) from sel where status = 'batal'),
      'revenue_idr', (select coalesce(sum(total_idr), 0) from act)),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                  from (select status, count(*) as n from sel group by status) s),
    'by_product', (select coalesce(jsonb_agg(
                      jsonb_build_object('name', name, 'qty', qty, 'revenue_idr', revenue)
                      order by qty desc, name), '[]'::jsonb)
                   from (select i->>'name' as name,
                                sum((i->>'qty')::int) as qty,
                                sum((i->>'qty')::int * (i->>'price_idr')::bigint) as revenue
                         from act, jsonb_array_elements(act.items) i group by 1) p),
    'by_area', (select coalesce(jsonb_agg(
                    jsonb_build_object('area', area, 'orders', n, 'revenue_idr', revenue)
                    order by n desc, area), '[]'::jsonb)
                from (select area, count(*) as n, sum(total_idr) as revenue
                      from act group by area) a),
    'orders', (select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb)
               from (select s.created_at, jsonb_build_object(
                       'order_no', s.order_no,
                       'time', to_char(s.created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI'),
                       'name', case when p_with_names then left(s.customer_name, 30) end,
                       'wa_last4', right(s.customer_wa, 4),
                       'area', s.area,
                       'status', s.status,
                       'total_idr', s.total_idr,
                       'has_note', s.note <> '',
                       'items', (select jsonb_agg(jsonb_build_object(
                                   'name', i->>'name', 'qty', (i->>'qty')::int))
                                 from jsonb_array_elements(s.items) i)) as j
                     from sel s order by s.created_at desc limit 50) x),
    'orders_truncated', (select count(*) > 50 from sel)
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.bot_recap(text, date, integer, boolean) from public;
grant execute on function public.bot_recap(text, date, integer, boolean) to anon, authenticated;

-- ---------------------------------------------------------------- token bot
-- Buat token SEKALI (jalankan manual di SQL Editor, simpan hasilnya):
--
--   with t as (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as token),
--        ins as (insert into bot_tokens (label, token_hash)
--                select 'openclaw', sha256(convert_to(token, 'UTF8')) from t)
--   select token from t;
--
-- Token hanya tampil sekali (yang tersimpan hanya hash-nya).
-- Cabut / ganti token:
--
--   update bot_tokens set revoked = true where label = 'openclaw';
