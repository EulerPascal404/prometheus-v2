import { FC, useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';

const HomePage: FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [activeFeature, setActiveFeature] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mouse move effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Head>
        <title>Prometheus: AI-Powered O-1 Visa Applications</title>
        <meta
          name="description"
          content="Prometheus uses advanced AI to help extraordinary individuals secure O-1 visas with unprecedented efficiency."
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{SharedStyles}</style>
      
      <BackgroundEffects />
      
      {/* Mouse follower effect */}
      <div 
        className="fixed w-64 h-64 rounded-full pointer-events-none z-10 opacity-20 mix-blend-screen"
        style={{
          background: 'radial-gradient(circle, rgba(96, 165, 250, 0.4) 0%, rgba(168, 85, 247, 0.2) 50%, transparent 70%)',
          left: '0',
          top: '0',
          transform: `translate(calc(${mousePosition.x}px - 50%), calc(${mousePosition.y}px - 50%))`,
          transition: 'transform 0.05s ease-out'
        }}
      />
      
      <div className="relative z-10 min-h-screen">
        {/* Navigation */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/80 backdrop-blur-md py-3' : 'bg-transparent py-5'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <Link href="/" className="flex items-center group">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-purple-400 transition-all duration-300 font-outfit">Prometheus</span>
              </Link>
              
              <div className="hidden md:flex space-x-8">
                <Link 
                  href="#features" 
                  className="text-slate-300 hover:text-white transition-colors font-outfit"
                >
                  Features
                </Link>
                <Link 
                  href="#process" 
                  className="text-slate-300 hover:text-white transition-colors font-outfit"
                >
                  Process
                </Link>
                <Link 
                  href="/document-collection" 
                  className="text-slate-300 hover:text-white transition-colors font-outfit"
                >
                  Apply
                </Link>
              </div>
              
              <div className="flex items-center space-x-4">
                <Link 
                  href="/document-collection" 
                  className="hidden md:block px-4 py-2 rounded-md bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 font-outfit"
                >
                  Sign In
                </Link>
                <Link 
                  href="/document-collection" 
                  className="px-4 py-2 rounded-md bg-white text-slate-900 font-medium hover:bg-slate-100 transition-all duration-300 transform hover:scale-105 font-outfit"
                >
                  Get Started
                </Link>
                
                {/* Mobile menu button */}
                <button className="md:hidden text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section - Enhanced with dynamic visuals */}
        <section id="hero" ref={heroRef} className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center justify-center">
          <div className="max-w-7xl mx-auto text-center">
            {/* Floating elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div 
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-blue-400/30 to-purple-500/30"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 5}s`,
                    opacity: 0.3 + Math.random() * 0.7
                  }}
                />
              ))}
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight mb-8 font-syne">
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent animate-gradient">Building successful</span> O-1 visa applications
              </h1>
            
            <div className="max-w-2xl mx-auto mb-12">
              <p className="text-xl text-slate-300 font-outfit">
                AI-powered assistance for extraordinary individuals
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                  <Link 
                    href="/document-collection" 
                className="px-8 py-4 rounded-md bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium text-center hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20 font-outfit relative overflow-hidden group"
              >
                <span className="relative z-10">Start Your Application</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-purple-500 rounded-md blur opacity-30 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </Link>
                </div>
                
            <div className="flex items-center justify-center space-x-4">
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-700/30">
                <p className="text-slate-300 font-outfit">
                  <span className="text-white font-semibold">Prototype</span> • Full Functionality Coming Soon
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - Enhanced with interactive elements */}
        <section id="features" ref={featuresRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-syne">
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Intelligent</span> Processing
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div 
                className={`bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30 hover:border-blue-500/30 transition-all duration-300 group transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 ${activeFeature === 0 ? 'border-blue-500/50 shadow-lg shadow-blue-500/20' : ''}`}
                onMouseEnter={() => setActiveFeature(0)}
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4 group-hover:from-blue-500/30 group-hover:to-purple-600/30 transition-all duration-300">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 font-outfit">AI Analysis</h3>
                <p className="text-slate-300 font-outfit">
                  Advanced algorithms identify your strongest qualification points.
                </p>
              </div>
              
              {/* Feature 2 */}
              <div 
                className={`bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30 hover:border-blue-500/30 transition-all duration-300 group transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 ${activeFeature === 1 ? 'border-blue-500/50 shadow-lg shadow-blue-500/20' : ''}`}
                onMouseEnter={() => setActiveFeature(1)}
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4 group-hover:from-blue-500/30 group-hover:to-purple-600/30 transition-all duration-300">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 font-outfit">Fast Processing</h3>
                <p className="text-slate-300 font-outfit">
                  Reduce preparation time by up to 70%.
                </p>
              </div>
              
              {/* Feature 3 */}
              <div 
                className={`bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30 hover:border-blue-500/30 transition-all duration-300 group transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 ${activeFeature === 2 ? 'border-blue-500/50 shadow-lg shadow-blue-500/20' : ''}`}
                onMouseEnter={() => setActiveFeature(2)}
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4 group-hover:from-blue-500/30 group-hover:to-purple-600/30 transition-all duration-300">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 font-outfit">94% Success</h3>
                <p className="text-slate-300 font-outfit">
                  Significantly higher than industry average.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Process Section - Enhanced with dynamic visuals */}
        <section id="process" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-syne">
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Simple</span> Process
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative group">
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold z-10 group-hover:scale-110 transition-transform duration-300">
                  1
                </div>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30 h-full group-hover:border-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                  <h3 className="text-xl font-semibold text-white mb-4 font-outfit">Upload</h3>
                  <p className="text-slate-300 mb-6 font-outfit">
                    Upload your credentials and evidence.
                  </p>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-slate-300 font-outfit">Analysis</div>
                      <div className="text-xs text-slate-400 font-outfit">Processing...</div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: '75%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="relative group">
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold z-10 group-hover:scale-110 transition-transform duration-300">
                  2
                </div>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30 h-full group-hover:border-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                  <h3 className="text-xl font-semibold text-white mb-4 font-outfit">Analyze</h3>
                  <p className="text-slate-300 mb-6 font-outfit">
                    AI identifies your strongest qualifications.
                  </p>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-slate-300 font-outfit">Strength</div>
                      <div className="text-xs text-green-400 font-outfit">Strong</div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: '92%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="relative group">
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold z-10 group-hover:scale-110 transition-transform duration-300">
                  3
                </div>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30 h-full group-hover:border-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                  <h3 className="text-xl font-semibold text-white mb-4 font-outfit">Submit</h3>
                  <p className="text-slate-300 mb-6 font-outfit">
                    Expert review and USCIS submission.
                  </p>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-slate-300 font-outfit">Status</div>
                      <div className="text-xs text-blue-400 font-outfit">Ready</div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: '100%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-12 text-center">
              <Link 
                href="/document-collection" 
                className="inline-block px-8 py-4 rounded-md bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20 font-outfit"
              >
                Start Now
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section - Enhanced with dynamic visuals */}
        <section id="cta" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
          <div className="max-w-7xl mx-auto">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-slate-700/30 group hover:border-blue-500/30 transition-all duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold mb-4 font-syne">
                    Ready to <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Succeed</span>?
              </h2>
                  <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <Link 
                      href="/document-collection" 
                      className="px-8 py-4 rounded-md bg-white text-slate-900 font-medium text-center hover:bg-slate-100 transition-all duration-300 transform hover:scale-105 hover:shadow-lg font-outfit"
                    >
                      Start Now
                </Link>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-xl blur-3xl group-hover:from-blue-500/30 group-hover:to-purple-600/30 transition-all duration-500"></div>
                  <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 group-hover:border-blue-500/30 transition-all duration-300">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-white font-outfit">Success</div>
                        <div className="text-xs text-green-400 font-outfit">94%</div>
                      </div>
                      
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: '94%' }}
                        ></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 rounded-lg p-3 transform hover:scale-105 transition-transform duration-300">
                          <div className="text-xs text-slate-400 mb-1 font-outfit">Time</div>
                          <div className="text-lg font-semibold text-white font-outfit">2-3 Weeks</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 transform hover:scale-105 transition-transform duration-300">
                          <div className="text-xs text-slate-400 mb-1 font-outfit">Satisfaction</div>
                          <div className="text-lg font-semibold text-white font-outfit">98%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800/50">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4 font-syne">Prometheus</h3>
                <p className="text-slate-400 font-outfit">
                  Unlocking global mobility for exceptional talent.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-4 font-outfit">SERVICES</h4>
                <ul className="space-y-2">
                  <li><Link href="/document-collection" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">O-1A</Link></li>
                  <li><Link href="/document-collection" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">O-1B</Link></li>
                  <li><Link href="/lawyer-search" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">Experts</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-4 font-outfit">RESOURCES</h4>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">Eligibility</Link></li>
                  <li><Link href="#" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">Stories</Link></li>
                  <li><Link href="#" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">FAQ</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-4 font-outfit">LEGAL</h4>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">Privacy</Link></li>
                  <li><Link href="#" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">Terms</Link></li>
                  <li><Link href="#" className="text-slate-400 hover:text-blue-400 transition-colors font-outfit">Disclaimer</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center">
              <p className="text-slate-500 text-sm font-outfit">© 2025 Prometheus. All rights reserved.</p>
              <div className="flex space-x-4 mt-4 md:mt-0">
                <Link href="#" className="text-slate-500 hover:text-blue-400 transition-colors transform hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </Link>
                <Link href="#" className="text-slate-500 hover:text-blue-400 transition-colors transform hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </Link>
                <Link href="#" className="text-slate-500 hover:text-blue-400 transition-colors transform hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 8s ease infinite;
        }
        
        @keyframes float {
          0% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-5px) translateX(2px); }
          50% { transform: translateY(0) translateX(4px); }
          75% { transform: translateY(5px) translateX(2px); }
          100% { transform: translateY(0) translateX(0); }
        }
        
        .font-outfit {
          font-family: 'Outfit', sans-serif;
        }
        
        .font-syne {
          font-family: 'Syne', sans-serif;
        }
      `}</style>
    </>
  );
};

export default HomePage;
