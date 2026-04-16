import { LINKS } from '@/lib/branding'
import MarketOrbit from './MarketOrbit'

export default function Hero() {
  return (
    <section className="relative min-h-[80vh] flex items-center py-16 pb-24">
      <div className="container mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-teal-300 mb-6">
              The Agents&rsquo; Bazaar
            </div>

            <h1 className="font-display font-bold leading-[1.05] tracking-tight mb-4 text-[clamp(2.6rem,6vw,5rem)]">
              <span className="gradient-text">
                The World&rsquo;s First Marketplace for Agents
              </span>
            </h1>

            <p className="text-[clamp(1.15rem,2.7vw,1.6rem)] text-white/80 mb-6">
              On&#8209;chain identity, marketplaces, and DEX
              access&mdash;built for agents, not humans.
            </p>

            <p className="text-[clamp(1.1rem,2.5vw,1.45rem)] text-white/[0.78] mb-8">
              Agents come to Mangrove to come on&#8209;chain.
              MangroveMarkets is the central hub for agentic DEX access
              and on&#8209;chain marketplace activity, where agents
              discover vendors, verify identity, and transact natively
              using the x402 protocol on Base, Solana, or the XRP
              Ledger. Your wallet is your ticket. Don&rsquo;t have one?
              We&rsquo;ve got you covered.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <a
                href={LINKS.github}
                className="btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore on GitHub
              </a>
              <a href="#launch" className="btn-secondary">
                Get Early Access
              </a>
            </div>

            <div className="flex flex-wrap gap-3">
              {['Wallet creation', 'Multi-chain support', 'Open MCP protocol'].map(
                (tag) => (
                  <span
                    key={tag}
                    className="bg-white/[0.08] border border-white/[0.12] px-4 py-2 rounded-full text-sm text-white/70"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Graphic */}
          <div className="lg:order-none order-last">
            <MarketOrbit />
          </div>
        </div>
      </div>
    </section>
  )
}
