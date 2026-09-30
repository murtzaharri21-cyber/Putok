# Putok 🍞

> Home-made bread (Putok) from Chamangul, Gulmit Gojal, Hunza — sold locally by Azra.

Live site: **https://putok.vercel.app**

## About

Putok is a small e-commerce storefront for ordering home-made Hunza bread. Customers pick
their bread, choose quantities, and place an order with a delivery address — the baker
receives it in the admin dashboard. Orders are tracked from *Received* → *In the oven* →
*On the motorbike* → *Delivered*.

The homepage features an interactive 3D bread scene (Three.js / React Three Fiber) where
scrolling rotates the model.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Styling | Tailwind CSS 4 |
| 3D | Three.js · @react-three/fiber |
| Database | Supabase (PostgreSQL) · Drizzle ORM |
| Hosting | Vercel |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (copy the example and fill in your keys)
cp .env.example .env.local

# 3. Run the dev server
npm run dev
```

Then open http://localhost:3000

### Environment variables (`.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only) |
| `DATABASE_URL` | Postgres REST endpoint |
| `ADMIN_PASSWORD` | Password for the admin dashboard |

> ⚠️ `.env.local` is git-ignored. Never commit real keys — only `.env.example` is pushed.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (webpack mode) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |

## Project structure

```
src/
├── app/
│   ├── page.tsx           # Storefront homepage (3D hero, prices, order form)
│   ├── bakery/            # Bakery / "how it's made" page
│   ├── order/[code]/      # Order confirmation page per order code
│   ├── admin/             # Admin dashboard (orders, products, contacts)
│   └── api/
│       ├── admin/         # login, orders, products, contact (protected)
│       ├── orders/        # public order submission
│       ├── products/      # product listings & photos
│       ├── health/        # health check
│       └── texture/       # 3D texture assets
├── components/            # Storefront, 3D scene, UI components
├── db/                    # Drizzle schema & queries
└── lib/                   # Supabase client, auth helpers, WhatsApp utils
supabase/                  # DB migrations / seed
public/                    # Static assets & 3D models
```

## Admin access

The dashboard at `/admin` accepts only approved admin emails (defined in
`src/lib/supabase.ts`) together with `ADMIN_PASSWORD` from the environment.

## License

Private — all rights reserved.
