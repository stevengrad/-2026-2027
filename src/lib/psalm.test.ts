import { describe, it, expect } from 'vitest';
import { PSALM } from './psalm';

describe('psalm 124 page text', () => {
  const all = [PSALM.title, PSALM.number, ...PSALM.stanzas.flat()].join(' ');
  it('is Arabic only (no Latin letters)', () => expect(/[A-Za-z]/.test(all)).toBe(false));
  it('has the right title and number', () => { expect(PSALM.title).toBe('المتوكلون على الرب'); expect(PSALM.numeral).toBe('١٢٤'); });
  it('starts with the title line and ends with the alleluia', () => {
    expect(PSALM.stanzas[0][0].startsWith('المتوكلون على الرب مثل جبل صهيون')).toBe(true);
    expect(PSALM.stanzas[1][2].endsWith('هلليلويا.')).toBe(true);
  });
  it('is the new psalm, not the old one', () => expect(all.includes('لولا أن الرب')).toBe(false));
});
