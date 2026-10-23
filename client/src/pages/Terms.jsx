import PolicyPage from '../components/PolicyPage';
import { termsPolicy } from '../data/content';

export default function Terms() {
  return (
    <PolicyPage
      title="Terms & conditions"
      subtitle="The rules that apply when you shop on EcShopping."
      crumbs={[{ label: 'Terms & conditions' }]}
      sections={termsPolicy}
      footerNote="By continuing to use this site you accept these terms. Contact support if anything is unclear."
    />
  );
}
