/**
 * Where "get in touch" goes.
 *
 * One constant, because it was three: the beta section, the terms and the
 * privacy policy each had their own copy, and an address that is right in two
 * places out of three is worse than one that is wrong in all of them —
 * somebody writes to the dead one and hears nothing back.
 *
 * Swap this for a company address when there is one.
 */
export const CONTACT_EMAIL = 'jawadelyo5@gmail.com'

/** A mailto with the subject already filled in, so replies arrive sorted. */
export function mailto(subject: string) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`nipsol — ${subject}`)}`
}
