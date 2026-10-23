import PolicyPage from '../components/PolicyPage';
import { shippingPolicy } from '../data/content';

export default function ShippingPolicy() {
  return (
    <PolicyPage
      title="Shipping & delivery"
      subtitle="How orders are packed, shipped and tracked."
      crumbs={[{ label: 'Shipping & delivery' }]}
      sections={shippingPolicy}
      footerNote="Delivery timelines may vary by pincode, seller location and courier partner."
    />
  );
}
