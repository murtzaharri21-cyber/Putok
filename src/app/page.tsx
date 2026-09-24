import Storefront from "@/components/Storefront";
import { getProducts } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();
  return (
    <main className="relative">
      <Storefront products={products} />
    </main>
  );
}
