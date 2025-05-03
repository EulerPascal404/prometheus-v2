import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../config/supabase';
import { SharedStyles } from '../../components/SharedStyles';
import { BackgroundEffects } from '../../components/BackgroundEffects';
import Image from 'next/image';

interface Application {
  id: string;
  name: string;
  score: number;
  user_id: string;
  status: string;
  last_updated: string;
}

interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}

interface UserPersonalInfo {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address: string;
  extra_info: string;
}

export default function ShareCertificate() {
  const router = useRouter();
  const { id } = router.query;
  const [application, setApplication] = useState<Application | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userPersonalInfo, setUserPersonalInfo] = useState<UserPersonalInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplicationData = async () => {
      if (!id) return;

      try {
        // Fetch application data directly from Supabase
        const { data: appData, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('id', id)
          .single();

        if (appError) throw appError;
        if (!appData) {
          throw new Error('Application not found');
        }

        setApplication(appData);

        // Fetch user personal info - this is the primary source of user's name
        const { data: personalInfo, error: personalInfoError } = await supabase
          .from('user_personal_info')
          .select('*')
          .eq('user_id', appData.user_id)
          .single();

        if (!personalInfoError && personalInfo) {
          setUserPersonalInfo(personalInfo);
        }

        // Also try to get user data from auth as fallback
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            setUser(authUser);
          }
        } catch (authError) {
          console.error('Error getting user data:', authError);
        }
      } catch (err) {
        console.error('Error fetching certificate data:', err);
        setError('Failed to load certificate');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplicationData();
  }, [id]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get user name or email for display
  const getUserDisplayName = () => {
    // First priority: user's full name from user_personal_info table
    if (userPersonalInfo?.full_name) {
      return userPersonalInfo.full_name;
    }
    
    // Second priority: user's name from the application itself (if available)
    if (application?.personal_name) {
      return application.personal_name;
    }
    
    // Third priority: user metadata from auth
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    
    // Fourth priority: email with formatting
    if (user?.email) {
      // Extract name from email (e.g., john.doe@example.com -> John Doe)
      const emailName = user.email.split('@')[0].replace(/[._-]/g, ' ');
      // Capitalize each word
      return emailName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    return 'Applicant'; // Last resort fallback
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Certificate Not Found</h1>
          <p className="text-slate-400">The certificate you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <title>{application.name} - Certificate | Prometheus AI</title>
        <meta name="description" content={`Certificate for ${application.name}`} />
        <style>{SharedStyles}</style>
      </Head>

      <BackgroundEffects />

      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="absolute top-6 left-6">
          <button
            onClick={() => router.push('/application-portfolio')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/70 hover:bg-slate-700/70 text-white rounded-lg transition-colors duration-200 backdrop-blur-sm border border-slate-700/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Portfolio
          </button>
        </div>
        
        <div className="max-w-3xl w-full bg-slate-800/70 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50 relative overflow-hidden">
          {/* Certificate header with logo */}
          <div className="text-center mb-8 relative z-10">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Certificate of Achievement</h1>
            <p className="text-slate-300">Issued by Prometheus AI</p>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500/50 to-purple-500/50"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-bl-full"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-tr-full"></div>

          {/* Certificate body */}
          <div className="relative z-10">
            <div className="text-center mb-8">
              <p className="text-lg text-slate-300 mb-2">This certificate is presented to</p>
              <h2 className="text-3xl font-bold text-primary-400 mb-1">{getUserDisplayName()}</h2>
              <p className="text-md text-slate-400">for the successful completion of</p>
            </div>

            <div className="text-center mb-8">
              <h3 className="text-2xl font-semibold text-white mb-6">{application.name}</h3>
              
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-slate-700/50 border-4 border-primary-500/30 flex items-center justify-center">
                    <span className="text-5xl font-bold text-primary-400">{application.score}</span>
                  </div>
                  <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-slate-700/70 px-4 py-1 rounded-full border border-slate-600/50">
                    <span className="text-sm font-medium text-primary-300">Score</span>
                  </div>
                </div>
              </div>
              
              <p className="text-slate-300 mt-4">
                Status: <span className="text-primary-400 font-medium">{application.status.replace('_', ' ').toUpperCase()}</span>
              </p>
            </div>

            {/* Certificate footer */}
            <div className="mt-12 border-t border-slate-700/50 pt-6 flex flex-col md:flex-row justify-between items-center">
              <div className="text-slate-400 text-sm mb-4 md:mb-0">
                <p>Certificate ID: {application.id.slice(0, 8)}</p>
                <p>Issued on: {formatDate(application.last_updated)}</p>
              </div>
              
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    // Copy certificate URL to clipboard
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                    // Add visual feedback (could be enhanced with a toast)
                    alert("Certificate link copied to clipboard!");
                  }}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors duration-200 text-white flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Share
                </button>
                
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors duration-200 text-white flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 