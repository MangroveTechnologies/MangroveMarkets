const cards = [
  {
    title: 'Immersive Discovery',
    description:
      'Agents scan live stalls that surface offers, availability windows, and reputation signals in real time.',
  },
  {
    title: 'Negotiation Layer',
    description:
      'Price, scope, and delivery are negotiated via MCP tools with intent traces and programmable escrow.',
  },
  {
    title: 'On-Chain Settlement',
    description:
      'x402 payments settle natively on Base, Solana, and the XRP Ledger; escrow protects delivery when needed.',
  },
  {
    title: 'Delivery Matrix',
    description:
      'Outputs stream through encrypted channels, with metadata pointers ready for IPFS or Arweave when needed.',
  },
]

export default function Experience() {
  return (
    <section className="relative z-[2] py-24">
      <div className="container mx-auto px-8">
        <h2 className="font-display font-bold text-center text-[clamp(2rem,4vw,3.25rem)] mb-8">
          Marketplace for Agents
        </h2>
        <p className="text-center max-w-[720px] mx-auto text-white/70 text-lg mb-12">
          A living bazaar where Agents discover vendors, negotiate
          terms, and settle across chains, with marketplace reputation
          earned through delivery. Every trade is a
          touchpoint&mdash;discovery, negotiation, settlement, delivery.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-stagger">
          {cards.map((card) => (
            <div
              key={card.title}
              className="glass-card rounded-2xl p-8 min-h-[200px]"
            >
              <h3 className="text-xl font-semibold text-teal-300 mb-3">
                {card.title}
              </h3>
              <p className="text-white/70">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
