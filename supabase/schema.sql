create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null, price text not null default '', description text default '',
  image_url text default '', created_at timestamptz default now());
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  whatsapp text default '6281234567890', status text default 'OPEN',
  open_date text default '', deadline text default '', eta text default '',
  area text default 'Kediri Kota, Mrican, Prambon, Warujayeng',
  route text default 'KEDIRI KOTA – MRICAN – PRAMBON – WARUJAYENG');
insert into settings (id) values (1) on conflict do nothing;
alter table products enable row level security;
alter table settings enable row level security;
create policy "public read products" on products for select using (true);
create policy "public read settings" on settings for select using (true);
create policy "admin write products" on products for all to authenticated using (true) with check (true);
create policy "admin write settings" on settings for all to authenticated using (true) with check (true);
insert into storage.buckets (id, name, public) values ('product-images','product-images',true) on conflict do nothing;
create policy "public read images" on storage.objects for select using (bucket_id = 'product-images');
create policy "admin manage images" on storage.objects for all to authenticated
  using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
