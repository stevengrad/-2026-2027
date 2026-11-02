import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  CheckCircle,
  Edit2,
  Trash2,
  UploadCloud,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SaintAvatar } from '../../components/ui/SaintAvatar';
import { Empty, ErrorNote, Skeleton } from '../../components/ui/States';
import { num } from '../../lib/format';

export type ImageRights = 'public_domain' | 'licensed' | 'permission_granted' | 'user_owned' | 'unknown';

export const RIGHTS_LABEL: Record<ImageRights, string> = {
  public_domain: 'ملكية عامة (Public Domain)',
  licensed: 'مرخّصة (Licensed)',
  permission_granted: 'إذن كتابي (Permission Granted)',
  user_owned: 'ملكية خاصة/تصميمنا (User Owned)',
  unknown: 'غير مؤكدة (Unknown)',
};

interface SaintRecord {
  id: string;
  name_ar: string;
  letter: string;
  description_ar: string | null;
  portrait_path: string | null;
  image_rights: ImageRights;
  image_source_site: string | null;
  image_attribution: string | null;
  image_rights_notes: string | null;
  is_approved: boolean;
  is_active: boolean;
  sort_order: number;
}

export default function AdminSaints() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'no_portrait'>('all');

  // Modal State
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingSaint, setEditingSaint] = useState<SaintRecord | null>(null);

  // Form Fields
  const [nameAr, setNameAr] = useState('');
  const [letter, setLetter] = useState('أ');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [portraitPath, setPortraitPath] = useState('');
  const [imageRights, setImageRights] = useState<ImageRights>('user_owned');
  const [attribution, setAttribution] = useState('');
  const [sourceSite, setSourceSite] = useState('');
  const [rightsNotes, setRightsNotes] = useState('');
  const [isApproved, setIsApproved] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch all saints
  const { data: saints, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin_all_saints'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('saints')
        .select('*')
        .order('name_ar');
      if (error) throw error;
      return (data as SaintRecord[]) ?? [];
    },
  });

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const openAddModal = () => {
    clearMessages();
    setEditingSaint(null);
    setNameAr('');
    setLetter('أ');
    setDescriptionAr('');
    setPortraitPath('');
    setImageRights('user_owned');
    setAttribution('');
    setSourceSite('');
    setRightsNotes('');
    setIsApproved(true);
    setIsActive(true);
    setIsOpenModal(true);
  };

  const openEditModal = (s: SaintRecord) => {
    clearMessages();
    setEditingSaint(s);
    setNameAr(s.name_ar);
    setLetter(s.letter);
    setDescriptionAr(s.description_ar ?? '');
    setPortraitPath(s.portrait_path ?? '');
    setImageRights(s.image_rights);
    setAttribution(s.image_attribution ?? '');
    setSourceSite(s.image_source_site ?? '');
    setRightsNotes(s.image_rights_notes ?? '');
    setIsApproved(s.is_approved);
    setIsActive(s.is_active);
    setIsOpenModal(true);
  };

  // Upload image to Supabase Storage "saints" bucket
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    setUploadingFile(true);
    clearMessages();
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
      const cleanName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('saints').upload(cleanName, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadErr) throw uploadErr;
      setPortraitPath(cleanName);
      setSuccess('تم رفع الأيقونة بنجاح إلى وحدة التخزين.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذّر رفع الصورة.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveSaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !supabase) return;
    clearMessages();

    // Constraint validation: portrait_requires_rights check
    // (portrait_path is null or image_rights <> 'unknown' or not is_approved)
    if (portraitPath.trim() && imageRights === 'unknown' && isApproved) {
      setError('لا يمكن اعتماد أيقونة قديس بحقوق ملكية مجهولة (Unknown). يرجى تحديد حقوق استخدام الأيقونة أولاً.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name_ar: nameAr.trim(),
        letter: letter.trim() || nameAr.trim().charAt(0),
        description_ar: descriptionAr.trim() || null,
        portrait_path: portraitPath.trim() || null,
        image_rights: imageRights,
        image_attribution: attribution.trim() || null,
        image_source_site: sourceSite.trim() || null,
        image_rights_notes: rightsNotes.trim() || null,
        is_approved: isApproved,
        is_active: isActive,
      };

      if (editingSaint) {
        const { error: err } = await supabase.from('saints').update(payload).eq('id', editingSaint.id);
        if (err) throw err;
        setSuccess(`تم تحديث بيانات القديس "${nameAr}" بنجاح.`);
      } else {
        const { error: err } = await supabase.from('saints').insert(payload);
        if (err) throw err;
        setSuccess(`تمت إضافة القديس "${nameAr}" بنجاح.`);
      }

      setIsOpenModal(false);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذّر حفظ بيانات القديس.';
      setError(msg.includes('unique') ? 'اسم القديس مسجل بالفعل.' : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (saint: SaintRecord) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف "${saint.name_ar}"؟`) || !supabase) return;
    clearMessages();
    setBusy(true);
    try {
      const { error: err } = await supabase.from('saints').delete().eq('id', saint.id);
      if (err) throw err;
      setSuccess(`تم حذف "${saint.name_ar}" بنجاح.`);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذّر الحذف.';
      setError(msg.includes('restrict') ? 'لا يمكن حذف هذا القديس لأنه مرتبط بفريق موجود.' : msg);
    } finally {
      setBusy(false);
    }
  };

  const filteredSaints = (saints ?? [])
    .filter((s) => {
      if (filter === 'approved') return s.is_approved && s.is_active;
      if (filter === 'pending') return !s.is_approved;
      if (filter === 'no_portrait') return !s.portrait_path;
      return true;
    })
    .filter((s) => {
      if (!search.trim()) return true;
      return s.name_ar.toLowerCase().includes(search.trim().toLowerCase());
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/10 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">إدارة القديسين والأيقونات</h1>
          <p className="mt-1 text-sm text-ivory/70">
            إضافة وتعديل أسماء القديسين، إدارة حقوق الملكية للأيقونات، والتحقق من اعتمادها قبل النشر.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="btn-ghost !min-h-9 !px-3 text-xs"
            disabled={busy || isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={openAddModal}
            className="btn-gold !min-h-9 !px-4 text-xs font-bold"
          >
            <Plus className="h-4 w-4" />
            إضافة قديس جديد
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'all' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            الكل ({num(saints?.length ?? 0)})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'approved' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            المعتمدون ({num((saints ?? []).filter((s) => s.is_approved && s.is_active).length)})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'pending' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            بانتظار الاعتماد ({num((saints ?? []).filter((s) => !s.is_approved).length)})
          </button>
          <button
            onClick={() => setFilter('no_portrait')}
            className={`btn !min-h-9 !px-3 text-xs ${
              filter === 'no_portrait' ? 'bg-gold text-midnight' : 'border border-ivory/20 text-ivory/80'
            }`}
          >
            بدون أيقونة ({num((saints ?? []).filter((s) => !s.portrait_path).length)})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
          <input
            className="field !min-h-9 !ps-9 text-xs"
            placeholder="بحث عن قديس…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Saints Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : isError ? (
        <ErrorNote>تعذّر تحميل قائمة القديسين.</ErrorNote>
      ) : filteredSaints.length === 0 ? (
        <Empty>لا توجد نتائج مطابقة.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredSaints.map((s) => (
            <div key={s.id} className="card !p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3">
                  <SaintAvatar name={s.name_ar} path={s.portrait_path} className="h-16 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-heading text-sm font-bold text-gold">
                      {s.name_ar}
                    </h2>
                    <span className="text-[11px] text-ivory/60">حرف: {s.letter}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.is_approved ? (
                        <span className="inline-flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold">
                          <CheckCircle className="h-3 w-3" /> معتمد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-yellow-400/15 px-1.5 py-0.5 text-[10px] text-yellow-300">
                          بانتظار الاعتماد
                        </span>
                      )}
                      {!s.is_active && (
                        <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">
                          معطل
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-ivory/10 pt-2 text-[11px] text-ivory/70">
                  <p className="truncate" title={RIGHTS_LABEL[s.image_rights]}>
                    الحقوق: <span className="text-ivory/90">{RIGHTS_LABEL[s.image_rights]}</span>
                  </p>
                  {s.image_attribution && (
                    <p className="truncate text-ivory/60" title={s.image_attribution}>
                      النسبة: {s.image_attribution}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-ivory/10 pt-3">
                <button
                  onClick={() => openEditModal(s)}
                  className="btn-ghost !min-h-8 !px-2.5 text-xs"
                  title="تعديل بيانات القديس"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="btn-ghost !min-h-8 !px-2 text-xs text-danger hover:border-danger hover:text-danger"
                  title="حذف القديس"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-gold/40 bg-midnight p-6 shadow-2xl my-8">
            <h2 className="font-heading text-lg font-bold text-gold">
              {editingSaint ? `تعديل بيانات: ${editingSaint.name_ar}` : 'إضافة قديس جديد'}
            </h2>

            <form onSubmit={handleSaveSaint} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="s-name">
                  اسم القديس (بالعربية): *
                </label>
                <input
                  id="s-name"
                  className="field text-xs"
                  placeholder="مثال: القديس مارمرقس الرسول"
                  value={nameAr}
                  onChange={(e) => {
                    setNameAr(e.target.value);
                    if (!letter || letter === 'أ') {
                      setLetter(e.target.value.trim().charAt(0) || 'أ');
                    }
                  }}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="s-letter">
                    حرف الترتيب الأبجدي: *
                  </label>
                  <input
                    id="s-letter"
                    className="field text-xs text-center font-heading text-lg"
                    maxLength={2}
                    value={letter}
                    onChange={(e) => setLetter(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="s-rights">
                    حقوق ملكية الأيقونة: *
                  </label>
                  <select
                    id="s-rights"
                    className="field text-xs"
                    value={imageRights}
                    onChange={(e) => setImageRights(e.target.value as ImageRights)}
                  >
                    <option value="user_owned">تصميم خاص / ملكنا</option>
                    <option value="public_domain">ملكية عامة (Public Domain)</option>
                    <option value="permission_granted">إذن كتابي (Permission)</option>
                    <option value="licensed">مرخصة (Licensed)</option>
                    <option value="unknown">مجهولة (لا يمكن نشرها معتمدة)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="s-desc">
                  نبذة مختصرة عن القديس (اختياري):
                </label>
                <textarea
                  id="s-desc"
                  className="field !min-h-[60px] text-xs"
                  placeholder="كاروز الديار المصرية والشهيد العظيم..."
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                />
              </div>

              {/* Upload or enter portrait path */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-ivory">
                  مسار الأيقونة (Portrait Path في Supabase Storage):
                </label>
                <div className="flex gap-2">
                  <input
                    className="field text-xs"
                    placeholder="مثال: mark.webp"
                    value={portraitPath}
                    onChange={(e) => setPortraitPath(e.target.value)}
                  />
                  <label className="btn-ghost !min-h-11 !px-3 text-xs cursor-pointer shrink-0">
                    <UploadCloud className="h-4 w-4" />
                    <span>{uploadingFile ? 'جارٍ الرفع…' : 'رفع ملف'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="s-attr">
                    النسبة والملكية (Attribution):
                  </label>
                  <input
                    id="s-attr"
                    className="field text-xs"
                    placeholder="اسم الفنان أو المصدر"
                    value={attribution}
                    onChange={(e) => setAttribution(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ivory" htmlFor="s-source">
                    رابط أو موقع المصدر:
                  </label>
                  <input
                    id="s-source"
                    className="field text-xs"
                    placeholder="https://..."
                    value={sourceSite}
                    onChange={(e) => setSourceSite(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-ivory">
                  <input
                    type="checkbox"
                    checked={isApproved}
                    onChange={(e) => setIsApproved(e.target.checked)}
                    className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold"
                  />
                  <span>معتمد للنشر في الموقع (Approved)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-ivory">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-ivory/30 bg-midnight text-gold focus:ring-gold"
                  />
                  <span>نشط ومتاح للاختيار (Active)</span>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-ivory/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="btn-ghost !min-h-9 !px-3 text-xs"
                  disabled={busy}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-gold !min-h-9 !px-4 text-xs font-bold"
                  disabled={busy || uploadingFile}
                >
                  {busy ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
