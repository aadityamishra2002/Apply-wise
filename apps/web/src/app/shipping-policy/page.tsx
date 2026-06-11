import { PolicyLayout } from "@/components/policy-layout";

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout
      eyebrow="Shipping and Delivery Policy"
      title="Digital Delivery Policy"
      description="Last updated June 11, 2026. Apply Wise is a digital SaaS product and does not ship physical goods."
    >
      <section><h2 className="text-[17px] font-bold text-[#23312e]">No physical shipping</h2><p className="mt-2">Apply Wise provides online software access only. No physical goods, parcels, or printed documents are shipped.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Digital access</h2><p className="mt-2">Access to the product is delivered digitally through the Apply Wise website after successful login. When paid plans are active, paid access is delivered after successful payment confirmation.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Delivery timeline</h2><p className="mt-2">Digital access is normally available instantly after successful payment/login. Some payment gateway or bank confirmations may take additional time.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Delayed access</h2><p className="mt-2">If access is delayed after payment or login, users should contact <a className="font-bold text-[#176b5b]" href="mailto:support@applywise.app">support@applywise.app</a> with their registered email and payment reference if applicable.</p></section>
    </PolicyLayout>
  );
}
