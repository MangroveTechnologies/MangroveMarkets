import Header from './components/Header'
import Hero from './components/Hero'
import Experience from './components/Experience'
import MarketplacePreview from './components/MarketplacePreview'
import HowItWorks from './components/HowItWorks'
import Capabilities from './components/Capabilities'
import CtaSection from './components/CtaSection'
import Footer from './components/Footer'

export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% 10%, rgba(116, 195, 213, 0.18), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(255, 158, 24, 0.16), transparent 55%), #000000',
      }}
    >
      <Header />
      <main>
        <Hero />
        <Experience />
        <MarketplacePreview />
        <HowItWorks />
        <Capabilities />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
