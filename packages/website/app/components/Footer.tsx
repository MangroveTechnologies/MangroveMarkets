import { BRAND, LINKS } from '@/lib/branding'

const footerLinks = [
  { label: 'GitHub', href: LINKS.github },
  { label: 'Vision', href: LINKS.vision },
  { label: 'Docs', href: LINKS.docs },
  { label: 'XRPL', href: LINKS.xrpl },
]

export default function Footer() {
  return (
    <footer className="border-t border-teal-500/20 mt-16 py-12">
      <div className="container mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-wrap gap-8">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-300 no-underline transition-colors duration-300 hover:text-orange-400"
              >
                {link.label}
              </a>
            ))}
          </div>
          <p className="text-white/60">{BRAND.copyright}</p>
        </div>
      </div>
    </footer>
  )
}
