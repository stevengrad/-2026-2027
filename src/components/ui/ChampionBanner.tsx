import { BadgeCheck, ChevronLeft, Crown, ShieldCheck, Sparkles, Trophy as TrophyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicMatches, usePublicTeams } from '../../hooks/useTournament';
import { getTournamentChampion } from '../../lib/champion';
import { BRAND, SEASON } from '../../lib/brand';
import { num } from '../../lib/format';
import { Trophy } from '../art/Trophy';
import { SaintFrame } from './SaintFrame';

/** Site-wide official winner announcement. It remains hidden until the final is completed. */
export function ChampionBanner({ featured = false, pinnedEnabled = true }: { featured?: boolean; pinnedEnabled?: boolean }) {
  const bannerRef = useRef<HTMLElement | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const { data: matches = [] } = usePublicMatches();
  const { data: teams = [] } = usePublicTeams();
  const champion = getTournamentChampion(matches, teams);

  // Reveal a slim, fixed champion bar only after the full announcement has scrolled away.
  useEffect(() => {
    const element = bannerRef.current;
    if (!element || !champion || !pinnedEnabled || typeof IntersectionObserver === 'undefined') {
      setShowPinned(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setShowPinned(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    }, { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [champion?.teamId, pinnedEnabled, featured]);

  if (!champion) return null;

  const { finalMatch: match } = champion;
  const winnerScore = champion.wonAtHome ? (match.home_score ?? 0) : (match.away_score ?? 0);
  const opponentScore = champion.wonAtHome ? (match.away_score ?? 0) : (match.home_score ?? 0);
  const opponentName = champion.wonAtHome ? match.away_saint : match.home_saint;
  const score = `${num(winnerScore)} – ${num(opponentScore)}`;
  const winnerPens = champion.wonAtHome ? match.home_pens : match.away_pens;
  const opponentPens = champion.wonAtHome ? match.away_pens : match.home_pens;
  const penaltyScore = match.decision === 'penalties' && winnerPens != null && opponentPens != null
    ? `${num(winnerPens)} – ${num(opponentPens)}`
    : null;

  return (
    <>
    <section
      ref={bannerRef}
      aria-label={`بطل ${BRAND}: فريق ${champion.teamName}`}
      className={`champion-banner relative isolate overflow-hidden border-b border-gold/60 ${featured ? 'champion-banner-featured' : 'champion-banner-compact'}`}
      dir="rtl"
    >
      <div className="champion-rays pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="champion-spark champion-spark-one pointer-events-none absolute" aria-hidden="true" />
      <div className="champion-spark champion-spark-two pointer-events-none absolute" aria-hidden="true" />

      <div className={`relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 text-center sm:flex-row sm:text-start ${featured ? 'py-8 sm:py-10' : 'py-4 sm:py-5'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
          <div className={`champion-portrait-wrap relative shrink-0 ${featured ? 'champion-portrait-featured' : 'champion-portrait-compact'}`}>
            <div className="champion-halo absolute -inset-3 rounded-[2rem]" aria-hidden="true" />
            <SaintFrame
              name={champion.teamName}
              path={champion.portraitPath}
              className={`champion-portrait relative ${featured ? 'w-28 sm:w-36' : 'w-20 sm:w-24'}`}
            />
            <span className="absolute -end-2 -top-3 grid h-8 w-8 place-items-center rounded-full border border-gold bg-midnight text-gold shadow-lg" aria-label="الفريق البطل">
              <Crown className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/65 bg-gold/15 px-3 py-1 text-[11px] font-extrabold tracking-wide text-gold sm:text-xs">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" /> البطل الرسمي للبطولة
              </span>
              <span className="font-heading text-[10px] font-bold tracking-[0.18em] text-gold/70" dir="ltr">THE CHAMPIONS</span>
            </div>
            <h2 className={`gold-sheen truncate font-heading font-black leading-tight ${featured ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>
              فريق {champion.teamName}
            </h2>
            <p className={`mt-2 flex items-center justify-center gap-2 text-ivory/90 sm:justify-start ${featured ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              فاز على {opponentName ? `فريق ${opponentName}` : 'الفريق المنافس'} في المباراة النهائية
            </p>
            {champion.teamNumber != null && (
              <p className="mt-1 text-[11px] font-semibold text-ivory/60">الفريق رقم {num(champion.teamNumber)} · {BRAND} {SEASON}</p>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center justify-center gap-4 rounded-2xl border border-gold/30 bg-midnight/55 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.28)] backdrop-blur-sm sm:w-auto sm:min-w-64">
          <div className="min-w-0 text-center">
            <span className="block text-[10px] font-bold text-gold/80">نتيجة النهائي · البطل أولًا</span>
            <strong className={`num mt-0.5 block font-heading font-black text-ivory ${featured ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`} dir="ltr">{score}</strong>
            {penaltyScore && <span className="mt-0.5 block text-[10px] text-gold">بركلات الترجيح {penaltyScore}</span>}
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-100"><Sparkles className="h-3 w-3 text-gold" /> حسم اللقب</span>
          </div>
          <div className="relative shrink-0">
            <div className="absolute inset-0 scale-125 rounded-full bg-gold/15 blur-xl" aria-hidden="true" />
            <Trophy className={`champion-trophy relative drop-shadow-[0_8px_16px_rgba(0,0,0,.55)] ${featured ? 'h-28 sm:h-32' : 'h-20 sm:h-24'}`} />
          </div>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-2 border-t border-gold/20 bg-midnight/35 px-4 py-2.5 text-center sm:justify-between">
        <p className="text-[11px] font-semibold text-gold/90 sm:text-xs">
          <TrophyIcon className="me-1 inline h-3.5 w-3.5" aria-hidden="true" /> أبطال الموسم — الكأس ذهبت إلى أصحابها!
        </p>
        <div className="flex items-center gap-2">
          <Link to={`/teams/${champion.teamId}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-ivory hover:text-gold">
            ملف الأبطال <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <span className="h-3 w-px bg-gold/30" aria-hidden="true" />
          <Link to="/knockout" className="inline-flex items-center gap-1 text-[11px] font-bold text-ivory hover:text-gold">
            شاهد طريق التتويج <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>

    {showPinned && pinnedEnabled && (
      <div className="champion-pinned fixed inset-x-0 top-16 z-20 border-b border-gold/70 shadow-[0_10px_28px_rgba(0,0,0,.42)]" dir="rtl" role="status" aria-live="polite" aria-label={`البطل الرسمي: فريق ${champion.teamName}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-4">
          <div className="champion-pinned-portrait shrink-0">
            <SaintFrame name={champion.teamName} path={champion.portraitPath} className="w-11" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold/15 px-2 py-0.5 text-[9px] font-extrabold text-gold sm:text-[10px]">
                <Crown className="h-3 w-3" aria-hidden="true" /> البطل الرسمي
              </span>
              <span className="hidden text-[9px] font-bold tracking-widest text-gold/60 sm:inline" dir="ltr">THE CHAMPIONS</span>
            </div>
            <p className="mt-0.5 truncate font-heading text-sm font-black text-ivory sm:text-base">فريق {champion.teamName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 border-s border-gold/25 ps-2 sm:ps-4">
            <span className="hidden text-[10px] font-bold text-gold/80 sm:inline">نتيجة النهائي</span>
            <strong className="num font-heading text-sm font-black text-gold sm:text-base" dir="ltr">{score}</strong>
            <Trophy className="champion-trophy h-9 w-9 sm:h-10 sm:w-10" />
          </div>
          <Link to={`/teams/${champion.teamId}`} className="hidden rounded-lg border border-gold/35 px-2.5 py-1.5 text-[10px] font-bold text-ivory transition hover:bg-gold/10 sm:inline-flex">ملف الأبطال</Link>
        </div>
      </div>
    )}
    </>
  );
}
