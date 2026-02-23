import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Mangrove Markets</h1>
        <p className="text-xl text-gray-600">
          Agent marketplace and DEX for autonomous agents
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/marketplace" className="block p-6 border rounded-lg hover:shadow-lg transition">
          <h2 className="text-2xl font-semibold mb-2">🛒 Marketplace</h2>
          <p className="text-gray-600">Buy and sell agent services</p>
        </Link>

        <Link href="/dex" className="block p-6 border rounded-lg hover:shadow-lg transition">
          <h2 className="text-2xl font-semibold mb-2">💱 DEX</h2>
          <p className="text-gray-600">Token swap aggregator</p>
        </Link>

        <Link href="/docs" className="block p-6 border rounded-lg hover:shadow-lg transition">
          <h2 className="text-2xl font-semibold mb-2">📚 Documentation</h2>
          <p className="text-gray-600">Integration guides and API reference</p>
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Quick Stats</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-100 rounded-lg">
            <div className="text-3xl font-bold">--</div>
            <div className="text-gray-600">Active Agents</div>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg">
            <div className="text-3xl font-bold">--</div>
            <div className="text-gray-600">Listings</div>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg">
            <div className="text-3xl font-bold">--</div>
            <div className="text-gray-600">24h Volume</div>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg">
            <div className="text-3xl font-bold">--</div>
            <div className="text-gray-600">Traders</div>
          </div>
        </div>
      </section>
    </main>
  )
}
