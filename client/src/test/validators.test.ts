/**
 * Unit tests for the shared email validators (client mirror of
 * api/utils/validators.py). Exercises format + @brandeis.edu domain rules
 * directly, free of DOM / HTML5 constraint-validation interference.
 */

import { describe, it, expect } from 'vitest';
import { isValidEmail, isBrandeisEmail } from '../utils/validators';

describe('isValidEmail', () => {
  it('accepts a well-formed address', () => {
    expect(isValidEmail('alice@brandeis.edu')).toBe(true);
    expect(isValidEmail('bob@gmail.com')).toBe(true);
  });

  it('rejects an empty local part', () => {
    expect(isValidEmail('@brandeis.edu')).toBe(false);
  });

  it('rejects addresses with whitespace', () => {
    expect(isValidEmail('a b@brandeis.edu')).toBe(false);
    expect(isValidEmail(' alice@brandeis.edu')).toBe(false);
  });

  it('rejects a domain without a dot', () => {
    expect(isValidEmail('alice@brandeis')).toBe(false);
  });

  it('rejects empty / missing @', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('alice.brandeis.edu')).toBe(false);
  });
});

describe('isBrandeisEmail', () => {
  it('accepts a valid @brandeis.edu address (case-insensitive)', () => {
    expect(isBrandeisEmail('alice@brandeis.edu')).toBe(true);
    expect(isBrandeisEmail('Alice@Brandeis.EDU')).toBe(true);
  });

  it('rejects a valid non-brandeis address', () => {
    expect(isBrandeisEmail('alice@gmail.com')).toBe(false);
  });

  it('rejects a structurally-invalid brandeis-looking address', () => {
    expect(isBrandeisEmail('@brandeis.edu')).toBe(false);
    expect(isBrandeisEmail('a b@brandeis.edu')).toBe(false);
  });
});
