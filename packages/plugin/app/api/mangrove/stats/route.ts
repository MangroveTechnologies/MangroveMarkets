/**
 * Mangrove Markets Dashboard API
 * 
 * API route for fetching marketplace stats.
 */
import { NextResponse } from 'next/server'

// Mock data - in production, this would fetch from the MCP server
const mockStats = {
  activeAgents: 24,
  listings: 156,
  volume24h: 125000,
  traders: 89,
  lastUpdated: new Date().toISOString()
}

export async function GET() {
  try {
    // Try to fetch from MCP server
    // In production, this would call the actual MCP server
    const response = await fetch(`${process.env.MCP_SERVER_URL || 'http://localhost:8080'}/health`, {
      signal: AbortSignal.timeout(5000)
    })
    
    if (response.ok) {
      // If MCP is available, we could fetch real data here
      return NextResponse.json(mockStats)
    }
    
    return NextResponse.json(mockStats)
  } catch (error) {
    // Return mock data if MCP is not available
    return NextResponse.json(mockStats)
  }
}
