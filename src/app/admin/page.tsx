"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ORDER_STATUS_OPTIONS = [
  "received",
  "baking",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  baking: "In the oven",
  out_for_delivery: "On the motorbike",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

type Product = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  pieces: number;
  pricePkr: number;
  price_pkr?: number;
  available: boolean;
  sortOrder: number;
  sort_order?: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productForm, setProductForm] = useState({
    name: "",
    slug: "",
    tagline: "",
    pieces: "1",
    pricePkr: "",
    sortOrder: "0",
    available: true,
  });
  const [productError, setProductError] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [productPhotoMessage, setProductPhotoMessage] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
        const productRes = await fetch("/api/admin/products", { cache: "no-store" });
        if (productRes.ok) {
          const productData = await productRes.json();
          setProducts(productData.products ?? []);
        }
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error ?? "Invalid login");
      return;
    }

    setIsLoggedIn(true);
    const orderRes = await fetch("/api/admin/orders", { cache: "no-store" });
    const orderData = await orderRes.json();
    setOrders(orderData.orders ?? []);
    const productRes = await fetch("/api/admin/products", { cache: "no-store" });
    if (productRes.ok) {
      const productData = await productRes.json();
      setProducts(productData.products ?? []);
    }
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setProductError("");
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setProductError(data.error ?? "Could not add product");
      return;
    }
    setProducts((current) => [...current, data.product]);
    setProductForm({ name: "", slug: "", tagline: "", pieces: "1", pricePkr: "", sortOrder: "0", available: true });
  };

  const updateProduct = async (product: Product) => {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...product,
        pricePkr: product.pricePkr ?? product.price_pkr,
        sortOrder: product.sortOrder ?? product.sort_order,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts((current) => current.map((item) => (item.id === product.id ? data.product : item)));
    }
  };

  const deleteProduct = async (id: number) => {
    if (!window.confirm("Delete this product? Existing order history will remain.")) return;
    const res = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setProducts((current) => current.filter((item) => item.id !== id));
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("photo", file);
    const res = await fetch("/api/texture", { method: "POST", body: form });
    const data = await res.json();
    setPhotoMessage(res.ok ? "Photo updated on the storefront." : data.error ?? "Photo upload failed.");
    event.target.value = "";
  };

  const uploadProductPhoto = async (productId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("productId", String(productId));
    form.append("photo", file);
    const res = await fetch("/api/admin/products/photo", { method: "POST", body: form });
    const data = await res.json();
    setProductPhotoMessage((current) => ({
      ...current,
      [productId]: res.ok ? "Photo updated" : data.error ?? "Upload failed",
    }));
    event.target.value = "";
  };

  const handleStatusChange = async (id: number, status: string) => {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    if (res.ok) {
      const data = await res.json();
      setOrders((current) =>
        current.map((order) => (order.id === id ? { ...order, status: data.order.status } : order)),
      );
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsLoggedIn(false);
    setOrders([]);
    router.refresh();
  };

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-16">Loading admin dashboard...</main>;
  }

  if (!isLoggedIn) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6 py-16">
        <div className="w-full rounded-2xl border border-ink/20 bg-white p-8 shadow-sm">
          <p className="mono text-sm uppercase tracking-[0.2em] text-ink-soft">Admin access</p>
          <h1 className="mt-4 display text-4xl">PUTOK Dashboard</h1>
          <p className="mt-3 text-ink-soft">Sign in with an authorized admin account.</p>

          <form onSubmit={signIn} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block mono text-sm">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-ink/20 bg-paper px-4 py-3 outline-none ring-0"
                placeholder="Your admin email"
                required
              />
            </div>
            <div>
              <label className="mb-2 block mono text-sm">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink/20 bg-paper px-4 py-3 outline-none ring-0"
                placeholder="Password"
                required
              />
            </div>
            {loginError && <p className="text-sm text-red-700">{loginError}</p>}
            <button type="submit" className="btn-ink w-full rounded-full px-6 py-3 text-lg">
              Login to admin
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:px-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mono text-sm uppercase tracking-[0.2em] text-ink-soft">Admin panel</p>
          <h1 className="display mt-2 text-5xl md:text-6xl">PUTOK orders</h1>
        </div>
        <button onClick={logout} className="rounded-full border border-ink px-5 py-3 mono hover:bg-ink hover:text-paper">
          Logout
        </button>
      </div>

      <section className="mb-10 grid gap-8 md:grid-cols-2">
        <form onSubmit={saveProduct} className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="display text-3xl">Add product</h2>
          <div className="mt-5 grid gap-3">
            <input required placeholder="Product name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
            <input placeholder="Slug (optional)" value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
            <input required placeholder="Short description" value={productForm.tagline} onChange={(e) => setProductForm({ ...productForm, tagline: e.target.value })} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <input required type="number" min="1" placeholder="Pieces" value={productForm.pieces} onChange={(e) => setProductForm({ ...productForm, pieces: e.target.value })} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
              <input required type="number" min="0" placeholder="Price PKR" value={productForm.pricePkr} onChange={(e) => setProductForm({ ...productForm, pricePkr: e.target.value })} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
            </div>
            {productError && <p className="text-sm text-red-700">{productError}</p>}
            <button className="btn-ink rounded-full px-5 py-3">Add product</button>
          </div>
        </form>

        <div className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="display text-3xl">Store photo</h2>
          <p className="mt-3 text-ink-soft">Replace the bread photo used by the storefront 3D texture.</p>
          <label className="mt-6 inline-flex cursor-pointer rounded-full border border-ink px-5 py-3 mono hover:bg-ink hover:text-paper">
            Upload photo
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden" />
          </label>
          {photoMessage && <p className="mt-4 text-sm text-ink-soft">{photoMessage}</p>}
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-ink/15 bg-white p-6">
        <h2 className="display text-3xl">Products and prices</h2>
        <div className="mt-5 space-y-4">
          {products.map((product) => (
            <div key={product.id} className="grid gap-3 border-t border-ink/10 pt-4 md:grid-cols-[1.2fr_2fr_7rem_6rem_7rem_9rem_auto] md:items-center">
              <input value={product.name} onChange={(e) => setProducts((items) => items.map((item) => item.id === product.id ? { ...item, name: e.target.value } : item))} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
              <input value={product.tagline} onChange={(e) => setProducts((items) => items.map((item) => item.id === product.id ? { ...item, tagline: e.target.value } : item))} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
              <input type="number" min="1" value={product.pieces} onChange={(e) => setProducts((items) => items.map((item) => item.id === product.id ? { ...item, pieces: Number(e.target.value) } : item))} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
              <input type="number" min="0" value={product.pricePkr ?? product.price_pkr} onChange={(e) => setProducts((items) => items.map((item) => item.id === product.id ? { ...item, pricePkr: Number(e.target.value) } : item))} className="rounded-lg border border-ink/20 bg-paper px-3 py-2" />
              <label className="mono flex items-center gap-2"><input type="checkbox" checked={product.available} onChange={(e) => setProducts((items) => items.map((item) => item.id === product.id ? { ...item, available: e.target.checked } : item))} /> Available</label>
              <label className="cursor-pointer rounded-full border border-ink px-3 py-2 text-center mono hover:bg-ink hover:text-paper">Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadProductPhoto(product.id, e)} className="hidden" />{productPhotoMessage[product.id] && <span className="ml-1 text-xs">✓</span>}</label>
              <div className="flex gap-2"><button onClick={() => updateProduct(product)} className="rounded-full border border-ink px-4 py-2 mono">Save</button><button onClick={() => deleteProduct(product.id)} className="rounded-full border border-red-700 px-4 py-2 mono text-red-700">Delete</button></div>
            </div>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper-deep mono text-ink-soft">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                  No orders yet.
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-ink/10 align-top">
                <td className="px-4 py-4">
                  <div className="font-bold">{order.code}</div>
                  <div className="mono text-ink-soft">{new Date(order.created_at).toLocaleString("en-GB")}</div>
                </td>
                <td className="px-4 py-4">
                  <div>{order.customer_name}</div>
                  <div className="mono text-ink-soft">{order.phone}</div>
                </td>
                <td className="px-4 py-4">
                  <ul className="space-y-1">
                    {(order.items ?? []).map((item: any) => (
                      <li key={item.id}>
                        {item.quantity} × {item.product_name}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-4">
                  <div>{order.village}</div>
                  <div className="max-w-xs text-ink-soft">{order.address}</div>
                </td>
                <td className="px-4 py-4">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="rounded-lg border border-ink/20 bg-paper px-3 py-2"
                  >
                    {ORDER_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-4 tabular-nums">Rs {Number(order.total_pkr ?? 0).toLocaleString("en-PK")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
