export const Skeleton = ({ className = 'h-40' }: { className?: string }) => <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-ivory/10 ${className}`} />;
export const Empty = ({ children }: { children: string }) => <p className="rounded-2xl border border-dashed border-ivory/20 p-8 text-center text-ivory/70">{children}</p>;
export const ErrorNote = ({ children = 'تعذّر تحميل البيانات، حاول مرة أخرى.' }: { children?: string }) => <p role="alert" className="rounded-2xl border border-danger/50 bg-danger/10 p-4 text-center">{children}</p>;
