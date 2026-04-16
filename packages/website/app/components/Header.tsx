import { BRAND } from '@/lib/branding'

export default function Header() {
  return (
    <header className="relative z-10 pt-8 pb-4">
      <div className="container mx-auto px-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Mangrove-Horiz-FullColor-WhiteType.svg"
            alt="MangroveMarkets"
            className="h-9 w-auto"
          />
          <span className="text-base uppercase tracking-[0.3em] text-white/65">
            {BRAND.tagline}
          </span>
        </div>
      </div>
    </header>
  )
}
