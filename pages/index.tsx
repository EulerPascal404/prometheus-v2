import { FC } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';

const HomePage: FC = () => {
  return (
    <>
      <Head>
        <title>Prometheus: O-1 Visa Applications for Top Talent</title>
        <meta
          name="description"
          content="Prometheus helps extraordinary individuals with their O-1 visa applications."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <style jsx global>{SharedStyles}</style>
      
      <BackgroundEffects />
      
      <div className="relative z-10 min-h-screen">
        {/* Navigation */}
        <nav className="nav-container">
          <div className="nav-content">
            <div className="flex-shrink-0">
              <Link href="/" className="nav-brand">
                <span>Prometheus</span>
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="nav-links">
                <Link href="/" className="nav-link active">
                  Home
                </Link>
                <Link href="/document-collection" className="nav-link">
                  Apply
                </Link>
                <Link href="/lawyer-search" className="nav-link">
                  Find Expert
                </Link>
                <Link href="/dashboard" className="nav-link">
                  Dashboard
                </Link>
              </div>
            </div>
            <div>
              <Link href="/auth" className="nav-button">
                Sign In
              </Link>
            </div>
          </div>
        </nav>

        {/* Mobile Menu Button - Only visible on small screens */}
        <div className="fixed top-4 right-4 z-50 md:hidden">
          <button className="flex items-center justify-center w-10 h-10 bg-slate-800/80 rounded-md border border-slate-700/50 backdrop-blur-sm">
            <span className="sr-only">Open menu</span>
            <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Hero Section */}
        <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="hero-gradient">
              <h1 className="prometheus-title gradient-text">
                Empowering the World's Extraordinary Talent
              </h1>
              <div className="subtitle-box">
                <p className="section-subtitle">
                  Prometheus helps exceptional individuals across science, arts, education, business, and athletics
                  secure O-1 visas with our AI-powered platform. We're on a mission to bring the world's top talent 
                  to the United States.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                <Link href="/document-collection" className="gradient-button text-lg px-6 py-3">
                  Start Your O-1 Application
                </Link>
                <Link href="/lawyer-search" className="gradient-button text-lg px-6 py-3 bg-opacity-20">
                  Connect with Visa Experts
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="section-title gradient-text">
                Why Choose Prometheus
              </h2>
              <div className="subtitle-box">
                <p className="section-subtitle">
                  We're dedicated to helping the world's most talented individuals bring their exceptional abilities to the United States through the O-1 visa pathway.
                </p>
              </div>
            </div>
            
            <div className="features-grid">
              {/* Feature 1 */}
              <div className="feature-card">
                <div className="icon-container">
                  <span className="text-accent-400 text-3xl">🌟</span>
                </div>
                <h3 className="text-center text-lg font-semibold mb-2 text-slate-200">Talent Recognition</h3>
                <p className="text-center text-sm text-slate-300">
                  Our AI technology recognizes and validates your extraordinary achievements to strengthen your O-1 petition.
                </p>
              </div>
              
              {/* Feature 2 */}
              <div className="feature-card">
                <div className="icon-container">
                  <span className="text-primary-400 text-3xl">⏱️</span>
                </div>
                <h3 className="text-center text-lg font-semibold mb-2 text-slate-200">Accelerated Process</h3>
                <p className="text-center text-sm text-slate-300">
                  Streamlined application preparation with faster processing times than other visa categories.
                </p>
              </div>
              
              {/* Feature 3 */}
              <div className="feature-card">
                <div className="icon-container">
                  <span className="text-emerald-400 text-3xl">🌐</span>
                </div>
                <h3 className="text-center text-lg font-semibold mb-2 text-slate-200">Global Talent Mobility</h3>
                <p className="text-center text-sm text-slate-300">
                  Work in the United States while maintaining your global connections and continuing your exceptional career.
                </p>
              </div>
              
              {/* Feature 4 */}
              <div className="feature-card">
                <div className="icon-container">
                  <span className="text-rose-400 text-3xl">👨‍👩‍👧‍👦</span>
                </div>
                <h3 className="text-center text-lg font-semibold mb-2 text-slate-200">Family Inclusion</h3>
                <p className="text-center text-sm text-slate-300">
                  Bring your spouse and children under 21 with O-3 dependent visas to share your journey.
                </p>
              </div>
              
              {/* Feature 5 */}
              <div className="feature-card">
                <div className="icon-container">
                  <span className="text-blue-400 text-3xl">⚖️</span>
                </div>
                <h3 className="text-center text-lg font-semibold mb-2 text-slate-200">Expert Legal Support</h3>
                <p className="text-center text-sm text-slate-300">
                  Connect with immigration attorneys specialized in representing top talent for O-1 visas.
                </p>
              </div>
              
              {/* Feature 6 */}
              <div className="feature-card">
                <div className="icon-container">
                  <span className="text-accent-300 text-3xl">🔄</span>
                </div>
                <h3 className="text-center text-lg font-semibold mb-2 text-slate-200">Ongoing Support</h3>
                <p className="text-center text-sm text-slate-300">
                  Continuous assistance with renewals and potential pathways to permanent residency for exceptional talent.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="section-title gradient-text">
                Our Talent Mobility Process
              </h2>
              <div className="subtitle-box">
                <p className="section-subtitle">
                  Prometheus streamlines the complex O-1 visa process into three simple steps for extraordinary individuals.
                </p>
              </div>
            </div>
            
            <div className="steps-grid">
              {/* Step 1 */}
              <div className="step-card">
                <div className="step-number">01</div>
                <h3 className="text-lg font-semibold mb-2 text-slate-200">Document Your Excellence</h3>
                <p className="text-sm text-slate-300">
                  Upload your resume, publications, awards, and supporting evidence that demonstrates your extraordinary abilities and accomplishments.
                </p>
              </div>
              
              {/* Step 2 */}
              <div className="step-card">
                <div className="step-number">02</div>
                <h3 className="text-lg font-semibold mb-2 text-slate-200">AI-Powered Assessment</h3>
                <p className="text-sm text-slate-300">
                  Our proprietary technology analyzes your credentials, identifies your strongest qualification criteria, and generates a personalized strategy.
                </p>
              </div>
              
              {/* Step 3 */}
              <div className="step-card">
                <div className="step-number">03</div>
                <h3 className="text-lg font-semibold mb-2 text-slate-200">Expert-Guided Filing</h3>
                <p className="text-sm text-slate-300">
                  Partner with specialized immigration attorneys who will refine and submit your petition to USCIS with the highest chance of approval.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="backdrop-blur-sm rounded-2xl p-6 md:p-8 text-center border border-slate-700/50">
              <h2 className="section-title gradient-text">
                Ready to Bring Your Extraordinary Talent to the U.S.?
              </h2>
              <div className="subtitle-box">
                <p className="section-subtitle">
                  Join thousands of exceptional individuals who've secured O-1 visas with Prometheus. Your talent deserves global recognition.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link href="/document-collection" className="gradient-button text-lg px-6 py-3">
                  Start Your Journey
                </Link>
                <Link href="/auth" className="gradient-button text-lg px-6 py-3 bg-opacity-20">
                  Free Talent Assessment
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold gradient-text mb-4 text-center md:text-left">Prometheus</h3>
                <p className="text-slate-400 text-center md:text-left">
                  Unlocking global mobility for the world's most exceptional talent through O-1 visa pathways.
                </p>
              </div>
              <div className="text-center md:text-left">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 text-center md:text-left">TALENT SERVICES</h4>
                <ul className="space-y-2">
                  <li className="text-center md:text-left"><Link href="/document-collection" className="text-slate-400 hover:text-accent-300 transition-colors">O-1A (Sciences & Business)</Link></li>
                  <li className="text-center md:text-left"><Link href="/document-collection" className="text-slate-400 hover:text-accent-300 transition-colors">O-1B (Arts & Entertainment)</Link></li>
                  <li className="text-center md:text-left"><Link href="/lawyer-search" className="text-slate-400 hover:text-accent-300 transition-colors">Immigration Experts</Link></li>
                </ul>
              </div>
              <div className="text-center md:text-left">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 text-center md:text-left">RESOURCES</h4>
                <ul className="space-y-2">
                  <li className="text-center md:text-left"><Link href="#" className="text-slate-400 hover:text-accent-300 transition-colors">Talent Eligibility</Link></li>
                  <li className="text-center md:text-left"><Link href="#" className="text-slate-400 hover:text-accent-300 transition-colors">Success Stories</Link></li>
                  <li className="text-center md:text-left"><Link href="#" className="text-slate-400 hover:text-accent-300 transition-colors">FAQ</Link></li>
                </ul>
              </div>
              <div className="text-center md:text-left">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 text-center md:text-left">LEGAL</h4>
                <ul className="space-y-2">
                  <li className="text-center md:text-left"><Link href="#" className="text-slate-400 hover:text-accent-300 transition-colors">Privacy Policy</Link></li>
                  <li className="text-center md:text-left"><Link href="#" className="text-slate-400 hover:text-accent-300 transition-colors">Terms of Service</Link></li>
                  <li className="text-center md:text-left"><Link href="#" className="text-slate-400 hover:text-accent-300 transition-colors">Legal Disclaimer</Link></li>
                </ul>
              </div>
            </div>
            <div className="footer-bottom text-center md:text-left mt-8 pt-8 border-t border-slate-800">
              <p className="text-slate-500 text-sm text-center md:text-left">© 2023 Prometheus. All rights reserved. Helping the world's top talent navigate U.S. immigration pathways.</p>
              <div className="links flex justify-center md:justify-start mt-4 md:mt-0">
                <Link href="#" className="text-slate-500 text-sm hover:text-accent-300 transition-colors mx-2">Privacy</Link>
                <Link href="#" className="text-slate-500 text-sm hover:text-accent-300 transition-colors mx-2">Terms</Link>
                <Link href="#" className="text-slate-500 text-sm hover:text-accent-300 transition-colors mx-2">Cookies</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
