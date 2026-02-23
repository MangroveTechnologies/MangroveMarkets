import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mangrove Markets',
  description: 'Agent marketplace and DEX for autonomous agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
