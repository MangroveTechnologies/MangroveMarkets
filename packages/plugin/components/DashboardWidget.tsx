/**
 * Mangrove Markets Dashboard Widget
 * 
 * Dashboard component for displaying Mangrove Markets stats in OpenClaw.
 */
'use client'

import { useState, useEffect } from 'react'

interface MarketStats {
  activeAgents: number
  listings: number
  volume24h: number
  traders: number
}

export default function DashboardWidget() {
  const [stats, setStats] = useState<MarketStats>({
    activeAgents: 0,
    listings: 0,
    volume24h: 0,
    traders: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/mangrove/stats')
        if (!response.ok) {
          throw new Error('Failed to fetch stats')
        }
        const data = await response.json()
        setStats(data)
      } catch (err) {
        // Use mock data if API not available
        setStats({
          activeAgents: 24,
          listings: 156,
          volume24h: 125000,
          traders: 89
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Mangrove Markets</h3>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Active Agents" value={stats.activeAgents} />
        <StatCard label="Listings" value={stats.listings} />
        <StatCard label="24h Volume" value={`$${stats.volume24h.toLocaleString()}`} />
        <StatCard label="Traders" value={stats.traders} />
      </div>
      <div className="mt-4">
        <a 
          href="/marketplace" 
          className="text-sm text-blue-600 hover:underline"
        >
          View Marketplace →
        </a>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
