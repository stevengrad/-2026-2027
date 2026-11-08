import { BookOpen, ShieldCheck } from 'lucide-react';
import { Divider } from '../components/art/Ornament';
import { VerseBanner } from '../components/ui/VerseBanner';
import { PSALM } from '../lib/psalm';

/** The preservation psalm supplied by the tournament organiser (text only, Arabic). */
export default function PsalmPreservation() {
  return <div className="pattern-cross min-h-full bg-gradient-to-b from-emerald/35 via-midnight to-midnight py-12 sm:py-16">
    <section className="mx-auto max-w-3xl px-4 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold/60 bg-emerald/80 text-gold shadow-lg shadow-black/30"><ShieldCheck className="h-7 w-7" aria-hidden="true" /></div>
      <p className="mt-4 font-heading text-gold">مزمور الحفظ</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{PSALM.title}</h1>
      <p className="mt-3 text-ivory/75">المزمور {PSALM.number} ({PSALM.numeral})</p>
      <Divider className="my-7" />

      <article className="rounded-2xl border-2 border-gold/50 bg-emerald/60 px-5 py-8 text-center shadow-2xl shadow-black/35 sm:px-12 sm:py-12" aria-label={`نص المزمور ${PSALM.numeral}: ${PSALM.title}`}>
        {PSALM.stanzas.map((stanza, i) => <div key={i}>
          {i > 0 && <Divider className="my-8" />}
          <div className="space-y-4 text-xl font-bold leading-[2.2] text-ivory sm:text-2xl sm:leading-[2.3]">{stanza.map((line) => <p key={line}>{line}</p>)}</div>
        </div>)}
        <p className="mt-8 text-xs text-ivory/60">النص مقدَّم من أسرة أنبياء.</p>
      </article>

      <div className="mt-8"><VerseBanner variant="feature" /></div>
      <a href="https://stevengrad.github.io/Bible-Study/" target="_blank" rel="noreferrer" className="btn-gold mt-8"><BookOpen className="h-5 w-5" aria-hidden="true" />انتقل إلى دراسة الكتاب المقدس</a>
    </section>
  </div>;
}
