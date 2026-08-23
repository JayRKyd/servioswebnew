import Link from 'next/link'

/** Servios brand mark — extracted from the client's brand book with a
 *  transparent background (source: docs/brand). Native size 330x318. */
export function ServiosMark({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/servios-mark.png"
      alt=""
      height={size}
      width={Math.round(size * (330 / 318))}
      className="shrink-0"
    />
  )
}

/** Mark + lowercase wordmark, linked home. Matches the brand book lockup. */
export function ServiosLogo({ href = '/', markSize = 30 }: { href?: string; markSize?: number }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <ServiosMark size={markSize} />
      <span className="text-[19px] font-semibold text-[#171717] tracking-[-0.03em] leading-none">servios</span>
    </Link>
  )
}
