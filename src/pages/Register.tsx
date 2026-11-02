import { useState } from 'react';
import { CheckCircle2, Shield, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Countdown } from '../components/ui/Countdown';
import { IndividualRegistrationForm, TeamRegistrationForm } from '../components/registration/Forms';
import { useCountdown, useTournament } from '../hooks/useTournament';

type Mode = 'choose' | 'team' | 'individual' | 'done-team' | 'done-individual';

export default function Register() {
  const { data: t } = useTournament();
  const closed = useCountdown(t?.registration_deadline).closed;
  const [mode, setMode] = useState<Mode>('choose');
  const done = mode.startsWith('done');
  return (<div className="mx-auto max-w-2xl px-4 py-10">
    <h1 className="mb-2 text-center text-3xl font-bold">سجّل فريقك في البطولة</h1>
    {!closed && !done && <div className="my-6"><Countdown deadline={t?.registration_deadline} /></div>}
    {closed && !done ? (<div className="card mt-8 text-center"><p className="font-heading text-xl text-gold">انتهى موعد التسجيل، نراكم في مباريات البطولة!</p>
      <Link to="/teams" className="btn-ghost mt-5">تصفّح الفرق</Link></div>)
    : mode === 'choose' ? (<div className="mt-6 space-y-4"><p className="text-center text-lg">هل لديك فريق بالفعل؟</p>
        <button className="card flex w-full items-center gap-4 text-start" onClick={() => setMode('team')}><Shield className="h-10 w-10 text-gold" aria-hidden="true" /><span><b className="block font-heading">نعم، لدي فريق</b><span className="text-sm text-ivory/70">سجّل فريقك واختر قديسه</span></span></button>
        <button className="card flex w-full items-center gap-4 text-start" onClick={() => setMode('individual')}><UserPlus className="h-10 w-10 text-gold" aria-hidden="true" /><span><b className="block font-heading">لا، ليس لدي فريق</b><span className="text-sm text-ivory/70">سجّل كلاعب وسنضمك إلى فريق</span></span></button></div>)
    : mode === 'team' ? (<><button className="mb-4 text-gold hover:underline" onClick={() => setMode('choose')}>→ رجوع</button><TeamRegistrationForm onDone={() => setMode('done-team')} /></>)
    : mode === 'individual' ? (<><button className="mb-4 text-gold hover:underline" onClick={() => setMode('choose')}>→ رجوع</button><IndividualRegistrationForm onDone={() => setMode('done-individual')} /></>)
    : (<div role="status" className="card mt-8 space-y-3 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden="true" />
        {mode === 'done-team' ? (<><h2 className="text-2xl font-bold">تم استلام طلب فريقك بنجاح!</h2><p>فريقك الآن في انتظار مراجعة واعتماد إدارة البطولة.</p></>)
          : (<><h2 className="text-2xl font-bold">تم تسجيل بياناتك بنجاح!</h2><p>سيتم ضمك إلى فريق جديد مع لاعبين آخرين، وبعد مراجعة الإدارة سيتم إعلان فريقك.</p></>)}
        <Link to="/" className="btn-gold mt-2">العودة للرئيسية</Link></div>)}
  </div>);
}
