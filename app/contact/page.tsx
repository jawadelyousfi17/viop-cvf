import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/marketing/LegalPage'
import { CONTACT_EMAIL, mailto } from '@/lib/contact'

export const metadata: Metadata = {
  title: 'Contact — nipsol',
  description: 'How to reach the people who make nipsol.',
}

/**
 * One address, four reasons to use it.
 *
 * Not a form. A form on a two-person product is a way of making someone type
 * into a box and then wonder whether it went anywhere — and it would need a
 * mailbox, a spam filter and somewhere to store what people wrote. The email
 * goes to a person who answers.
 */
export default function Contact() {
  return (
    <LegalPage title="Contact" updated="10 August 2026">
      <Section title="Write to us">
        <p>
          Everything reaches the same place:{' '}
          <a href={mailto('hello')}>{CONTACT_EMAIL}</a>. A real person reads it, usually the
          person who wrote the part you are writing about.
        </p>
      </Section>

      <Section title="Something is broken, or wrong">
        <p>
          The most useful message you can send. If a board drew the wrong thing, a lesson
          explained something badly, or a solution has a mistake in it, say what you asked for
          and what you got —{' '}
          <a href={mailto('feedback')}>send feedback</a>. At this size, that changes the
          product in days rather than quarters.
        </p>
      </Section>

      <Section title="Investing">
        <p>
          We are in beta and raising. If you back things at this stage,{' '}
          <a href={mailto('investment')}>get in touch</a> — we would rather talk early than
          pitch late.
        </p>
      </Section>

      <Section title="Your account and your data">
        <p>
          To get a copy of everything we hold about you, or to delete your account and
          everything in it, <a href={mailto('delete my account')}>ask here</a> and we will do
          it and confirm. See <a href="/privacy">privacy</a> for what is held in the first
          place.
        </p>
      </Section>
    </LegalPage>
  )
}
