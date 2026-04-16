/**
 * MarketOrbit — the hero graphic from the production site.
 * Three concentric rings with floating kiosk labels and a branded core.
 */
export default function MarketOrbit() {
  const kiosks = [
    { label: 'Data', sub: 'Feeds', className: 'top-[4%] left-[20%]' },
    { label: 'Compute', sub: 'GPU Pools', className: 'top-[18%] right-[6%]' },
    { label: 'Signals', sub: 'Intel', className: 'bottom-[18%] right-[10%]' },
    {
      label: 'Liquidity',
      sub: 'DEX ACCESS',
      className: 'bottom-[6%] left-[8%]',
    },
    { label: 'Tools', sub: 'APIs', className: 'top-[45%] -left-[4%]' },
  ]

  return (
    <div className="relative min-h-[380px] grid place-items-center">
      <div className="relative w-[min(420px,80vw)] h-[min(420px,80vw)]">
        {/* Glow background */}
        <div
          className="absolute -inset-[10%] -z-10 blur-md"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgba(116, 195, 213, 0.15), transparent 50%), radial-gradient(circle at 70% 70%, rgba(255, 158, 24, 0.15), transparent 50%)',
          }}
        />

        {/* Orbit rings */}
        <div className="absolute inset-0 rounded-full border border-teal-300/35 shadow-[inset_0_0_40px_rgba(66,167,198,0.15)]" />
        <div className="absolute inset-[14%] rounded-full border border-orange-400/30 shadow-[inset_0_0_40px_rgba(66,167,198,0.15)]" />
        <div className="absolute inset-[28%] rounded-full border border-white/20 shadow-[inset_0_0_40px_rgba(66,167,198,0.15)]" />

        {/* Core */}
        <div
          className="absolute inset-[35%] rounded-[18px] grid place-items-center gap-2 text-center p-4"
          style={{
            background:
              'linear-gradient(145deg, rgba(16, 22, 27, 0.9), rgba(12, 15, 18, 0.8))',
            border: '1px solid rgba(116, 195, 213, 0.3)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Mangrove-M-Full.svg"
            alt="Mangrove mark"
            className="w-12 h-auto"
          />
          <span className="text-xs uppercase tracking-[0.2em] text-white/60">
            Market Core
          </span>
        </div>

        {/* Kiosks */}
        {kiosks.map((k) => (
          <div
            key={k.label}
            className={`absolute px-3.5 py-2.5 rounded-xl bg-glass border border-glass-border text-sm uppercase tracking-[0.12em] text-white/80 backdrop-blur-sm ${k.className}`}
          >
            {k.label}
            <span className="block text-[0.65rem] text-white/55 mt-1">
              {k.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
