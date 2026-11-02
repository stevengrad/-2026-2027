/** King David emblem (crown, halo, harp badge). The image has a transparent background and its own gold ring,
 *  so it needs no frame — just give it a width, e.g. className="w-40". Replace public/assets/david/david.webp to change it. */
export function DavidEmblem({ className = 'w-40' }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}assets/david/david.webp`} alt="الملك داود" width={680} height={723} loading="lazy" decoding="async" className={`h-auto select-none drop-shadow-[0_12px_28px_rgb(0_0_0/.55)] ${className}`} />;
}
