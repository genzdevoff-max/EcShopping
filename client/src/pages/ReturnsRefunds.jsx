import PolicyPage from '../components/PolicyPage';
import { returnsPolicy } from '../data/content';

export default function ReturnsRefunds() {
  return (
    <PolicyPage
      title="Returns & refunds"
      subtitle="What can be returned, how to raise a request, and when your money comes back."
      crumbs={[{ label: 'Returns & refunds' }]}
      sections={returnsPolicy}
      footerNote="Refund timelines depend on your bank or payment provider once the amount has been initiated."
    />
  );
}
