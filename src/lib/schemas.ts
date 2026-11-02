import { z } from 'zod';
// Mirrors supabase/functions/_shared/http.ts. The server is authoritative; this is for instant feedback.
export const arabicName = z.string().trim().min(2, 'الاسم قصير جداً').max(80, 'الاسم طويل جداً')
  .regex(/^[\u0600-\u06FF\u0750-\u077F][\u0600-\u06FF\u0750-\u077F .'-]*$/, 'اكتب الاسم بالحروف العربية');
export const className = z.string().trim().min(1, 'اسم الفصل مطلوب').max(60, 'اسم الفصل طويل جداً');
export const teamFormSchema = z.object({
  saintId: z.string().min(1, 'اختر قديساً من القائمة'),
  players: z.array(z.object({ name: arabicName, class: className })).min(1, 'أضف لاعباً واحداً على الأقل').max(7, 'الحد الأقصى ٧ لاعبين'),
}).superRefine((v, ctx) => {
  const seen = new Set<string>();
  v.players.forEach((p, i) => { const k = p.name.trim().toLowerCase();
    if (seen.has(k)) ctx.addIssue({ code: 'custom', path: ['players', i, 'name'], message: 'هذا اللاعب مكرر في القائمة' }); seen.add(k); });
});
export const individualFormSchema = z.object({ name: arabicName, class: className });
export type TeamForm = z.infer<typeof teamFormSchema>;
export type IndividualForm = z.infer<typeof individualFormSchema>;
