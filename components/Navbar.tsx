import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check for authenticated user
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Render navigation links based on current page
  const renderNavigationLinks = () => {
    switch (router.pathname) {
      case '/lawyer-search':
        return (
          <div className="hidden md:flex space-x-8">
            <Link 
              href="/" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Home
            </Link>
            <Link 
              href="/document-collection" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Upload
            </Link>
            <Link 
              href="/document-review" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Review
            </Link>
            <Link 
              href="/application-portfolio" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Portfolio
            </Link>
          </div>
        );
      case '/document-collection':
        return (
          <div className="hidden md:flex space-x-8">
            <Link 
              href="/" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Home
            </Link>
            <Link 
              href="/document-review" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Review
            </Link>
            <Link 
              href="/application-portfolio" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Portfolio
            </Link>
          </div>
        );
      case '/document-review':
        return (
          <div className="hidden md:flex space-x-8">
            <Link 
              href="/" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Home
            </Link>
            <Link 
              href="/document-collection" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Upload
            </Link>
            <Link 
              href="/application-portfolio" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Portfolio
            </Link>
          </div>
        );
      case '/application-portfolio':
        return (
          <div className="hidden md:flex space-x-8">
            <Link 
              href="/" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Home
            </Link>
            <Link 
              href="/document-collection" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Upload
            </Link>
          </div>
        );
      default:
        return (
          <div className="hidden md:flex space-x-8">
            <Link 
              href="/document-collection" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Upload
            </Link>
            <Link 
              href="/document-review" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Review
            </Link>
            <Link 
              href="/application-portfolio" 
              className="text-slate-300 hover:text-white transition-colors font-outfit"
            >
              Portfolio
            </Link>
          </div>
        );
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/80 backdrop-blur-md py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-purple-400 transition-all duration-300 font-outfit">Prometheus</span>
          </Link>
          
          {renderNavigationLinks()}
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white">
                    {user.email?.[0].toUpperCase()}
                  </div>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-md shadow-lg py-1 border border-slate-700">
                    <Link
                      href="/application-portfolio"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    >
                      My Applications
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link 
                  href="/auth"
                  className="hidden md:block px-4 py-2 rounded-md bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 font-outfit"
                >
                  Sign In
                </Link>
                <Link 
                  href="/auth" 
                  className="px-4 py-2 rounded-md bg-white text-slate-900 font-medium hover:bg-slate-100 transition-all duration-300 transform hover:scale-105 font-outfit"
                >
                  Get Started
                </Link>
              </>
            )}
            
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
  );
} 