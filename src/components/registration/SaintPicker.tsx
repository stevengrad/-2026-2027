import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { SaintAvatar } from '../ui/SaintAvatar';
import { Empty, ErrorNote, Skeleton } from '../ui/States';
import { supabase } from '../../lib/supabase';
import { norm } from '../../lib/format';

interface Saint { id: string; name_ar: string; description_ar: string | null; portrait_path: string | null }

export function SaintPicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const [q, setQ] = useState('');
  const { data, isLoading, isError } = useQuery({ queryKey: ['available_saints'], enabled: !!supabase,
    queryFn: async () => { const { data, error } = await supabase!.from('public_available_saints').select('*').order('name_ar'); if (error) throw error; return data as Saint[]; } });
  const shown = (data ?? []).filter((s) => norm(s.name_ar).includes(norm(q)));
  const chosen = data?.find((s) => s.id === value);
  return (<fieldset className="space-y-3"><legend className="mb-1 font-semibold">اسم القديس (اسم الفريق)</legend>
    <div className="relative"><Search className="pointer-events-none absolute start-3 top-3 h-5 w-5 text-muted" aria-hidden="true" />
      <input className="field !ps-10" placeholder="ابحث عن قديس…" aria-label="ابحث عن قديس" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {isLoading && <Skeleton className="h-40" />}{isError && <ErrorNote />}
    {data && data.length === 0 && <Empty>لم تُتح قائمة القديسين بعد، يرجى المحاولة لاحقاً.</Empty>}
    {data && data.length > 0 && <div role="radiogroup" aria-label="القديسون المتاحون" className="grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto rounded-xl border border-ivory/10 p-2 sm:grid-cols-3">
      {shown.length === 0 && <p className="col-span-full p-4 text-center text-ivory/70">لا توجد نتائج مطابقة.</p>}
      {shown.map((s) => (<label key={s.id} className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-2 text-center transition focus-within:outline focus-within:outline-2 focus-within:outline-gold ${value === s.id ? 'border-gold bg-gold/10' : 'border-ivory/10 hover:border-gold/40'}`}>
        <input type="radio" name="saint" className="sr-only" checked={value === s.id} onChange={() => onChange(s.id)} />
        <SaintAvatar name={s.name_ar} path={s.portrait_path} className="h-16 w-16" shape="circle" fit="cover" /><span className="font-heading text-sm">{s.name_ar}</span></label>))}</div>}
    {chosen && <p className="text-sm text-gold">تم اختيار: {chosen.name_ar}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}</fieldset>);
}
