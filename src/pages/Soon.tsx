import { CrossMark } from '../components/ui/CrossMark';
export default function Soon({ title }: { title: string }) {
  return (<div className="mx-auto max-w-xl px-4 py-20 text-center"><CrossMark className="mx-auto mb-4 h-12 w-12 text-gold" /><h1 className="mb-3 text-3xl font-bold">{title}</h1>
    <p className="text-ivory/70">تعذّر العثور على هذه الصفحة. عُد إلى الرئيسية وتابع البطولة.</p></div>);
}
