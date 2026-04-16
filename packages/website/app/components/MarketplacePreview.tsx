const listings = [
  {
    title: 'Compute Burst Pods',
    vendor: 'Drift Labs',
    delivery: '12 min delivery',
    price: '48 XRP',
  },
  {
    title: 'Realtime Trading Signals',
    vendor: 'Tidewatch',
    delivery: '3 min delivery',
    price: '22 XRP',
  },
  {
    title: 'On\u2011chain Identity Pack',
    vendor: 'Mangrove',
    delivery: 'Instant',
    price: 'Free',
  },
]

const signals = ['+14 new vendors', 'Escrowed settlement', 'Reputation verified']

export default function MarketplacePreview() {
  return (
    <section className="relative z-[2] py-24">
      <div className="container mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Copy side */}
          <div>
            <h2 className="font-display font-bold text-left text-[clamp(2rem,4vw,3.25rem)] mb-6">
              Marketplace, visualized
            </h2>
            <p className="text-white/75 text-lg mb-6">
              Agents arrive to get on&#8209;chain, then move through a
              living catalog of vendors, offers, and live signals.
              Mangrove makes the on&#8209;chain journey
              tangible&nbsp;&mdash; your wallet is your ticket.
              Don&rsquo;t have one? We&rsquo;ve got you covered.
            </p>
            <ul className="grid gap-3">
              {[
                "Your wallet is your ticket. Don\u2019t have one? We\u2019ve got you covered.",
                'Verified vendors, escrowed delivery, and trustless settlement',
                'Live marketplace signals for price, availability, and demand',
              ].map((item) => (
                <li
                  key={item}
                  className="relative pl-6 text-white/70 before:content-['\u2713'] before:absolute before:left-0 before:text-orange-400 before:font-bold"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Visual side — glassmorphic marketplace mockup */}
          <div
            className="glass-card rounded-3xl p-8 relative overflow-hidden shadow-card"
            aria-label="Marketplace preview mockup"
          >
            {/* Decorative glow */}
            <div className="absolute -top-[60px] -right-[60px] w-[180px] h-[180px] bg-[radial-gradient(circle,rgba(255,158,24,0.3)_0%,transparent_70%)] pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center mb-6 relative">
              <div>
                <strong className="text-white">Mangrove Marketplace</strong>
                <div className="text-sm text-white/60">
                  Live listings &bull; Multi-chain
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-orange-400/[0.16] text-orange-400 text-xs uppercase tracking-wider font-bold">
                Preview
              </span>
            </div>

            {/* Listing cards */}
            <div className="grid gap-4">
              {listings.map((listing) => (
                <div
                  key={listing.title}
                  className="bg-charcoal/85 border border-white/[0.08] rounded-[14px] px-5 py-4 flex justify-between items-center gap-4"
                >
                  <div>
                    <h4 className="text-base font-semibold text-teal-300 mb-1">
                      {listing.title}
                    </h4>
                    <div className="text-sm text-white/60">
                      Vendor: {listing.vendor} &bull; {listing.delivery}
                    </div>
                  </div>
                  <div className="text-orange-400 font-bold text-base whitespace-nowrap">
                    {listing.price}
                  </div>
                </div>
              ))}
            </div>

            {/* Signal chips */}
            <div className="flex flex-wrap gap-2 mt-6">
              {signals.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
