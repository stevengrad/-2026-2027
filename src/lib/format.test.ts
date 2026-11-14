import { describe, it, expect } from 'vitest';
import { cairoLocalToIso, deadlineLabel, isoToCairoLocal } from './format';
import { REGISTRATION_DEADLINE, isRegistrationOpen } from './tournament';

describe('extended registration deadline: Saturday 14 Nov 2026, 9:00 pm (Africa/Cairo)', () => {
  it('is the instant 19:00 UTC on Saturday 14 Nov (Cairo is UTC+2 in November)', () => expect(REGISTRATION_DEADLINE.toISOString()).toBe('2026-11-14T19:00:00.000Z'));
  it('still open one second before, closed at the deadline', () => {
    expect(isRegistrationOpen(new Date('2026-11-14T18:59:59Z'))).toBe(true);
    expect(isRegistrationOpen(new Date('2026-11-14T19:00:00Z'))).toBe(false);
  });
  it('the old 7 Nov deadline no longer applies: 14 Nov afternoon is open', () => expect(isRegistrationOpen(new Date('2026-11-14T12:00:00Z'))).toBe(true));
  it('label is Arabic, Cairo time', () => {
    const label = deadlineLabel(REGISTRATION_DEADLINE.toISOString());
    expect(label).toContain('السبت');
    expect(label).toContain('٩:٠٠');
  });
});

describe('datetime-local <-> Cairo', () => {
  it('round trip', () => expect(isoToCairoLocal(cairoLocalToIso('2026-11-14T21:00')!)).toBe('2026-11-14T21:00'));
  it('Saturday 9:00 pm Cairo', () => expect(cairoLocalToIso('2026-11-14T21:00')).toBe('2026-11-14T19:00:00.000Z'));
  it('rejects empty/garbage', () => { expect(cairoLocalToIso('')).toBeNull(); expect(cairoLocalToIso('soon')).toBeNull(); });
});
