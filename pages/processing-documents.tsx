import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';
import Link from 'next/link';

export default function ProcessingDocuments() {
  const router = useRouter();
  const { documents, applicationId } = router.query;
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("Initializing...");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const hasCalledApi = useRef(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const userId = useRef<string | null>(null);

  const processingMessages = [
    "Evaluating your extraordinary ability evidence against USCIS O-1 visa criteria...",
    "Our analysis is not legal advice but provides guidance on strengthening your O-1 petition.",
    "Identifying your strongest qualification criteria for the O-1 visa application...",
    "Building your talent pathway to the United States through the O-1 visa program...",
  ];

  // Add message rotation effect
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % processingMessages.length);
    }, 5000); // Change message every 5 seconds

    return () => clearInterval(messageInterval);
  }, []);

  // Function to check processing status
  const checkStatus = async () =>{
    try {
      if (!userId.current) return;
      
      const { data, error } = await supabase
        .from('user_documents')
        .select('processing_status')
        .eq('user_id', userId.current)
        .single();
      
      if (error) throw error;
      
      if (data) {
        // Format the status for display
        let displayStatus = data.processing_status;
        let calculatedProgress = 0;
        
        console.log("Current status:", displayStatus);
        
        // Handle RAG page generation progress
        if (displayStatus && displayStatus.match(/generating_rag_page_\d+_of_\d+/)) {
          const matches = displayStatus.match(/generating_rag_page_(\d+)_of_(\d+)/);
          if (matches && matches.length === 3) {
            const currentPage = parseInt(matches[1], 10);
            const totalPages = parseInt(matches[2], 10);
            
            displayStatus = `Building O-1 Analysis (Step ${currentPage}/${totalPages})`;
            // Calculate progress as currentPage out of totalPages
            calculatedProgress = Math.floor((currentPage / totalPages) * 100);
          }
        }
        // Handle PDF filling progress
        else if (displayStatus && displayStatus.match(/filling_pdf_page_\d+_of_\d+/)) {
          const matches = displayStatus.match(/filling_pdf_page_(\d+)_of_(\d+)/);
          if (matches && matches.length === 3) {
            const currentPage = parseInt(matches[1], 10);
            const totalPages = parseInt(matches[2], 10);
            
            displayStatus = `Preparing O-1 Petition (Page ${currentPage}/${totalPages})`;
            // Calculate progress as currentPage out of totalPages
            calculatedProgress = Math.floor((currentPage / totalPages) * 100);
          }
        }
        // Handle completed PDF fill
        else if (displayStatus && displayStatus.match(/completed_pdf_fill_\d+_pages/)) {
          const matches = displayStatus.match(/completed_pdf_fill_(\d+)_pages/);
          if (matches && matches.length === 2) {
            displayStatus = `Finalizing your O-1 qualification analysis...`;
            calculatedProgress = 95; // Almost done
          }
        }
        // Handle RAG generation initial stage
        else if (displayStatus === 'generating_rag_responses') {
          displayStatus = 'Evaluating your qualifications for O-1 visa...';
          calculatedProgress = 10; // Starting the process
        }
        // Handle PDF preparation
        else if (displayStatus === 'preparing_pdf_fill') {
          displayStatus = 'Preparing O-1 petition documentation...';
          calculatedProgress = 30; // Preparing PDF
        }
        // Parse detailed page progress if available
        else if (displayStatus && displayStatus.match(/processing_\w+_page_\d+_of_\d+/)) {
          const matches = displayStatus.match(/processing_(\w+)_page_(\d+)_of_(\d+)/);
          if (matches && matches.length === 4) {
            const docType = matches[1];
            const currentPage = parseInt(matches[2], 10);
            const totalPages = parseInt(matches[3], 10);
            
            displayStatus = `Analyzing ${docType.charAt(0).toUpperCase() + docType.slice(1)} for O-1 Criteria (${currentPage}/${totalPages})`;
            // Calculate progress as currentPage out of totalPages
            calculatedProgress = Math.floor((currentPage / totalPages) * 100);
          }
        } 
        // Handle analysis phase after page processing
        else if (displayStatus && displayStatus.match(/processing_\w+_analysis/)) {
          const matches = displayStatus.match(/processing_(\w+)_analysis/);
          if (matches && matches.length === 2) {
            const docType = matches[1];
            displayStatus = `Evaluating ${docType.charAt(0).toUpperCase() + docType.slice(1)} Against O-1 Standards...`;
            calculatedProgress = 50; // Analysis phase
          }
        } 
        // Standard document processing
        else if (displayStatus && displayStatus.startsWith('processing_')) {
          const docType = displayStatus.replace('processing_', '');
          displayStatus = `Analyzing ${docType.charAt(0).toUpperCase() + docType.slice(1)} for Extraordinary Ability Evidence...`;
          calculatedProgress = 25; // Initial processing
        } 
        else if (displayStatus === 'completed') {
          displayStatus = 'Completing your O-1 qualification assessment...';
          calculatedProgress = 100;
        } 
        else if (displayStatus === 'pending') {
          displayStatus = 'Preparing to assess your O-1 visa eligibility...';
          calculatedProgress = 5;
        }
        
        console.log("Calculated progress:", calculatedProgress);
        
        // Direct update of progress and status
        setProgress(calculatedProgress);
        setCurrentStage(displayStatus);
        
        if (data.processing_status === 'completed' && pollInterval.current) {
          clearInterval(pollInterval.current);
          console.log("Process completed, clearing interval");
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  useEffect(() => {
    // Initialize polling for status updates
    const startStatusPolling = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user found');
          return;
        }
        
        userId.current = user.id;
        
        // Initial check
        await checkStatus();
        
        // Start polling with a maximum duration
        const maxPollingDuration = 5 * 60 * 1000; // 5 minutes
        const startTime = Date.now();
        
        pollInterval.current = setInterval(async () => {
          // Check if we've exceeded the maximum polling duration
          if (Date.now() - startTime > maxPollingDuration) {
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
            }
            console.error('Polling timeout reached');
            return;
          }
          
          try {
            await checkStatus();
          } catch (error) {
            console.error('Error during status check:', error);
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
            }
          }
        }, 2000);
      } catch (error) {
        console.error('Error starting status polling:', error);
      }
    };
    
    startStatusPolling();
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const processDocuments = async () => {
      if (hasCalledApi.current) {
        return;
      }

      try {
        hasCalledApi.current = true;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No authenticated user found');
        }
        
        userId.current = user.id;
        
        // Validate documents data
        if (!documents) {
          throw new Error('No documents data provided');
        }
        
        let documentsObject;
        try {
          documentsObject = JSON.parse(documents as string);
        } catch (e) {
          console.error('Error parsing documents data:', e);
          throw new Error('Invalid documents data format');
        }

        // Use the correct API URL based on environment
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8000/api/validate-documents'
          : '/api/validate-documents';  // This will be handled by Vercel's rewrite rules
        
        console.log("Making API request to server:", apiUrl);
        console.log("Current hostname:", typeof window !== 'undefined' ? window.location.hostname : 'server-side');
        console.log("Environment:", process.env.NODE_ENV);
        console.log("API URL from env:", process.env.NEXT_PUBLIC_API_URL);
        console.log("Documents data:", documentsObject);

        try {
          // Get the session token
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          
          if (!accessToken) {
            throw new Error('No authentication token available');
          }
          
          console.log('Making request with token:', accessToken.substring(0, 10) + '...');
          
          // Make the API call to the backend
          const requestBody: any = {
            user_id: user.id,
            uploaded_documents: documentsObject
          };

          // Include application ID if available
          if (applicationId) {
            requestBody.application_id = applicationId;
          }

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(requestBody)
          });
          
          console.log('Response status:', response.status);
          console.log('Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log("API response:", result);
          
          // Check if the response has the expected structure
          if (!result || typeof result !== 'object') {
            throw new Error('Invalid response format from server');
          }
          
          if (result.can_proceed) {
            // Store the document summaries and full API response in localStorage
            localStorage.setItem('documentSummaries', JSON.stringify(result.document_summaries));
            localStorage.setItem('apiResponseData', JSON.stringify(result));
            
            // Clear any existing intervals before navigation
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
            }
            
            // Include applicationId in the query if available
            const query = { 
              userId: user.id,
              processed: 'true',
              ...(applicationId ? { id: applicationId } : {})
            };
            
            // Use replace instead of push to prevent back button from returning to processing page
            router.replace({
              pathname: '/document-review',
              query
            });
          } else {
            hasCalledApi.current = false; // Reset the flag on error
            throw new Error(result.message || 'Please ensure you have uploaded all required documents.');
          }
        } catch (fetchError) {
          if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
            console.error('Network error:', fetchError);
            throw new Error('Network error. Please check your connection and try again.');
          } else {
            throw fetchError;
          }
        }
      } catch (error) {
        console.error('Error:', error);
        hasCalledApi.current = false; // Reset the flag on error
        alert(error instanceof Error ? error.message : 'An error occurred while processing your documents.');
        
        // Clear any existing intervals before navigation
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        
        // Use replace instead of push to prevent back button from returning to processing page
        router.replace('/document-collection');
      }
    };

    if (documents) {
      processDocuments();
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };
  }, [router, documents, applicationId]);

  const circumference = 2 * Math.PI * 76; // circle radius = 76
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div>
      <Head>
        <style>{SharedStyles}</style>
        <style>{`
          .card {
            background-color: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(168, 85, 247, 0.3);
            border-radius: 0.75rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          
          .gradient-text {
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            background-image: linear-gradient(to right, #38BDF8, #818CF8, #C084FC);
          }
          
          .processing-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(56, 189, 248, 0.1) 50%, transparent 70%);
            filter: blur(20px);
            z-index: -1;
          }
          
          .circular-progress {
            position: relative;
            width: 164px;
            height: 164px;
            margin: 0 auto 2rem;
          }
          
          .progress-background {
            fill: none;
            stroke: rgba(51, 65, 85, 0.5);
            stroke-width: 8;
          }
          
          .progress-bar {
            fill: none;
            stroke: url(#gradient);
            stroke-width: 8;
            stroke-linecap: round;
            transform: rotate(-90deg);
            transform-origin: center;
            transition: stroke-dashoffset 0.5s ease;
            filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.4));
          }
          
          .progress-percentage {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 2.25rem;
            font-weight: 700;
            color: white;
            text-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
          }
          
          .processing-text {
            text-align: center;
            margin-top: 1.5rem;
          }
          
          .processing-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
          }
          
          .current-stage {
            font-size: 1rem;
            color: #94a3b8;
            margin-bottom: 1rem;
          }
          
          .criteria-chips-container {
            display: flex;
            gap: 0.5rem;
            overflow-x: auto;
            padding: 0.5rem 0;
            scrollbar-width: none;
            -ms-overflow-style: none;
            justify-content: center;
            flex-wrap: nowrap;
          }
          
          .criteria-chips-container::-webkit-scrollbar {
            display: none;
          }
          
          .criteria-chip {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            background: rgba(99, 102, 241, 0.2);
            border: 1px solid rgba(99, 102, 241, 0.4);
            border-radius: 9999px;
            font-size: 0.75rem;
            color: #c4b5fd;
            box-shadow: 0 0 5px rgba(168, 85, 247, 0.3);
            transition: all 0.3s ease;
            white-space: nowrap;
            flex-shrink: 0;
          }
          
          .criteria-chip:nth-child(odd) {
            animation: pulse 3s infinite;
            animation-delay: calc(0.5s * var(--i, 0));
          }
          
          .criteria-chip:nth-child(even) {
            animation: pulse 4s infinite;
            animation-delay: calc(0.5s * var(--i, 0));
          }
          
          @keyframes pulse {
            0%, 100% { 
              transform: scale(1);
              opacity: 1;
            }
            50% { 
              transform: scale(1.05);
              opacity: 0.9;
            }
          }
          
          .processing-messages {
            position: relative;
            height: 4rem;
            overflow: hidden;
            margin-top: 1.5rem;
          }
          
          .message-transition {
            position: absolute;
            width: 100%;
            top: 0;
            left: 0;
            opacity: 0;
            color: #94a3b8;
            transition: opacity 0.5s ease, transform 0.5s ease;
            animation: fadeInOut 5s ease infinite;
            transform: translateY(20px);
          }
          
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(10px); }
            10%, 90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
          }
        `}</style>
        <title>Prometheus - Processing Documents</title>
      </Head>

      <BackgroundEffects />

      <div className="min-h-screen bg-transparent">
        {/* Navigation Bar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md py-3 border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <Link href="/" className="flex items-center group">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-purple-400 transition-all duration-300 font-outfit">Prometheus</span>
              </Link>
              
              <div className="hidden md:flex space-x-8">
                <Link 
                  href="/document-collection" 
                  className="text-slate-300 hover:text-white transition-colors font-outfit"
                >
                  Documents
                </Link>
                <Link 
                  href="/document-review" 
                  className="text-slate-300 hover:text-white transition-colors font-outfit"
                >
                  Review
                </Link>
                <Link 
                  href="/lawyer-search" 
                  className="text-slate-300 hover:text-white transition-colors font-outfit"
                >
                  Find Lawyer
                </Link>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700/50">
                  <span className="text-sm text-slate-300 font-outfit">Processing Documents</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content - Fixed centering */}
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold gradient-text mb-2">Processing Your Documents</h1>
              <p className="text-slate-300">
                Prometheus AI is analyzing your documents to identify your exceptional qualifications for an O-1 visa.
              </p>
            </div>
            
            <div className="card p-6 w-full border-primary-500/30 mb-8">
              <p className="text-center text-sm text-slate-300 mb-6">
                <strong className="text-primary-300">Expert Analysis:</strong> Our AI is evaluating your materials to find the strongest evidence of your extraordinary abilities.
              </p>

              <div className="relative mx-auto">
                <div className="processing-glow"></div>
                <div className="circular-progress">
                  <svg width="164" height="164" viewBox="0 0 164 164">
                    <circle
                      className="progress-background"
                      cx="82"
                      cy="82"
                      r="76"
                    />
                    <circle
                      className="progress-bar"
                      cx="82"
                      cy="82"
                      r="76"
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={strokeDashoffset}
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="50%" stopColor="#818CF8" />
                        <stop offset="100%" stopColor="#C084FC" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="progress-percentage">{progress}<span style={{ fontSize: '1.25rem' }}>%</span></div>
                </div>
              </div>

              <div className="processing-text">
                <h1 className="processing-title gradient-text">
                  Analyzing Your O-1 Visa Eligibility
                </h1>
                <div className="current-stage">{currentStage}</div>
                <div className="criteria-chips-container">
                  <span className="criteria-chip" style={{ '--i': 0 } as React.CSSProperties}>Awards</span>
                  <span className="criteria-chip" style={{ '--i': 1 } as React.CSSProperties}>Publications</span>
                  <span className="criteria-chip" style={{ '--i': 2 } as React.CSSProperties}>Leadership</span>
                  <span className="criteria-chip" style={{ '--i': 3 } as React.CSSProperties}>High Salary</span>
                  <span className="criteria-chip" style={{ '--i': 4 } as React.CSSProperties}>Critical Role</span>
                  <span className="criteria-chip" style={{ '--i': 5 } as React.CSSProperties}>Commercial Success</span>
                  <span className="criteria-chip" style={{ '--i': 6 } as React.CSSProperties}>Judging</span>
                </div>
                <div className="processing-messages">
                  <p key={currentMessageIndex} className="message-transition">
                    {processingMessages[currentMessageIndex]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}