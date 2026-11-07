import AccountApp from './account-app';
import { SITE_URL } from '../../../lib/data';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your Kudos account',
  description: 'Claim your agency on Kudos, add your awards and get your verified awards widget.',
  robots: { index: false, follow: false }
};

export default function AccountPage() {
  // The anon key is public by design (it only allows what row level security permits).
  return (
    <AccountApp
      supabaseUrl={process.env.SUPABASE_URL}
      supabaseKey={process.env.SUPABASE_ANON_KEY}
      siteUrl={SITE_URL}
      billing={Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_YEARLY)}
      awardFormUrl={process.env.KUDOS_AWARD_FORM_URL || 'https://incident-report-widget.vercel.app/submit-award.html'}
    />
  );
}
