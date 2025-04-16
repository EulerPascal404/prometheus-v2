import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';
import { processDocuments } from '../utils/documentProcessor';

export default function ProcessingDocuments() {
  const router = useRouter();
  const { documents } = router.query;
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("Initializing...");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const hasCalledApi = useRef<boolean>(false);
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

  // Function to update progress and status
  const updateProgress = (status: string, calculatedProgress: number) => {
    setProgress(calculatedProgress);
    setCurrentStage(status);
  };

  useEffect(() => {
    const processDocumentsLocally = async () => {
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
        const documentsObject = JSON.parse(documents as string);

        // Process documents locally
        const result = await processDocuments(
          user.id,
          documentsObject,
          (status, progress) => {
            // Format the status for display
            let displayStatus = status;
            let calculatedProgress = progress;
        
            console.log("Current status:", status);
        
            // Handle RAG page generation progress
            if (status && status.match(/generating_rag_page_\d+_of_\d+/)) {
              const matches = status.match(/generating_rag_page_(\d+)_of_(\d+)/);
              if (matches && matches.length === 3) {
                const currentPage = parseInt(matches[1], 10);
                const totalPages = parseInt(matches[2], 10);
                
                displayStatus = `Building O-1 Analysis (Step ${currentPage}/${totalPages})`;
                // Calculate progress as currentPage out of totalPages
                calculatedProgress = Math.floor((currentPage / totalPages) * 100);
              }
            }
            // Handle PDF filling progress
            else if (status && status.match(/filling_pdf_page_\d+_of_\d+/)) {
              const matches = status.match(/filling_pdf_page_(\d+)_of_(\d+)/);
              if (matches && matches.length === 3) {
                const currentPage = parseInt(matches[1], 10);
                const totalPages = parseInt(matches[2], 10);
                
                displayStatus = `Preparing O-1 Petition (Page ${currentPage}/${totalPages})`;
                // Calculate progress as currentPage out of totalPages
                calculatedProgress = Math.floor((currentPage / totalPages) * 100);
              }
            }
            // Handle completed PDF fill
            else if (status && status.match(/completed_pdf_fill_\d+_pages/)) {
              const matches = status.match(/completed_pdf_fill_(\d+)_pages/);
              if (matches && matches.length === 2) {
                displayStatus = `Finalizing your O-1 qualification analysis...`;
                calculatedProgress = 95; // Almost done
              }
            }
            // Handle RAG generation initial stage
            else if (status === 'generating_rag_responses') {
              displayStatus = 'Evaluating your qualifications for O-1 visa...';
              calculatedProgress = 10; // Starting the process
            }
            // Handle PDF preparation
            else if (status === 'preparing_pdf_fill') {
              displayStatus = 'Preparing O-1 petition documentation...';
              calculatedProgress = 30; // Preparing PDF
            }
            // Parse detailed page progress if available
            else if (status && status.match(/processing_\w+_page_\d+_of_\d+/)) {
              const matches = status.match(/processing_(\w+)_page_(\d+)_of_(\d+)/);
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
            else if (status && status.match(/processing_\w+_analysis/)) {
              const matches = status.match(/processing_(\w+)_analysis/);
              if (matches && matches.length === 2) {
                const docType = matches[1];
                displayStatus = `Evaluating ${docType.charAt(0).toUpperCase() + docType.slice(1)} Against O-1 Standards...`;
                calculatedProgress = 50; // Analysis phase
              }
            } 
            // Standard document processing
            else if (status && status.startsWith('processing_')) {
              const docType = status.replace('processing_', '');
              displayStatus = `Analyzing ${docType.charAt(0).toUpperCase() + docType.slice(1)} for Extraordinary Ability Evidence...`;
              calculatedProgress = 25; // Initial processing
            } 
            else if (status === 'completed') {
              displayStatus = 'Completing your O-1 qualification assessment...';
              calculatedProgress = 100;
            } 
            else if (status === 'pending') {
              displayStatus = 'Preparing to assess your O-1 visa eligibility...';
              calculatedProgress = 5;
            }
        
            console.log("Calculated progress:", calculatedProgress);
        
            // Update progress and status
            updateProgress(displayStatus, calculatedProgress);
          }
        );

        if (result.can_proceed) {
          // Store the summaries and field stats
          localStorage.setItem('documentSummaries', JSON.stringify(result.document_summaries));
          localStorage.setItem('fieldStats', JSON.stringify(result.field_stats));
          
          // Call fill-o1-form API
          try {
            updateProgress('Preparing O-1 form...', 80);
            
            // Ensure documentSummaries is properly formatted
            const formattedSummaries = {
              resume: result.document_summaries.resume || {},
              recommendation_letters: result.document_summaries.recommendation_letters || {},
              publications: result.document_summaries.publications || {},
              awards: result.document_summaries.awards || {},
              personal_info: result.document_summaries.personal_info || {}
            };

            const response = await fetch('/api/fill-o1-form', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: user.id,
                documentSummaries: formattedSummaries
              }),
            });

            const fillResult = await response.json();

            if (!response.ok) {
              throw new Error(fillResult.message || 'Failed to fill O-1 form');
            }
            
            // Store the filled PDF URL and updated field stats
            if (fillResult.filledPdfUrl) {
              localStorage.setItem('filledPdfUrl', fillResult.filledPdfUrl);
            }
            if (fillResult.fieldStats) {
              localStorage.setItem('fieldStats', JSON.stringify(fillResult.fieldStats));
            }
            
            updateProgress('Completed', 100);
            
            // Redirect to document review page
            router.push({
              pathname: '/document-review',
              query: { 
                userId: user.id,
                processed: 'true'
              }
            });
          } catch (error) {
            console.error('Error filling O-1 form:', error);
            // Even if filling fails, we can still proceed to document review
            router.push({
              pathname: '/document-review',
              query: { 
                userId: user.id,
                processed: 'true'
              }
            });
          }
        } else {
          throw new Error('Please ensure you have uploaded all required documents.');
        }
      } catch (error) {
        console.error('Error:', error);
        alert(error instanceof Error ? error.message : 'An error occurred while processing your documents.');
        router.push('/document-collection');
      }
    };

    if (documents) {
      processDocumentsLocally();
    }
  }, [documents, router]);

  const circumference = 2 * Math.PI * 76; // circle radius = 76
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div>
      <Head>
        <style>{SharedStyles}</style>
        <title>Prometheus - Processing Documents</title>
      </Head>

      <BackgroundEffects />

      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6">
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
              <div className="flex flex-wrap justify-center gap-2 my-4">
                <span className="criteria-chip">Awards</span>
                <span className="criteria-chip">Publications</span>
                <span className="criteria-chip">Leadership</span>
                <span className="criteria-chip">High Salary</span>
                <span className="criteria-chip">Critical Role</span>
                <span className="criteria-chip">Commercial Success</span>
                <span className="criteria-chip">Judging</span>
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
  );
}