import { getProducts } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await getProducts();
    return Response.json({ products: list });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not load products" }, { status: 500 });
  }
}
