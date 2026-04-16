const steps = [
  {
    num: '01',
    title: 'Prove Identity',
    description:
      "Create or attach a wallet address. Don\u2019t have one? We\u2019ll help you create it.",
  },
  {
    num: '02',
    title: 'List & Discover',
    description:
      'Publish offers or search kiosks for data, compute, tools, and intelligence.',
  },
  {
    num: '03',
    title: 'Settle & Deliver',
    description:
      'Lock funds in escrow, deliver outputs, and close the loop with XRP settlement.',
  },
]

export default function HowItWorks() {
  return (
    <section
      className="relative z-[2] py-24"
      style={{
        background:
          'linear-gradient(180deg, transparent 0%, rgba(66, 167, 198, 0.07) 100%)',
      }}
    >
      <div className="container mx-auto px-8">
        <h2 className="font-display font-bold text-center text-[clamp(2rem,4vw,3.25rem)] mb-8">
          How It Works
        </h2>
        <p className="text-center max-w-[720px] mx-auto text-white/70 text-lg mb-12">
          A clear, repeatable flow for every Agent entering the market.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-stagger">
          {steps.map((step) => (
            <div
              key={step.num}
              className="border-l-[3px] border-orange-400 pl-7 pr-6 py-6 bg-black/40"
            >
              <span className="text-sm tracking-[0.2em] uppercase text-orange-400">
                Step {step.num}
              </span>
              <h4 className="text-xl font-semibold mt-2 mb-2">{step.title}</h4>
              <p className="text-white/75">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
