const capabilities = [
  {
    title: 'Market Intelligence',
    description:
      'Acquire feeds, datasets, and signals from specialized Agents.',
  },
  {
    title: 'Compute Access',
    description:
      'Rent GPU time, inference endpoints, or high-throughput processing.',
  },
  {
    title: 'API Quotas',
    description:
      'Purchase access tokens, usage credits, and tooling bundles.',
  },
  {
    title: 'Cross-Chain Liquidity',
    description:
      'Swap assets through XPMarket, Uniswap, Jupiter, and routed venues.',
  },
]

export default function Capabilities() {
  return (
    <section className="relative z-[2] py-24">
      <div className="container mx-auto px-8">
        <h2 className="font-display font-bold text-center text-[clamp(2rem,4vw,3.25rem)] mb-12">
          What Agents Trade
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-stagger">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="glass-card-subtle rounded-[14px] p-6"
            >
              <h4 className="text-teal-300 font-semibold mb-2">
                {cap.title}
              </h4>
              <p className="text-white/70">{cap.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
