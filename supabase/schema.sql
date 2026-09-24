create table if not exists products (
  id serial primary key,
  slug text not null unique,
  name text not null,
  tagline text not null,
  pieces integer not null default 1,
  price_pkr integer not null,
  available boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists orders (
  id serial primary key,
  code text not null unique,
  customer_name text not null,
  phone text not null,
  village text not null,
  address text not null,
  delivery_slot text not null,
  notes text,
  total_pkr integer not null,
  status text not null default 'received',
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id serial primary key,
  order_id integer not null references orders(id) on delete cascade,
  product_id integer not null references products(id),
  product_name text not null,
  quantity integer not null,
  unit_price_pkr integer not null
);

create table if not exists assets (
  key text primary key,
  mime text not null,
  data text not null,
  bytes integer not null,
  updated_at timestamptz not null default now()
);

create index if not exists products_available_idx on products (available, sort_order);
create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists order_items_order_idx on order_items (order_id);

insert into products (slug, name, tagline, pieces, price_pkr, sort_order)
values
  ('single', 'One Putok', 'A single round. Enough for one person and one pot of tea.', 1, 150, 1),
  ('morning-three', 'Morning Three', 'Three rounds, wrapped in paper. The usual household order.', 3, 420, 2),
  ('family-six', 'Family Six', 'Six rounds. Guests, cousins, or a long winter breakfast.', 6, 800, 3),
  ('putok-apricot', 'Putok + Apricot Jam', 'Two rounds and a 250g jar of Hunza apricot jam.', 2, 650, 4),
  ('week', 'The Week', 'One fresh putok at your door, seven mornings in a row.', 7, 950, 5)
on conflict (slug) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  pieces = excluded.pieces,
  price_pkr = excluded.price_pkr,
  sort_order = excluded.sort_order;
