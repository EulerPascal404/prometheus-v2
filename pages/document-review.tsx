import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';
import Script from 'next/script';

interface DocumentInfo {
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  fileType: string;
  summary?: string;
}

interface ParsedSummary {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

function parseSummary(summary: string): ParsedSummary {
  const defaultResult = {
    strengths: [],
    weaknesses: [],
    recommendations: []
  };

  try {
    // First, split by main sections
    const sections = summary.split(/(?=Strengths:|Weaknesses:|Recommendations:)/);
    
    const extractItems = (section: string): string[] => {
      // Remove the section title and any brackets
      const content = section
        .replace(/^(Strengths|Weaknesses|Recommendations):/, '')
        .replace(/^\[|\]$/g, '')
        .trim();

      // Split by [SEP] token and clean up
      return content
        .split('[SEP]')
        .map(item => item.trim())
        .filter(item => 
          item.length > 0 && 
          item !== '[SEP]'
        );
    };

    sections.forEach(section => {
      if (section.includes('Strengths:')) {
        defaultResult.strengths = extractItems(section);
      } else if (section.includes('Weaknesses:')) {
        defaultResult.weaknesses = extractItems(section);
      } else if (section.includes('Recommendations:')) {
        defaultResult.recommendations = extractItems(section);
      }
    });

    // Add debug logging
    console.log('Parsed sections:', {
      strengths: defaultResult.strengths,
      weaknesses: defaultResult.weaknesses,
      recommendations: defaultResult.recommendations
    });

    return defaultResult;
  } catch (error) {
    console.error('Error parsing summary:', error);
    return defaultResult;
  }
}

function SummarySection({ title, items, colorClass }: { 
  title: string; 
  items: string[];
  colorClass: 'green' | 'red' | 'blue';
}) {
  return (
    <div className="summary-section">
      <h4 className={`summary-title summary-title-${colorClass}`}>{title}</h4>
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2.5">
            <span className={`summary-dot summary-dot-${colorClass}`} />
            <span className="summary-text">{item}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-slate-500 italic">No items found.</li>
        )}
      </ul>
    </div>
  );
}

// First, update the global type definitions at the top of the file
declare global {
  interface Window {
    google: any;
    initializeGooglePlaces: () => void;
  }
}

// Add this new interface after the existing interfaces
interface FieldStats {
  total_fields: number;
  user_info_filled: number;
  percent_filled: number;
  na_extraordinary: number;    // Fields needed to demonstrate extraordinary ability
  na_recognition: number;      // Fields needed for awards and recognition
  na_publications: number;     // Fields needed for published materials
  na_leadership: number;       // Fields needed for leadership/judging roles
  na_contributions: number;    // Fields needed for original contributions
  na_salary: number;           // Fields needed for high salary evidence
  na_success: number;          // Fields needed for commercial success
}

// Modified StatsSection component to focus on O-1 criteria
function StatsSection({ stats }: { stats: FieldStats }) {
  // Helper function to determine priority areas based on field stats
  const getPriorityAreas = () => {
    const areas = [
      { key: 'na_extraordinary', label: 'Extraordinary Ability Evidence', value: stats.na_extraordinary },
      { key: 'na_recognition', label: 'Awards & Recognition', value: stats.na_recognition },
      { key: 'na_publications', label: 'Published Materials', value: stats.na_publications },
      { key: 'na_leadership', label: 'Leadership/Judging Roles', value: stats.na_leadership },
      { key: 'na_contributions', label: 'Original Contributions', value: stats.na_contributions },
      { key: 'na_salary', label: 'High Salary', value: stats.na_salary },
      { key: 'na_success', label: 'Commercial Success', value: stats.na_success }
    ];
    
    // Sort by highest number of missing fields
    return areas.sort((a, b) => b.value - a.value).slice(0, 3);
  };

  const priorityAreas = getPriorityAreas();
  const applicationScore = Math.round((stats.percent_filled / 10) * 10) / 10;

  return (
    <div className="stats-container">
      <h3 className="stats-title">O-1 Petition Strength Analysis</h3>
      
      <div className="next-steps-section">
        <h4 className="next-steps-title">Application Progress</h4>
        <div className="next-steps-content">
          <div className="priority-areas">
            <h5 className="priority-title">Priority Focus Areas</h5>
            <div className="priority-list">
              {priorityAreas.map((area, index) => (
                <div key={area.key} className="priority-item">
                  <div className="priority-number">{index + 1}</div>
                  <div className="priority-details">
                    <span className="priority-label">{area.label}</span>
                    <span className="priority-value">{area.value} evidence items needed</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="action-path">
            <h5 className="action-path-title">O-1 Petition Roadmap</h5>
            <div className="action-steps">
              <div className="action-step">
                <div className="action-indicator completed">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="action-label">Initial Qualification Analysis</span>
              </div>
              <div className="action-step">
                <div className="action-indicator active">
                  <span>2</span>
                </div>
                <span className="action-label">Strengthen Evidence</span>
              </div>
              <div className="action-step">
                <div className="action-indicator">
                  <span>3</span>
                </div>
                <span className="action-label">Immigration Expert Review</span>
              </div>
              <div className="action-step">
                <div className="action-indicator">
                  <span>4</span>
                </div>
                <span className="action-label">USCIS Submission</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-grid mt-8">
        <div className="stats-section">
          <h4 className="stats-section-title">Petition Completeness</h4>
          <div className="space-y-3">
            <div className="stats-item">
              <span className="stats-label">Total Evidence Fields</span>
              <span className="stats-value stats-value-total">{stats.total_fields}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Fields Provided</span>
              <span className="stats-value stats-value-filled">{stats.user_info_filled}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Completion Rate</span>
              <span className="stats-value stats-value-completion">{stats.percent_filled}%</span>
            </div>
          </div>
        </div>
        
        <div className="stats-section">
          <h4 className="stats-section-title">O-1 Criteria Coverage</h4>
          <div className="space-y-2">
            {[
              { label: 'Extraordinary Ability', value: stats.na_extraordinary },
              { label: 'Awards & Recognition', value: stats.na_recognition },
              { label: 'Publications', value: stats.na_publications },
              { label: 'Leadership/Judging', value: stats.na_leadership },
              { label: 'Original Contributions', value: stats.na_contributions },
              { label: 'High Salary', value: stats.na_salary },
              { label: 'Commercial Success', value: stats.na_success }
            ].map(({ label, value }) => (
              <div key={label} className="stats-item">
                <span className="stats-label">{label}</span>
                <div className="stats-value stats-value-missing">
                  <span>{value}</span>
                  <div className="stats-indicator"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="application-score-footer">
        <div className="score-display">
          <span className="score-value">{applicationScore}</span>
          <span className="score-max">/10</span>
        </div>
        <div className="score-label">O-1 Qualification Score</div>
      </div>

      <div className="stats-footer">
        <div className="stats-info">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-primary-400 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>To qualify for an O-1 visa, you must meet at least 3 of the 7 USCIS criteria for extraordinary ability.</span>
        </div>
      </div>
    </div>
  );
}

export default function DocumentReview() {
  const router = useRouter();
  const { userId, processed } = router.query;
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<any>(null);
  const [showLawyerForm, setShowLawyerForm] = useState(false);
  const [matchWithLawyer, setMatchWithLawyer] = useState(false);
  const [lawyerFormData, setLawyerFormData] = useState({
    address: '',
    additionalComments: ''
  });
  const [addressError, setAddressError] = useState<string | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  
  // Track if the Google Maps script is loaded
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const autocompleteInitialized = useRef(false);
  
  // Initialize Google Places Autocomplete
  const initializeAutocomplete = () => {
    if (!addressInputRef.current || autocompleteInitialized.current) return;
    
    try {
      console.log("Initializing Google Places Autocomplete");
      const autocomplete = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          types: ['address'],
          componentRestrictions: { country: 'us' }
        }
      );
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.formatted_address) {
          setLawyerFormData(prev => ({
            ...prev,
            address: place.formatted_address
          }));
          setAddressError(null);
          console.log("Selected address:", place.formatted_address);
        }
      });
      
      autocompleteInitialized.current = true;
      console.log("✅ Autocomplete initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing autocomplete:", error);
    }
  };
  
  // Handle script load callback
  useEffect(() => {
    // Define callback for when Google Maps script loads
    window.initializeGooglePlaces = () => {
      console.log("🗺️ Google Maps API loaded via callback");
      setMapsLoaded(true);
    };
    
    // Check if Maps is already loaded when component mounts
    if (window.google && window.google.maps && window.google.maps.places) {
      console.log("🗺️ Google Maps API already loaded");
      setMapsLoaded(true);
    }
    
    return () => {
      // Clean up
      delete window.initializeGooglePlaces;
    };
  }, []);
  
  // Initialize autocomplete when both form is shown and Maps is loaded
  useEffect(() => {
    if (showLawyerForm && mapsLoaded && !autocompleteInitialized.current) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeAutocomplete();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [showLawyerForm, mapsLoaded]);
  
  // Reset initialization flag when form closes
  useEffect(() => {
    if (!showLawyerForm) {
      autocompleteInitialized.current = false;
    }
  }, [showLawyerForm]);

  // Add custom styling for autocomplete dropdown
  useEffect(() => {
    if (showLawyerForm) {
      const styleEl = document.createElement('style');
      styleEl.id = 'places-autocomplete-style';
      styleEl.innerHTML = `
        /* Google Places Autocomplete Custom Styling */
        .pac-container {
          background: rgba(30, 41, 59, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(71, 85, 105, 0.4);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3), 0 0 10px rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
          margin-top: 4px;
          font-family: 'IBM Plex Mono', 'Space Mono', 'Roboto Mono', monospace;
          padding: 0.5rem;
          z-index: 2000;
        }
        
        .pac-item {
          padding: 0.5rem 0.75rem;
          color: #CBD5E1;
          font-size: 0.875rem;
          line-height: 1.5;
          border-color: rgba(71, 85, 105, 0.3);
          cursor: pointer;
          border-radius: 0.25rem;
          margin-bottom: 2px;
          transition: all 0.15s ease;
        }
        
        .pac-item:hover, .pac-item-selected {
          background: rgba(168, 85, 247, 0.1);
          border-color: rgba(168, 85, 247, 0.3);
        }
        
        .pac-icon {
          color: #A855F7;
        }
        
        .pac-item-query {
          color: #E2E8F0;
          font-size: 0.925rem;
          padding-right: 0.5rem;
        }
        
        .pac-matched {
          color: #A855F7;
          text-shadow: 0 0 8px rgba(168, 85, 247, 0.2);
        }
        
        .pac-item span:not(.pac-icon):not(.pac-item-query) {
          color: #94A3B8;
          font-size: 0.75rem;
        }
      `;
      
      document.head.appendChild(styleEl);
      
      return () => {
        const style = document.getElementById('places-autocomplete-style');
        if (style) style.remove();
      };
    }
  }, [showLawyerForm]);

  const [fieldStats, setFieldStats] = useState<FieldStats | null>(null);
  
  // Update the useEffect that fetches documents to also get field stats
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      try {
        // Get the summaries from localStorage
        const storedSummaries = localStorage.getItem('documentSummaries');
        if (!storedSummaries) {
          console.error('No summaries found in localStorage');
          router.push('/document-collection');
          return;
        }

        const summariesData = JSON.parse(storedSummaries);
        setSummaries(summariesData);

        // Only fetch file list if we have summaries
        const { data: files, error } = await supabase.storage
          .from('documents')
          .list(`${userId}`);

        if (error) throw error;

        if (files) {
          const documentPromises = files.map(async (file) => {
            const { data: { signedUrl } } = await supabase.storage
              .from('documents')
              .createSignedUrl(`${userId}/${file.name}`, 3600);

            const docType = file.name.split('.')[0];
            return {
              fileName: file.name,
              fileUrl: signedUrl || '',
              uploadedAt: new Date(file.created_at).toLocaleString(),
              fileType: file.metadata?.mimetype || 'unknown',
              summary: summariesData[docType]?.summary
            };
          });

          const documentInfos = await Promise.all(documentPromises);
          setDocuments(documentInfos);
          
          // Get field stats from the database
          const { data: userData } = await supabase
            .from('user_documents')
            .select('field_stats')
            .eq('user_id', userId)
            .single();
            
          if (userData?.field_stats) {
            setFieldStats(JSON.parse(userData.field_stats));
          }
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        router.push('/document-collection');
      } finally {
        setLoading(false);
      }
    };

    if (processed === 'true' && userId) {
      fetchData();
    }
  }, [userId, router, processed]);

  const handleLawyerMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced address validation
    if (!lawyerFormData.address.trim()) {
      setAddressError("Please enter your address");
      return;
    }
    
    // Validate address format - should contain street, city, state, and zip
    const addressParts = lawyerFormData.address.split(',');
    if (addressParts.length < 3) {
      setAddressError("Please enter a complete address with street, city, state, and zip code");
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get the uploaded documents status from localStorage
      const uploadedDocuments = JSON.parse(localStorage.getItem('uploadedDocuments') || '{}');

      // Store the form data in localStorage for distance calculation later
      localStorage.setItem('lawyerFormData', JSON.stringify({
        ...lawyerFormData,
        address: lawyerFormData.address.trim() // Make sure address is trimmed
      }));

      // Format the summaries to match the expected structure
      const formattedSummaries: { [key: string]: { summary: string } } = {};
      
      Object.entries(summaries || {}).forEach(([docType, docInfo]: [string, any]) => {
        if (docInfo && typeof docInfo === 'object' && 'summary' in docInfo) {
          formattedSummaries[docType] = {
            summary: docInfo.summary
          };
        }
      });

      const apiUrl = process.env.NODE_ENV === 'production'
        ? 'https://prometheus-ai-backend-app-589cbe98fdc3.herokuapp.com/api/match-lawyer'
        : 'http://localhost:8000/api/match-lawyer';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          uploaded_documents: uploadedDocuments,
          document_summaries: formattedSummaries,
          additional_info: {
            address: lawyerFormData.address,
            additional_comments: lawyerFormData.additionalComments
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to match with lawyer');
      }

      const result = await response.json();
      localStorage.setItem('lawyerMatch', JSON.stringify(result));
      router.push('/lawyer-search');
      
    } catch (error) {
      console.error('Error matching lawyer:', error);
      alert(error instanceof Error ? error.message : 'Error finding matching lawyer. Please try again.');
    }
  };

  const renderLawyerForm = () => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="card p-6 md:p-8 max-w-lg w-full m-4 relative">
        <h3 className="text-2xl font-semibold gradient-text mb-6 text-center">
          Connect with O-1 Visa Expert
        </h3>
        <form onSubmit={handleLawyerMatch} className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="address" className="form-label">Your Current Location</label>
            <input
              id="address"
              type="text"
              ref={addressInputRef}
              value={lawyerFormData.address}
              onChange={(e) => {
                setLawyerFormData(prev => ({ ...prev, address: e.target.value }));
                if (e.target.value.trim()) setAddressError(null);
              }}
              className={`form-input ${addressError ? 'border-rose-400 bg-rose-400/10' : ''}`}
              placeholder="Enter your full address (e.g., 123 Main St, City, State, ZIP)"
              autoComplete="off"
              required
            />
            {addressError && (
              <p className="text-xs text-rose-400 mt-1">{addressError}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              We use your location to match you with specialized O-1 visa attorneys near you
            </p>
            
            {/* Add indicator to show if Maps API has loaded */}
            {!mapsLoaded && (
              <p className="text-xs text-amber-400 mt-1">
                Loading address autocomplete...
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="additionalComments" className="form-label">Additional Information</label>
            <textarea
              id="additionalComments"
              value={lawyerFormData.additionalComments}
              onChange={(e) => setLawyerFormData(prev => ({ ...prev, additionalComments: e.target.value }))}
              className="form-input min-h-[120px] resize-y"
              placeholder="Share details about your field of expertise, achievements, or specific questions about your O-1 visa petition..."
            />
            <p className="mt-1.5 text-xs text-slate-400">
              These details help us match you with an attorney who specializes in your specific area of extraordinary ability
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowLawyerForm(false);
                setMatchWithLawyer(false);
              }}
              className="gradient-button text-sm"
            >
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              className="gradient-button text-sm"
            >
              <span>Find O-1 Expert</span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // First, add state for tracking the expanded sections
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isDocExpanded, setIsDocExpanded] = useState(false);

  return (
    <div>
      <Head>
        <style>{SharedStyles}</style>
        <title>Prometheus - Document Review</title>
      </Head>

      {/* Update the Script tag to load directly */}
      {showLawyerForm && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initializeGooglePlaces`}
          strategy="afterInteractive"
          onLoad={() => console.log("Script onLoad triggered")}
          onError={(e) => console.error("Script failed to load:", e)}
        />
      )}

      <BackgroundEffects />
        
      <div className="min-h-screen bg-transparent p-6">
        <div className="max-w-4xl mx-auto pt-12 md:pt-24">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">Document Review</h1>
            <p className="text-slate-300">
              Prometheus AI analyzes your documents to build your strongest O-1 visa case.
            </p>
          </div>

          <div className="card p-5 md:p-6 w-full text-center border-primary-500/30">
            <p className="text-sm text-slate-300">
              <strong className="font-semibold text-accent-300">Analysis Complete:</strong> Prometheus has evaluated your evidence to highlight your exceptional abilities and position you for success in your O-1 visa application.
            </p>
          </div>

          {loading && (
            <div className="text-center py-10">
              <div className="loading-spinner w-8 h-8 border-4 rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-slate-400">Analyzing your extraordinary ability evidence...</p>
            </div>
          )}

          {!loading && documents.length === 0 && (
            <div className="card p-6 text-center text-slate-400 w-full">
              No documents found or analysis is not yet available. Please upload your credentials first to assess your O-1 visa eligibility.
            </div>
          )}

          {!loading && documents.length > 0 && (
            <div className="space-y-6 w-full">
              {documents.filter(doc => doc.fileName.toLowerCase().includes('resume')).map((doc, index) => {
                const parsedSummary = doc.summary ? parseSummary(doc.summary) : { strengths: [], weaknesses: [], recommendations: [] };
                const documentUrl = './o1-form-template-cleaned-filled.pdf';
              
                return (
                  <div key={doc.fileName} className="card group overflow-hidden border-accent-400/20">
                    <button 
                      onClick={() => setIsDocExpanded(!isDocExpanded)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
                    >
                      <h3 className="text-lg font-semibold gradient-text">
                        O-1 Visa Qualification Assessment
                      </h3>
                      <svg 
                        className={`w-5 h-5 transform transition-transform ${isDocExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isDocExpanded && (
                      <div className="p-5 md:p-6 border-t border-slate-700/30">
                        <div className="document-header">
                          <p className="text-xs text-slate-400 mb-4">Analysis completed: {doc.uploadedAt}</p>
                          <div className="flex justify-center gap-3 mb-6">
                            <div className="flex items-center">
                              {/* Download Button */}
                              <a
                                href={documentUrl}
                                download
                                className="gradient-button text-sm"
                                title="Download Assessment"
                              >
                                <svg 
                                  className="w-4 h-4 mr-2" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={2} 
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                                Download Analysis
                              </a>
                              {/* View Document Button */}
                              <a
                                href={documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gradient-button text-sm ml-3"
                              >
                                View Sample Petition
                              </a>
                              <div className="info-icon-container" style={{ marginLeft: '4px' }}>
                                <svg 
                                  className="info-icon" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  strokeWidth="2"
                                  style={{ 
                                    width: '16px', 
                                    height: '16px',
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round'
                                  }}
                                >
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 16v-4" />
                                  <path d="M12 8v.01" />
                                </svg>
                                <div className="info-tooltip">
                                  <ul className="info-tooltip-list">
                                    <li><span className="key">na_extraordinary</span> <span className="desc">→ extraordinary ability evidence needed</span></li>
                                    <li><span className="key">na_recognition</span> <span className="desc">→ awards/recognition evidence needed</span></li>
                                    <li><span className="key">na_publications</span> <span className="desc">→ publications evidence needed</span></li>
                                    <li><span className="key">na_leadership</span> <span className="desc">→ leadership/judging evidence needed</span></li>
                                    <li><span className="key">na_contributions</span> <span className="desc">→ original contributions evidence needed</span></li>
                                    <li><span className="key">na_salary</span> <span className="desc">→ high salary evidence needed</span></li>
                                    <li><span className="key">na_success</span> <span className="desc">→ commercial success evidence needed</span></li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="summary-grid">
                          <SummarySection 
                            title="Strengths for O-1 Qualification" 
                            items={parsedSummary.strengths}
                            colorClass="green"
                          />
                          <SummarySection 
                            title="Areas Needing Evidence" 
                            items={parsedSummary.weaknesses}
                            colorClass="red"
                          />
                          <SummarySection 
                            title="Expert Recommendations" 
                            items={parsedSummary.recommendations}
                            colorClass="blue"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {fieldStats && (
                <div className="card group overflow-hidden border-accent-400/20">
                  <button 
                    onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
                  >
                    <h3 className="text-lg font-semibold gradient-text">
                      O-1 Criteria Coverage Analysis
                    </h3>
                    <svg 
                      className={`w-5 h-5 transform transition-transform ${isStatsExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isStatsExpanded && (
                    <div className="border-t border-slate-700/30">
                      <StatsSection stats={fieldStats} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && documents.length > 0 && !matchWithLawyer && (
            <div className="flex justify-center w-full pt-6">
              <button
                onClick={() => {
                  setShowLawyerForm(true);
                  setMatchWithLawyer(true);
                }}
                className="gradient-button text-base px-6 py-2.5 mx-auto"
              >
                Connect with O-1 Visa Expert
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          )}

          {!loading && documents.length > 0 && (
            <div className="text-center text-sm text-slate-500 max-w-lg">
              <p>For a successful O-1 visa petition, you must meet at least 3 of the 7 USCIS criteria for extraordinary ability. Our analysis helps identify your strongest qualification areas.</p>
            </div>
          )}
        </div>
      </div>
      {showLawyerForm && renderLawyerForm()}
    </div>
  );
}