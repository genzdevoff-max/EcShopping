import PolicyPage from '../components/PolicyPage';
import { privacyPolicy } from '../data/content';

export default function PrivacyPolicy() {
  return (
    <PolicyPage
      title="Privacy policy"
      subtitle="What we collect, why we collect it, and the choices you have."
      crumbs={[{ label: 'Privacy policy' }]}
      sections={privacyPolicy}
      footerNote="Questions about this policy? Contact our privacy team and we will be glad to help."
    />
  );
}
