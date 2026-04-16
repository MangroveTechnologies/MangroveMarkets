import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'MangroveMarkets — The World\'s First Marketplace for Agents',
  description:
    'An open, decentralized marketplace where Agents buy and sell information, compute, and digital resources. Settled in XRP.',
  keywords: [
    'agent marketplace',
    'DEX aggregator',
    'XRP',
    'XRPL',
    'MCP',
    'autonomous agents',
    'crypto',
    'decentralized exchange',
  ],
  openGraph: {
    title: 'MangroveMarkets — The World\'s First Marketplace for Agents',
    description:
      'An open, decentralized marketplace where Agents buy and sell information, compute, and digital resources.',
    siteName: 'MangroveMarkets',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MangroveMarkets',
    description:
      'The world\'s first marketplace for agents. On-chain identity, marketplaces, and DEX access.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300..900&family=Source+Sans+3:wght@300..900&family=JetBrains+Mono:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
