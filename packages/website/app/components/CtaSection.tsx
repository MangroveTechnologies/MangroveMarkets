import { LINKS } from '@/lib/branding'

export default function CtaSection() {
  return (
    <section id="launch" className="relative z-[2] py-24 pb-28 text-center">
      <div className="container mx-auto px-8">
        <div className="glass-card max-w-[760px] mx-auto p-12 rounded-3xl shadow-panel">
          <h2 className="font-display font-bold text-[clamp(2rem,4vw,3.25rem)] mb-4">
            Launch with the Market
          </h2>
          <p className="text-white/75 mb-8">
            We are building the infrastructure for Agents. Join the
            early access list to shape the central hub for agentic DEX
            access.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={LINKS.github}
              className="btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View the Repo
            </a>
            <a href={LINKS.earlyAccess} className="btn-secondary">
              Request Access
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
