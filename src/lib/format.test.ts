import { describe, it, expect } from 'vitest';
import { cairoLocalToIso, deadlineLabel, isoToCairoLocal } from './format';
import { REGISTRATION_DEADLINE, isRegistrationOpen } from './tournament';

describe('extended registration deadline: Friday 13 Nov 2026, 12:00 am (Africa/Cairo)', () => {
  it('is the instant 22:00 UTC on Thursday 12 Nov (Cairo is UTC+2 in November)', () => expect(REGISTRATION_DEADLINE.toISOString()).toBe('2026-11-12T22:00:00.000Z'));
  it('still open one second before, closed at the deadline', () => {
    expect(isRegistrationOpen(new Date('2026-11-12T21:59:59Z'))).toBe(true);
    expect(isRegistrationOpen(new Date('2026-11-12T22:00:00Z'))).toBe(false);
  });
  it('the old 7 Nov deadline no longer applies: 9 Nov is open again', () => expect(isRegistrationOpen(new Date('2026-11-09T10:00:00Z'))).toBe(true));
  it('label is Arabic, Cairo time', () => expect(deadlineLabel(REGISTRATION_DEADLINE.toISOString())).toContain('الجمعة'));
});

describe('datetime-local <-> Cairo', () => {
  it('round trip', () => expect(isoToCairoLocal(cairoLocalToIso('2026-11-13T00:00')!)).toBe('2026-11-13T00:00'));
  it('Friday midnight Cairo', () => expect(cairoLocalToIso('2026-11-13T00:00')).toBe('2026-11-12T22:00:00.000Z'));
  it('rejects empty/garbage', () => { expect(cairoLocalToIso('')).toBeNull(); expect(cairoLocalToIso('soon')).toBeNull(); });
});
