// Single source of truth for the tournament identity shown in the UI.
export const BRAND = 'دوري كرة القدم لأسرة أنبياء';
export const SEASON = '٢٠٢٦/٢٠٢٧';
export const BRAND_SHORT = 'دوري أسرة أنبياء';
export const TAGLINE = 'حيث تلتقي المنافسة بالمحبة';

export interface Verse { text: string; reference: string }

/** Sports-themed verses (Arabic Van Dyck text, as used in the Coptic Orthodox Church).
 *  The owner should proof-read them against their printed edition; the first one can also be
 *  overridden from the database (tournaments.bible_verse_text / bible_verse_reference). */
export const SPORT_VERSES: Verse[] = [
  { text: 'أَلَسْتُمْ تَعْلَمُونَ أَنَّ الَّذِينَ يَرْكُضُونَ فِي الْمَيْدَانِ جَمِيعَهُمْ يَرْكُضُونَ، وَلكِنَّ وَاحِدًا يَأْخُذُ الْجَعَالَةَ؟ هكَذَا اركُضُوا لِكَيْ تَنَالُوا. وَكُلُّ مَنْ يُجَاهِدُ يَضْبِطُ نَفْسَهُ فِي كُلِّ شَيْءٍ.', reference: '١ كورنثوس ٩: ٢٤، ٢٥' },
  { text: 'قَدْ جَاهَدْتُ الْجِهَادَ الْحَسَنَ، أَكْمَلْتُ السَّعْيَ، حَفِظْتُ الإِيمَانَ.', reference: '٢ تيموثاوس ٤: ٧' },
  { text: 'أَسْعَى نَحْوَ الْغَرَضِ لأَجْلِ جَعَالَةِ دَعْوَةِ اللهِ الْعُلْيَا فِي الْمَسِيحِ يَسُوعَ.', reference: 'فيلبي ٣: ١٤' },
];

/** The league's motto verse (Philippians 4:13). */
export const MOTTO: Verse = { text: 'أَسْتَطِيعُ كُلَّ شَيْءٍ فِي الْمَسِيحِ الَّذِي يُقَوِّينِي.', reference: 'فيلبي ٤: ١٣' };
