import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../config/supabase'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { SharedStyles, BackgroundEffects } from '../components/SharedStyles'

export default function AuthPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  // This needs to be the absolute URL of your app's homepage, not the Supabase callback
  const redirectUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/document-collection`
    : process.env.NODE_ENV === 'production' 
      ? 'https://demo-6ycjg6jqh-aditya-guptas-projects-1c7bb58d.vercel.app/document-collection'
      : 'http://localhost:3000/document-collection';

  useEffect(() => {
    // Check if user is already signed in when the page loads
    const checkSession = async () => {
      try {
        setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
        
      if (session) {
          console.log("Active session found, redirecting to document collection");
        router.push('/document-collection');
        }
      } catch (error) {
        console.error("Error checking session:", error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, !!session);
      
      if (event === 'SIGNED_IN' && session) {
        console.log("User signed in, redirecting to document collection");
        router.push('/document-collection');
      } else if (event === 'SIGNED_OUT') {
        console.log("User signed out");
      }
    });

    return () => subscription?.unsubscribe();
  }, [router]);
  
  // Custom social sign-in handler
  const handleSocialSignIn = async (provider) => {
    try {
      setIsLoading(true);
      const { error, data } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: typeof window !== 'undefined' 
            ? `${window.location.origin}/document-collection`
            : process.env.NODE_ENV === 'production' 
              ? 'https://demo-6ycjg6jqh-aditya-guptas-projects-1c7bb58d.vercel.app/document-collection'
              : 'http://localhost:3000/document-collection',
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      
      if (error) throw error;
      console.log("OAuth sign-in initiated", data);
      
    } catch (error) {
      console.error('Error with social sign in:', error.message);
      setIsLoading(false);
    }
  };

  // Manually handle Google sign-in
  const handleGoogleSignIn = async () => {
    await handleSocialSignIn('google');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/80 backdrop-blur-sm">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <style>{SharedStyles}</style>
        <title>Authentication - Prometheus</title>
      </Head>

      <BackgroundEffects />
      
      <main className="min-h-screen bg-transparent">
        <div className="relative z-10 min-h-screen p-6 md:p-8 flex flex-col items-center justify-center">
          {/* Main authentication section */}
          <section className="card max-w-md w-full p-0 overflow-hidden">
            <div className="w-full p-6 md:p-8">
              <header className="mb-8 text-center">
                <h1 style={{
                  fontSize: '2.5rem',
                  lineHeight: '1.2',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: '1rem',
                  backgroundImage: 'linear-gradient(135deg, #60A5FA 0%, #A855F7 50%, #C084FC 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  textShadow: '0 0 25px rgba(168, 85, 247, 0.2)'
                }}>PROMETHEUS</h1>
                <p style={{
                  color: '#CBD5E1',
                  textAlign: 'center',
                  marginBottom: '1rem',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.9rem'
                }}>Streamlining your immigration journey with AI</p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  gap: '0.75rem'
                }}>
                  <span style={{
                    height: '1px',
                    flex: '1',
                    background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.3), transparent)'
                  }}></span>
                  <span style={{
                    color: '#94A3B8',
                    fontSize: '0.75rem',
                    fontFamily: "'IBM Plex Mono', monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    padding: '0 0.75rem'
                  }}>SECURE • INTELLIGENT • EFFICIENT</span>
                  <span style={{
                    height: '1px',
                    flex: '1', 
                    background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.3), transparent)'
                  }}></span>
                </div>
              </header>

              {/* Custom sign-in button for direct control */}
              <div className="space-y-6">
                <button 
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    color: '#C084FC',
                    fontWeight: '600',
                    fontFamily: "'IBM Plex Mono', 'Space Mono', 'Roboto Mono', monospace",
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    margin: '0 auto'
                  }}
                  onClick={handleGoogleSignIn}
                >
                  <span style={{ width: '20px', height: '20px', marginRight: '8px', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="100%" height="100%">
                      <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"/>
                      <path fill="#FBBC05" d="M12,18.1818182 C8.86364588,18.1818182 6.21272888,16.2272728 5.27252784,13.4181818 L1.23999023,16.5436508 C3.19829785,20.4952595 7.26766499,23.1818182 12,23.1818182 C14.9545455,23.1818182 17.7272727,22.0909091 19.8181818,20.1818182 L15.7272727,17.2727273 C14.5,17.8181818 13.2727273,18.1818182 12,18.1818182 Z"/>
                      <path fill="#34A853" d="M19.8181818,20.1818182 C22.0909091,18.2727273 23.1818182,15.5454545 23.1818182,12 C23.1818182,11.1818182 23.0909091,10.3636364 22.9090909,9.63636364 L12,9.63636364 L12,14.1818182 L18.4363636,14.1818182 C18.1454545,15.5454545 17.2727273,16.7272727 15.7272727,17.2727273 L19.8181818,20.1818182 Z"/>
                      <path fill="#4285F4" d="M12,14.1818182 L12,9.63636364 L12,9.63636364 L12,9.63636364 L12,14.1818182 L12,14.1818182 Z"/>
                    </svg>
                  </span>
                  <span style={{ textAlign: 'center' }}>Continue with Google</span>
                </button>
                
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '1.5rem 0',
                  width: '100%',
                  textAlign: 'center'
                }}>
                  <div style={{ flexGrow: 1, height: '1px', borderTop: '1px solid rgba(71, 85, 105, 0.5)' }}></div>
                  <span style={{
                    margin: '0 0.75rem',
                    fontSize: '0.75rem',
                    color: '#94A3B8',
                    fontFamily: "'IBM Plex Mono', monospace",
                    textTransform: 'uppercase',
                    display: 'block',
                    textAlign: 'center'
                  }}>OR</span>
                  <div style={{ flexGrow: 1, height: '1px', borderTop: '1px solid rgba(71, 85, 105, 0.5)' }}></div>
                </div>

                {/* Auth component for email/password */}
            <React.Suspense fallback={
                  <div className="flex justify-center py-8">
                <div className="spinner"></div>
              </div>
            }>
              <Auth
                supabaseClient={supabase}
                appearance={{ 
                  theme: ThemeSupa,
                  style: {
                        container: { 
                          backgroundColor: 'transparent', 
                          width: '100%' 
                        },
                    label: { 
                      color: '#e2e8f0',
                      fontFamily: "'Space Grotesk', 'IBM Plex Sans', system-ui, sans-serif",
                      letterSpacing: '0.05em',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                          fontSize: '0.75rem',
                          marginBottom: '0.5rem'
                    },
                    button: {
                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid rgba(168, 85, 247, 0.25)',
                      color: '#C084FC',
                      fontWeight: '600',
                      fontFamily: "'IBM Plex Mono', 'Space Mono', 'Roboto Mono', monospace",
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          marginTop: '0.5rem',
                      '&:hover': {
                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        borderColor: 'rgba(168, 85, 247, 0.4)',
                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.15)'
                      }
                    },
                    input: {
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      color: '#e2e8f0',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '0.5rem',
                      fontFamily: "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace",
                      letterSpacing: '0',
                          padding: '0.75rem 1rem',
                          marginBottom: '1rem',
                      '&:focus': {
                        borderColor: 'rgba(168, 85, 247, 0.5)',
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(168, 85, 247, 0.15)'
                      }
                    },
                    message: { 
                      color: '#FDA4AF',
                      backgroundColor: 'rgba(244, 63, 94, 0.1)',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      fontFamily: "'IBM Plex Mono', 'Space Mono', monospace",
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      '&::before': {
                        content: '"⚠"',
                        marginRight: '0.5rem'
                      }
                    },
                    anchor: { 
                      color: '#C084FC',
                      fontFamily: "'IBM Plex Sans', 'SF Pro Text', system-ui, sans-serif",
                      letterSpacing: '0.01em',
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                      '&:hover': {
                        color: '#A855F7',
                            textDecoration: 'underline'
                      }
                    },
                    divider: { backgroundColor: 'rgba(71, 85, 105, 0.4)' }
                  },
                  variables: {
                    default: {
                      colors: {
                        brand: '#A855F7',
                        brandAccent: '#C084FC',
                        inputBackground: 'rgba(15, 23, 42, 0.8)',
                        inputText: '#E2E8F0',
                        inputBorder: 'rgba(71, 85, 105, 0.5)',
                        inputBorderHover: 'rgba(168, 85, 247, 0.5)',
                        buttonPrimary: 'rgba(168, 85, 247, 0.1)',
                        buttonSecondary: 'rgba(71, 85, 105, 0.2)',
                        messageText: '#FDA4AF',
                        messageBackground: 'rgba(244, 63, 94, 0.1)',
                        messageBorder: 'rgba(244, 63, 94, 0.2)',
                        dividerBackground: 'rgba(71, 85, 105, 0.4)',
                      }
                    }
                  }
                }}
                    providers={[]}
                redirectTo={redirectUrl}
                onlyThirdPartyProviders={false}
                view={'sign_in'}
                showLinks={true}
                localization={{
                  variables: {
                    sign_in: {
                      email_label: 'Email address',
                      password_label: 'Password',
                      email_input_placeholder: 'Your email address',
                      password_input_placeholder: 'Your password',
                      button_label: 'Sign In',
                      loading_button_label: 'Signing In...',
                      social_provider_text: 'Continue with {{provider}}',
                          link_text: 'Don\'t have an account? Sign up',
                    },
                    sign_up: {
                      email_label: 'Email address',
                      password_label: 'Create password',
                      email_input_placeholder: 'Your email address',
                      password_input_placeholder: 'Create a secure password',
                      button_label: 'Create Account',
                      loading_button_label: 'Creating Account...',
                      social_provider_text: 'Continue with {{provider}}',
                          link_text: 'Already have an account? Sign in',
                    }
                  }
                }}
              />
            </React.Suspense>
              </div>
            </div>
          </section>
        </div>
      </main>

      <style jsx>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(168, 85, 247, 0.1);
          border-radius: 50%;
          border-top-color: #A855F7;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}