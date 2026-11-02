import { BookOpen, ShieldCheck } from 'lucide-react';
import { Divider } from '../components/art/Ornament';
import { VerseBanner } from '../components/ui/VerseBanner';

const PSALM_LINES = [
  'لولا أن الرب كان معنا، ليقل إسرائيل،',
  'لولا أن الرب كان معنا عندما قام الناس علينا، لابتلعونا ونحن أحياء عند سخط غضبهم علينا،',
  'إذن لغرقنا في الماء، وعبرت نفوسنا السيل،',
  'بل جازت نفوسنا الماء الذي لا نهاية له.',
  'مبارك الرب الذي لم يسلمنا فريسة لأسنانهم،',
  'نجت أنفسنا مثل العصفور من فخ الصيادين، الفخ انكسر ونحن نجونا.',
  'عوننا باسم الرب الذي صنع السماء والأرض. هللويا.',
];

/** The preservation psalm supplied by the tournament organiser. */
export default function PsalmPreservation() {
  return <div className="pattern-cross min-h-full bg-gradient-to-b from-emerald/35 via-midnight to-midnight py-12 sm:py-16">
    <section className="mx-auto max-w-5xl px-4 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold/60 bg-emerald/80 text-gold shadow-lg shadow-black/30"><ShieldCheck className="h-7 w-7" aria-hidden="true" /></div>
      <p className="mt-4 font-heading text-gold">صلاة وتأمل</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">مزمور الحفظ</h1>
      <p className="mt-3 text-ivory/75">المزمور المائة والثالث والعشرون</p>
      <Divider className="my-7" />

      <figure className="overflow-hidden rounded-2xl border-2 border-gold/50 bg-midnight p-1 shadow-2xl shadow-black/35">
        <img src="/assets/psalm-preservation.png" alt="مزمور الحفظ: لولا أن الرب كان معنا" className="w-full rounded-xl" />
        <figcaption className="px-4 py-3 text-xs text-ivory/65">النص والصورة مقدمان من أسرة أنبياء.</figcaption>
      </figure>

      <article className="mt-8 rounded-2xl border border-ivory/10 bg-emerald/50 px-5 py-7 text-right shadow-lg shadow-black/20 sm:px-10 sm:py-10" aria-label="نص مزمور الحفظ">
        <h2 className="mb-6 text-center font-heading text-xl text-gold">عوننا باسم الرب</h2>
        <div className="space-y-4 text-xl leading-[2.1] text-ivory sm:text-2xl">{PSALM_LINES.map((line) => <p key={line}>{line}</p>)}</div>
      </article>

      <div className="mt-8"><VerseBanner variant="feature" /></div>
      <a href="https://stevengrad.github.io/Bible-Study/" target="_blank" rel="noreferrer" className="btn-gold mt-8"><BookOpen className="h-5 w-5" />انتقل إلى دراسة الكتاب المقدس</a>
    </section>
  </div>;
}
