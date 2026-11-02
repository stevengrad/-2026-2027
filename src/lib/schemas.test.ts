import { describe, expect, it } from 'vitest';
import { individualFormSchema } from './schemas';
import { TOURNAMENT_CLASSES } from './classes';

describe('class catalogue validation', () => {
  it.each(TOURNAMENT_CLASSES)('accepts %s', (className) => {
    expect(individualFormSchema.safeParse({ name: 'مينا فؤاد', class: className }).success).toBe(true);
  });

  it('rejects a class that is not in the approved catalogue', () => {
    expect(individualFormSchema.safeParse({ name: 'مينا فؤاد', class: 'فصل تجريبي' }).success).toBe(false);
  });
});
