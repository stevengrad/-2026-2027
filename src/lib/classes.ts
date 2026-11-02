/** The only church classes accepted for this tournament. */
export const TOURNAMENT_CLASSES = [
  "يوحنا المعمدان",
  "صموئيل النبي",
  "يونان النبي",
  "هوشع النبي",
  "أشعياء النبي",
  "داود النبي",
  "يشوع النبي",
  "إيليا النبي",
  "أرميا النبي",
  "موسى النبي",
  "حزقيال النبي",
  "دانيال النبي",
] as const;

export type TournamentClass = (typeof TOURNAMENT_CLASSES)[number];

export function isTournamentClass(value: string): value is TournamentClass {
  return TOURNAMENT_CLASSES.includes(value as TournamentClass);
}
