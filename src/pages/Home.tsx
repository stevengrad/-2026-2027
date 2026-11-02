import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ClipboardList, Goal, Medal, Shuffle, Swords, Trophy as TrophyIcon, Users, type LucideIcon } from 'lucide-react';
import { Countdown } from '../components/ui/Countdown';
import { CrossMark } from '../components/ui/CrossMark';
import { DavidEmblem } from '../components/art/DavidEmblem';
import { SaintFrame } from '../components/ui/SaintFrame';
import { SaintAvatar } from '../components/ui/SaintAvatar';
import { VerseBanner } from '../components/ui/VerseBanner';
import { MatchCard } from '../components/matches/MatchCard';
import { StadiumScene } from '../components/art/StadiumScene';
import { Football } from '../components/art/Football';
import { Trophy } from '../components/art/Trophy';
import { Divider } from '../components/art/Ornament';
import { Empty } from '../components/ui/States';
import { usePublicMatches, usePublicTeams, useScorers, useTournament, useCountdown } from '../hooks/useTournament';
import { BRAND, MOTTO, SEASON, TAGLINE } from '../lib/brand';
import { num } from '../lib/format';

const STEPS: [LucideIcon, string, string][] = [
  [ClipboardList, 'التسجيل', 'سجّل فريقك أو انضم كلاعب حتى ٧ نوفمبر'],
  [CheckCircle2, 'الاعتماد', 'تراجع الإدارة الفرق وتعتمدها'],
  [Shuffle, 'المجموعات', 'قرعة عادلة إلى مجموعات من ٣ أو ٤ فرق'],
  [Swords, 'الأدوار الإقصائية', 'يتأهل الأوائل إلى ربع ونصف النهائي'],
  [TrophyIcon, 'النهائي', 'مباراة واحدة تحسم الكأس'],
];

export default function Home() {
  const { data: t } = useTournament();
  const teams = usePublicTeams().data ?? [];
  const matches = usePublicMatches().data ?? [];
  const scorers = useScorers().data ?? [];
  const closed = useCountdown(t?.registration_deadline).closed;
  const players = teams.reduce((a, x) => a + x.players_count, 0);
  const done = matches.filter((m) => m.status === 'completed');
  const goals = done.reduce((a, m) => a + (m.home_score ?? 0) + (m.away_score ?? 0), 0);
  const upcoming = matches.filter((m) => m.status === 'scheduled' || m.status === 'live').slice(0, 3);
  const recent = [...done].reverse().slice(0, 3);
  const stats: [LucideIcon, string, number][] = [[Users, 'فريق معتمد', teams.length], [Medal, 'لاعب', players], [Swords, 'مباراة أُقيمت', done.length], [Goal, 'هدف مسجَّل', goals]];

  return (<>
    {/* HERO — floodlit stadium */}
    <section className="relative isolate overflow-hidden border-b border-gold/20">
      <StadiumScene />
      <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_45%,rgb(16_24_32/.82),transparent_75%)]" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[680px] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center sm:min-h-[780px]">
        <div className="mb-4 animate-rise"><DavidEmblem className="w-32 sm:w-40" /></div>
        <p className="mb-3 animate-rise font-heading text-lg text-gold [animation-delay:.1s]">{TAGLINE}</p>
        <h1 className="animate-rise text-4xl font-extrabold leading-tight [animation-delay:.2s] sm:text-6xl sm:leading-[1.15]">{BRAND}<span className="gold-sheen mt-1 block animate-shine" dir="ltr">{SEASON}</span></h1>
        <p className="mx-auto mt-5 max-w-xl animate-rise text-ivory/85 [animation-delay:.3s] sm:text-lg">بطولة تجمعنا في روح واحدة — سجّل فريقك أو انضم كلاعب، وتابع المباريات والنتائج لحظة بلحظة.</p>
        <div className="mt-8 animate-rise [animation-delay:.4s]"><p className="mb-3 text-sm text-ivory/75">الوقت المتبقي لإغلاق التسجيل</p><Countdown deadline={t?.registration_deadline} /></div>
        <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:.5s] sm:flex-row">
          <Link to="/register" className="btn-gold !px-8 text-lg">{closed ? 'انتهى موعد التسجيل' : 'سجّل فريقك'}</Link>
          <Link to="/groups" className="btn-ghost bg-midnight/40 !px-8 text-lg backdrop-blur">لوحة البطولة</Link></div>
      </div>
      <Football className="absolute bottom-6 start-[7%] hidden h-20 w-20 animate-ball drop-shadow-[0_18px_14px_rgb(0_0_0/.5)] lg:block" />
    </section>

    {/* VERSE */}
    <section className="mx-auto max-w-5xl px-4 py-10"><VerseBanner variant="banner" /></section>

    {/* STATS */}
    <section aria-label="إحصائيات البطولة" className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4 sm:gap-4">
      {stats.map(([Icon, label, v]) => (<div key={label} className="panel flex flex-col items-center gap-1 px-3 py-5 text-center">
        <Icon className="h-7 w-7 text-gold" aria-hidden="true" /><div className="num font-heading text-3xl">{num(v)}</div><div className="text-sm text-ivory/70">{label}</div></div>))}</section>

    {/* MOTTO — the big, loud moment */}
    <section aria-label="شعار الدوري" className="relative mt-10 overflow-hidden border-y-4 border-gold-deep bg-gold text-midnight">
      <div className="pattern-cross absolute inset-0 opacity-40 mix-blend-multiply" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center sm:py-14">
        <CrossMark className="h-9 w-9" />
        <p className="font-heading text-3xl font-extrabold leading-snug sm:text-5xl sm:leading-tight">{MOTTO.text.replace(/[\u064B-\u0652]/g, '')}</p>
        <span className="rounded-full bg-midnight px-5 py-1.5 font-heading text-sm font-bold text-gold">{MOTTO.reference}</span></div>
    </section>

    {/* ABOUT + TROPHY */}
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-[1fr_auto]">
      <div><h2 className="h-section mb-3">منافسة شريفة… ومحبة أكبر</h2>
        <p className="max-w-2xl leading-8 text-ivory/80">{t?.description_ar ?? 'دوري كرة القدم لأسرة أنبياء يجمع الشباب في أجواء من الروح الرياضية والمحبة. كل فريق يحمل اسم قدّيس، ونلعب لنتعلم الجهاد الحسن ونفرح معاً.'}</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link to="/register" className="btn-gold">انضم الآن</Link><Link to="/teams" className="btn-ghost">تعرّف على الفرق</Link></div></div>
      <div className="relative mx-auto w-64"><DavidEmblem className="w-full" />
        <Trophy className="absolute -bottom-4 -start-8 h-28 w-auto drop-shadow-[0_10px_20px_rgb(0_0_0/.6)]" /></div>
    </section>

    {/* FORMAT — a true sequence */}
    <section className="border-y border-gold/15 bg-emerald/30 py-14"><div className="mx-auto max-w-6xl px-4">
      <h2 className="h-section mb-2 text-center">رحلة البطولة</h2><Divider className="mb-8" />
      <ol className="grid gap-4 md:grid-cols-5">{STEPS.map(([Icon, title, desc], i) => (
        <li key={title} className="panel relative flex flex-col items-center gap-2 p-5 text-center">
          <span className="absolute -top-3 left-1/2 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full bg-gold text-sm font-bold text-midnight">{num(i + 1)}</span>
          <Icon className="mt-2 h-8 w-8 text-gold" aria-hidden="true" /><h3 className="font-heading">{title}</h3><p className="text-sm text-ivory/70">{desc}</p></li>))}</ol></div></section>

    {/* TEAMS */}
    <section className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-5 flex items-center justify-between"><h2 className="h-section">الفرق المشاركة</h2><Link to="/teams" className="text-gold hover:underline">عرض الكل</Link></div>
      {teams.length === 0 ? <Empty>لم يتم اعتماد أي فرق حتى الآن.</Empty>
        : <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{teams.slice(0, 4).map((x) => <Link to={`/teams/${x.id}`} key={x.id} className="card flex flex-col items-center gap-3 text-center">
            <SaintFrame name={x.saint_name_ar} path={x.portrait_path} className="w-24" /><span className="font-heading text-sm">{x.saint_name_ar}</span></Link>)}</div>}
    </section>

    {/* MATCHES */}
    <section className="bg-emerald/25 py-14"><div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
      {([['المباريات القادمة', upcoming, 'لا توجد مباريات معلنة حالياً.'], ['آخر النتائج', recent, 'لا توجد نتائج بعد.']] as const).map(([title, list, empty]) => (
        <div key={title}><h2 className="h-section mb-4">{title}</h2>{list.length === 0 ? <Empty>{empty}</Empty> : <div className="space-y-3">{list.map((m) => <MatchCard key={m.id} m={m} />)}</div>}</div>))}</div></section>

    {/* SCORERS */}
    <section className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-5 flex items-center justify-between"><h2 className="h-section">صدارة الهدافين</h2><Link to="/scorers" className="text-gold hover:underline">القائمة الكاملة</Link></div>
      {scorers.length === 0 ? <Empty>لم يتم تسجيل أهداف حتى الآن.</Empty> : <div className="grid gap-3 sm:grid-cols-3">{scorers.slice(0, 3).map((s) => (
        <div key={s.player_id} className="card flex items-center gap-3"><SaintAvatar name={s.saint_name_ar} path={s.portrait_path} />
          <div className="min-w-0 flex-1"><div className="truncate font-heading">{s.full_name_ar}</div><div className="truncate text-sm text-ivory/70">{s.saint_name_ar}</div></div>
          <div className="text-center"><div className="num font-heading text-2xl text-gold">{num(s.goals)}</div><Goal className="mx-auto h-4 w-4 text-ivory/60" aria-hidden="true" /></div></div>))}</div>}
    </section>

    <section className="mx-auto max-w-5xl px-4 pb-16"><VerseBanner variant="feature" />
      <div className="mt-8 text-center text-sm text-ivory/70"><CalendarDays className="mx-auto mb-1 h-5 w-5 text-gold" aria-hidden="true" />آخر موعد للتسجيل: ٧ نوفمبر ٢٠٢٦ — ١١:٥٩ مساءً بتوقيت القاهرة</div></section>
  </>);
}
