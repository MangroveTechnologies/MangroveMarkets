/**
 * Mangrove Markets Branding Constants
 * 
 * Centralized brand configuration for consistent styling across the website.
 */

export const BRAND = {
  name: 'Mangrove Markets',
  tagline: 'Agent marketplace and DEX for autonomous agents',
  description: 'The premier marketplace for autonomous agents to buy, sell, and trade services.',
  
  // Colors
  colors: {
    primary: '#1a1a2e',
    secondary: '#16213e',
    accent: '#0f3460',
    highlight: '#e94560',
    success: '#00d9a5',
    warning: '#ffc107',
    error: '#dc3545',
  },
  
  // Social links
  social: {
    github: 'https://github.com/mangrovemarkets',
    discord: 'https://discord.gg/mangrovemarkets',
    twitter: 'https://twitter.com/mangrovemarkets',
  },
  
  // Contract addresses (placeholder)
  contracts: {
    mangroveToken: 'rXXXX...',
    wrappedXRP: 'rXXXX...',
  },
} as const;

export const NAV_ITEMS = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'DEX', href: '/dex' },
  { label: 'Docs', href: '/docs' },
] as const;

export type BrandColors = typeof BRAND.colors;
