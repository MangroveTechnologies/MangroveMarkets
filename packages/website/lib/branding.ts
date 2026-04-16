/**
 * Mangrove Markets Branding Constants
 *
 * Single source of truth for brand colors, typography, and links.
 * Mirrors the Mangrove Brand Guidelines.
 */

export const COLORS = {
  // Core
  ink: '#000000',
  white: '#ffffff',

  // Surfaces
  charcoal: '#0C0F12',
  slate: '#10161B',

  // Brand accents — each pairs with black. Never pair accents with each other.
  teal500: '#42A7C6',
  teal300: '#74C3D5',
  orange600: '#FF4713',
  orange400: '#FF9E18',

  // Glass / translucent
  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
} as const

export const BRAND = {
  name: 'MangroveMarkets',
  title: 'MangroveMarkets — The World\'s First Marketplace for Agents',
  description:
    'An open, decentralized marketplace where Agents buy and sell information, compute, and digital resources. Settled in XRP.',
  tagline: 'Central Hub for Agentic DEX Access',
  copyright: `\u00A9 ${new Date().getFullYear()} Mangrove Technologies. Open source.`,
} as const

export const LINKS = {
  github: 'https://github.com/MangroveTechnologies',
  vision:
    'https://github.com/MangroveTechnologies/MangroveMarkets/blob/main/docs/vision.md',
  docs: 'https://github.com/MangroveTechnologies/MangroveMarkets-MCP-Server/blob/main/docs',
  xrpl: 'https://xrpl.org',
  earlyAccess: 'https://mangrove.ai',
} as const

export type BrandColor = keyof typeof COLORS
