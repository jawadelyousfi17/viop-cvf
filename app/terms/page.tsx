import Link from 'next/link'
import { CONTACT_EMAIL, mailto } from '@/lib/contact'
import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/marketing/LegalPage'

export const metadata: Metadata = {
  title: 'Terms — nipsol',
  description: 'The terms you use nipsol under.',
}


export default function Terms() {
  return (
    <LegalPage title="Terms" updated="10 August 2026">
      <Section title="What this is">
        <p>
          nipsol draws mindmaps, teaches lessons at a whiteboard and works through maths
          problems, using AI models. Using it means agreeing to what is on this page. If you
          do not, do not use it.
        </p>
      </Section>

      <Section title="It is in beta, and it can be wrong">
        <p>
          This is early software. Things change, occasionally break, and are sometimes
          unavailable. More importantly:{' '}
          <strong>what the AI writes can be wrong, and confidently wrong.</strong> A
          worked solution can contain a mistake; a lesson can state something inaccurate. It
          is a study aid, not an authority — check anything that matters, and do not rely on
          it for medical, legal, financial or safety decisions.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You sign in with Google and you are responsible for what happens under your
          account. You must be at least 13 years old. One person per account.
        </p>
      </Section>

      <Section title="What you make">
        <p>
          What you type is yours. What the models produce for you — your maps, lessons and
          solutions — is yours to use however you like, including commercially. We store it
          so we can show it back to you, and we claim no ownership of it.
        </p>
        <p>
          Two things worth knowing: AI output is not always unique, so someone else may
          receive something similar, and symbols or photographs placed on a board may come
          from third parties under their own licences.
        </p>
      </Section>

      <Section title="What you may not do">
        <ul>
          <li>Break the law with it, or use it to harm, harass or deceive people.</li>
          <li>
            Resell it, or run it as a service for others, without asking us first — a personal
            account is for a person.
          </li>
          <li>
            Attack it: scripted abuse, attempts to exhaust the model budget, or trying to
            reach other people&rsquo;s work.
          </li>
        </ul>
        <p>We may suspend an account that does these things, and will say why.</p>
      </Section>

      <Section title="Plans and payment">
        <p>
          There is a free plan that keeps 5 mindmaps and 2 lessons, and paid plans at $30 a
          month or $299 a year for unlimited use. Prices are in US dollars and may change —
          if they do, it applies from your next renewal, never retroactively.
        </p>
        <p>
          Subscriptions renew automatically until cancelled, and you can cancel at any time
          and keep access until the end of the period you have paid for. If something goes
          wrong on our side, or you are unhappy in the first 14 days, write to{' '}
          <a href={mailto('refund')}>{CONTACT_EMAIL}</a> and we will
          refund you. While nipsol is in beta, payment is not yet enabled — the free plan is
          the whole product for now.
        </p>
      </Section>

      <Section title="Ending it">
        <p>
          You can stop whenever you like and ask us to delete everything — see{' '}
          <Link href="/privacy">privacy</Link>. We can close an account for the reasons above,
          and if we ever shut the service down we will give notice and time to get your work
          out.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          nipsol is provided as it is, without warranties. To the extent the law allows, we
          are not liable for indirect or consequential loss, and our total liability is
          limited to what you have paid us in the previous twelve months. Nothing here limits
          liability that cannot legally be limited.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          <a href={mailto('terms')}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  )
}
