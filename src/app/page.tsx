import Storefront from "@/components/Storefront";
import { getProducts } from "@/db/queries";
import { getWhatsAppNumber } from "@/lib/contact";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, whatsappNumber] = await Promise.all([getProducts(), getWhatsAppNumber()]);
  return (
    <main className="relative">
      <Storefront products={products} whatsappNumber={whatsappNumber} />
    </main>
  );
}
