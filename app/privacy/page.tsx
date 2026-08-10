import Link from 'next/link'
import { CONTACT_EMAIL, mailto } from '@/lib/contact'
import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/marketing/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy — nipsol',
  description: 'What nipsol stores, who it is sent to, and how to get rid of it.',
}


export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="10 August 2026">
      <Section title="The short version">
        <p>
          We store your email address, the maps, lessons and worked solutions you make, and
          nothing else about you. What you type is sent to the AI companies listed below,
          because that is how the answers get written. We do not sell anything to anyone, and
          there is no advertising or tracking on this site.
        </p>
      </Section>

      <Section title="What we store">
        <ul>
          <li>
            <strong>Your email address</strong>, from Google when you sign in. We do not
            receive your Google password, and we ask Google for nothing else.
          </li>
          <li>
            <strong>What you make</strong> — the mindmaps, lessons and solutions, along with
            the topic or question that produced each one, so your history is there when you
            come back.
          </li>
          <li>
            <strong>Two cookies.</strong> One is your sign-in session, set by Supabase. The
            other is a random identifier that lets work made before you signed in be attached
            to your account afterwards, so it is not stranded.
          </li>
        </ul>
        <p>
          Everything is held in a Postgres database hosted by Neon, in the EU. We keep it
          until you delete it or ask us to.
        </p>
      </Section>

      <Section title="Who else sees it">
        <p>
          Making a map or a lesson means sending your topic — and, when you open a branch,
          the path down to it — to a model provider. Currently that is{' '}
          <strong>OpenAI</strong> and <strong>Anthropic</strong>. Narration is synthesised by{' '}
          <strong>ElevenLabs</strong>, <strong>Fish Audio</strong> or OpenAI, depending on
          configuration, which means the words being spoken are sent to them. Photographs on
          a board are searched for through Unsplash, Openverse, Wikimedia Commons or Google,
          using the search term the model wrote.
        </p>
        <p>
          Sign-in is handled by <strong>Supabase</strong> and <strong>Google</strong>. Each of
          these companies has its own privacy policy and its own retention rules, which we do
          not control.
        </p>
      </Section>

      <Section title="What we do not do">
        <ul>
          <li>No advertising, no ad networks, no third-party analytics or tracking pixels.</li>
          <li>We do not sell or rent your data, and we do not share it beyond the providers above.</li>
          <li>
            We do not read your maps or lessons for any purpose other than showing them back
            to you and fixing the software when something breaks.
          </li>
        </ul>
      </Section>

      <Section title="Deleting things">
        <p>
          Every map and lesson has a delete control in the sidebar, and deleting one removes
          the row. To delete your account and everything attached to it, email{' '}
          <a href={mailto('delete my account')}>{CONTACT_EMAIL}</a>{' '}
          and we will do it and confirm. If you are in the UK, EU or somewhere with similar
          rules, the same address is where to ask for a copy of your data or to object to us
          holding it.
        </p>
      </Section>

      <Section title="Children">
        <p>
          nipsol is not intended for children under 13, and we do not knowingly keep data
          about them. If you believe a child has an account here, write to us and we will
          remove it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes in a way that affects what we collect or who it goes to, the
          date at the top changes and we will say so in the product. See also the{' '}
          <Link href="/terms">terms</Link>.
        </p>
      </Section>
    </LegalPage>
  )
}
