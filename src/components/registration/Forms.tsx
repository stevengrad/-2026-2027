import { useCallback, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { SaintPicker } from './SaintPicker';
import { Turnstile, turnstileConfigured } from '../ui/Turnstile';
import { ApiError, callFunction } from '../../lib/supabase';
import { IndividualForm, TeamForm, individualFormSchema, teamFormSchema } from '../../lib/schemas';
import { num } from '../../lib/format';
import { TOURNAMENT_CLASSES } from '../../lib/classes';

const Err = ({ m }: { m?: string }) => (m ? <p role="alert" className="mt-1 text-sm text-danger">{m}</p> : null);

/** Shared submit logic: one idempotency key per form, fresh Turnstile token per attempt, double-click safe. */
function useSubmit(
  fn: 'register-team' | 'register-player',
  onDone: () => void,
  onServerIssues?: (issues: { path: string; message: string }[]) => void
) {
  const key = useRef(crypto.randomUUID());
  const [token, setToken] = useState(''); const [widget, setWidget] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const onToken = useCallback((t: string) => setToken(t), []);
  const submit = async (body: object) => {
    if (busy) return; setBusy(true); setError(''); setIssues([]);
    try {
      await callFunction(fn, { ...body, turnstileToken: token, idempotencyKey: key.current });
      onDone();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        if (e.issues && e.issues.length > 0) {
          setIssues(e.issues);
          onServerIssues?.(e.issues);
        }
      } else {
        setError('حدث خطأ غير متوقع.');
      }
      setToken('');
      setWidget((w) => w + 1);
    } finally {
      setBusy(false);
    }
  };
  return { submit, busy, error, issues, canSend: !!token && !busy && turnstileConfigured, captcha: <Turnstile key={widget} onToken={onToken} /> };
}

export function TeamRegistrationForm({ onDone }: { onDone: () => void }) {
  const { control, register, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<TeamForm>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { saintId: '', players: [{ name: '', class: '' }, { name: '', class: '' }, { name: '', class: '' }, { name: '', class: '' }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'players' });
  const s = useSubmit('register-team', onDone, (issues) => {
    issues.forEach((iss) => {
      // Map server error path to form field so red flags appear under the invalid inputs
      setFieldError(iss.path as any, { type: 'server', message: iss.message });
    });
  });
  return (<form onSubmit={handleSubmit((v) => s.submit(v))} className="space-y-6" noValidate>
    <Controller control={control} name="saintId" render={({ field }) => <SaintPicker value={field.value} onChange={field.onChange} error={errors.saintId?.message} />} />
    <fieldset className="space-y-3"><legend className="mb-1 font-semibold">اللاعبون ({num(fields.length)} من ٧)</legend><p className="text-sm text-ivory/70">الحد الأدنى لتسجيل فريق هو ٤ لاعبين، والحد الأقصى ٧ لاعبين.</p>
      {fields.map((f, i) => (<div key={f.id} className="card space-y-2 !p-4"><div className="flex items-center justify-between"><span className="font-heading text-gold">اللاعب {num(i + 1)}</span>
        {fields.length > 4 && <button type="button" onClick={() => remove(i)} className="text-danger" aria-label={`حذف اللاعب ${num(i + 1)}`}><Trash2 className="h-5 w-5" /></button>}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><input className="field" placeholder="اسم اللاعب" aria-label={`اسم اللاعب ${num(i + 1)}`} {...register(`players.${i}.name`)} /><Err m={errors.players?.[i]?.name?.message} /></div>
          <div><label className="sr-only" htmlFor={`team-player-class-${i}`}>فصل اللاعب {num(i + 1)}</label><select id={`team-player-class-${i}`} className="field" aria-label={`فصل اللاعب ${num(i + 1)}`} defaultValue="" {...register(`players.${i}.class`)}><option value="" disabled>اختر الفصل…</option>{TOURNAMENT_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}</select><Err m={errors.players?.[i]?.class?.message} /></div></div></div>))}
      {fields.length < 7 && <button type="button" className="btn-ghost w-full" onClick={() => append({ name: '', class: '' })}><Plus className="h-5 w-5" />إضافة لاعب</button>}
      <Err m={errors.players?.root?.message ?? errors.players?.message} /></fieldset>
    {s.captcha}
    {s.error && (
      <div role="alert" className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-center space-y-2">
        <p className="font-semibold text-danger">{s.error}</p>
        {s.issues.length > 0 && (
          <ul className="text-xs text-danger/90 list-disc list-inside text-start space-y-1">
            {s.issues.map((iss, idx) => (
              <li key={idx}>
                {iss.path ? <span className="font-mono text-ivory/80">({iss.path}) </span> : null}
                <span>{iss.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )}
    <button className="btn-gold w-full" disabled={!s.canSend}>{s.busy ? 'جارٍ الإرسال…' : 'إرسال طلب الفريق'}</button></form>);
}

export function IndividualRegistrationForm({ onDone }: { onDone: () => void }) {
  const { register, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<IndividualForm>({
    resolver: zodResolver(individualFormSchema)
  });
  const s = useSubmit('register-player', onDone, (issues) => {
    issues.forEach((iss) => {
      setFieldError(iss.path as any, { type: 'server', message: iss.message });
    });
  });
  return (<form onSubmit={handleSubmit((v) => s.submit(v))} className="space-y-4" noValidate>
    <div><label className="mb-1 block font-semibold" htmlFor="pn">الاسم الكامل</label><input id="pn" className="field" {...register('name')} /><Err m={errors.name?.message} /></div>
    <div><label className="mb-1 block font-semibold" htmlFor="pc">الفصل</label><select id="pc" className="field" defaultValue="" {...register('class')}><option value="" disabled>اختر الفصل…</option>{TOURNAMENT_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}</select><Err m={errors.class?.message} /></div>
    {s.captcha}
    {s.error && (
      <div role="alert" className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-center space-y-2">
        <p className="font-semibold text-danger">{s.error}</p>
        {s.issues.length > 0 && (
          <ul className="text-xs text-danger/90 list-disc list-inside text-start space-y-1">
            {s.issues.map((iss, idx) => (
              <li key={idx}>
                {iss.path ? <span className="font-mono text-ivory/80">({iss.path}) </span> : null}
                <span>{iss.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )}
    <button className="btn-gold w-full" disabled={!s.canSend}>{s.busy ? 'جارٍ الإرسال…' : 'تسجيل بياناتي'}</button></form>);
}
