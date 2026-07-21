// Shared email validation helpers. Mirrors api/utils/validators.py so the
// client and server agree on what a valid Brandeis address looks like.

export const BRANDEIS_DOMAIN = '@brandeis.edu';

// Exactly one "@", a non-empty local part with no whitespace, and a dotted
// domain. Deliberately strict enough to reject "@brandeis.edu" and addresses
// containing spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isBrandeisEmail(email: string): boolean {
  return isValidEmail(email) && email.toLowerCase().endsWith(BRANDEIS_DOMAIN);
}
