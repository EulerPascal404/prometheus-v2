import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';
import Script from 'next/script';
import { parseSummary, FieldStats, DocumentSummaries } from '../utils/documentProcessor';

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

// Remove the custom Google Places API type declarations since we're using @types/google.maps
declare global {
  interface Window {
    google: any; // Using any to avoid type conflicts
    initializeGooglePlaces: () => void;
  }
}

// Modified StatsSection component to focus on O-1 criteria
function StatsSection({ stats, filledPdfUrl, apiResponseData }: { 
  stats: FieldStats, 
  filledPdfUrl: string | null,
  apiResponseData?: any 
}) {
  // Helper function to determine priority areas based on field stats
  const getPriorityAreas = () => {
    // Use API response data if available, otherwise use stats
    const fieldStats = apiResponseData?.field_stats || stats;
    
    const areas = [
      { key: 'na_extraordinary', label: 'Extraordinary Ability Evidence', value: fieldStats.na_extraordinary },
      { key: 'na_recognition', label: 'Awards & Recognition', value: fieldStats.na_recognition },
      { key: 'na_publications', label: 'Published Materials', value: fieldStats.na_publications },
      { key: 'na_leadership', label: 'Leadership/Judging Roles', value: fieldStats.na_leadership },
      { key: 'na_contributions', label: 'Original Contributions', value: fieldStats.na_contributions },
      { key: 'na_salary', label: 'High Salary', value: fieldStats.na_salary },
      { key: 'na_success', label: 'Commercial Success', value: fieldStats.na_success }
    ];
    
    // Sort by highest number of missing fields
    return areas.sort((a, b) => b.value - a.value).slice(0, 3);
  };

  // Get form field data from API response if available
  const getFormFieldData = () => {
    if (apiResponseData?.document_summaries?.resume?.pdf_filled_pages?.[1]) {
      const formData = apiResponseData.document_summaries.resume.pdf_filled_pages[1];
      return [
        { label: 'Awards & Recognition', value: formData['N/A_ar'] },
        { label: 'Publications', value: formData['N/A_p'] },
        { label: 'Original Contributions', value: formData['N/A_per'] },
        { label: 'Professional Memberships', value: formData['N/A_pm'] },
        { label: 'Recognition', value: formData['N/A_r'] },
        { label: 'Leadership/Judging', value: formData['N/A_rl'] },
        { label: 'Commercial Success', value: formData['N/A_ss'] }
      ];
    }
    
    // Fallback to original stats if API data not available
    const fieldStats = apiResponseData?.field_stats || stats;
    return [
      { label: 'Extraordinary Ability', value: fieldStats.na_extraordinary },
      { label: 'Awards & Recognition', value: fieldStats.na_recognition },
      { label: 'Publications', value: fieldStats.na_publications },
      { label: 'Leadership/Judging', value: fieldStats.na_leadership },
      { label: 'Original Contributions', value: fieldStats.na_contributions },
      { label: 'High Salary', value: fieldStats.na_salary },
      { label: 'Commercial Success', value: fieldStats.na_success }
    ];
  };
  
  // Get petition completeness data from API response if available
  const getPetitionCompletenessData = () => {
    if (apiResponseData?.document_summaries?.resume?.pdf_filled_pages?.[1]) {
      const formData = apiResponseData.document_summaries.resume.pdf_filled_pages[1];
      return {
        totalFields: formData.total_fields,
        fieldsFilled: formData.user_info_filled,
        percentFilled: formData.percent_filled / 10 // Divide by 10 as requested
      };
    }
    
    // Fallback to original stats if API data not available
    const fieldStats = apiResponseData?.field_stats || stats;
    return {
      totalFields: fieldStats.total_fields,
      fieldsFilled: fieldStats.user_info_filled,
      percentFilled: fieldStats.percent_filled / 10 // Divide by 10 as requested
    };
  };

  // Calculate all derived data
  const priorityAreas = getPriorityAreas();
  const fieldStats = apiResponseData?.field_stats || stats;
  const canProceed = apiResponseData?.can_proceed ?? true;
  const formFieldData = getFormFieldData();
  const petitionData = getPetitionCompletenessData();
  const applicationScore = apiResponseData?.completion_score || Math.round(petitionData.percentFilled * 10) / 10;

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
                <div className={`action-indicator ${canProceed ? 'active' : ''}`}>
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
              <span className="stats-value stats-value-total">{petitionData.totalFields}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Fields Provided</span>
              <span className="stats-value stats-value-filled">{petitionData.fieldsFilled}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Completion Rate</span>
              <span className="stats-value stats-value-completion">{petitionData.percentFilled}%</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="stats-section">
          <h4 className="stats-section-title">O-1 Criteria Coverage</h4>
          <div className="space-y-2">
            {formFieldData.map(({ label, value }) => (
              <div key={label} className="stats-item">
                <span className="stats-label">{label}</span>
                <div className="stats-value stats-value-missing">
                  <span>{value}</span>
                  <div className="stats-indicator"></div>
                </div>
              </div>
            ))}
          </div>
          
          {filledPdfUrl && (
            <div className="mt-4">
              <a 
                href={filledPdfUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="primary-button w-full text-center block py-3 font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg"
              >
                View Document
              </a>
            </div>
          )}
        </div>

        {filledPdfUrl && (
          <div className="stats-section">
            <h4 className="stats-section-title">O-1 Form Preview</h4>
            <div className="space-y-4">
              <div className="w-full h-[300px] rounded-lg overflow-hidden border border-primary-500/30 bg-slate-900">
                <iframe
                  src={`${filledPdfUrl}#toolbar=0`}
                  className="w-full h-full"
                  title="O-1 Form Preview"
                />
              </div>
              <div className="flex space-x-4">
                <a 
                  href={filledPdfUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="primary-button"
                >
                  View in New Tab
                </a>
                <button 
                  onClick={() => window.open(filledPdfUrl, '_blank')}
                  className="secondary-button"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="application-score-footer mt-8">
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
          <span>This analysis is based on the documents you've provided and is not legal advice.</span>
        </div>
      </div>
    </div>
  );
}

export default function DocumentReview() {
  const router = useRouter();
  const { userId, processed, apiResponse } = router.query;
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState<ParsedSummary>({ strengths: [], weaknesses: [], recommendations: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [fieldStats, setFieldStats] = useState<FieldStats | null>(null);
  const [showLawyerForm, setShowLawyerForm] = useState(false);
  const [address, setAddress] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [matchedLawyer, setMatchedLawyer] = useState<any>(null);
  const [isMatchingLawyer, setIsMatchingLawyer] = useState(false);
  const [filledPdfUrl, setFilledPdfUrl] = useState<string | null>(null);
  const [apiResponseData, setApiResponseData] = useState<any>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  
  // Parse API response data from URL query
  useEffect(() => {
    if (apiResponse && typeof apiResponse === 'string') {
      try {
        const parsedData = JSON.parse(apiResponse);
        setApiResponseData(parsedData);
        console.log("API Response Data:", parsedData);
      } catch (error) {
        console.error("Error parsing API response:", error);
      }
    }
  }, [apiResponse]);
  
  // Initialize Google Places Autocomplete
  const initializeAutocomplete = () => {
    if (typeof window !== 'undefined' && window.google && addressInputRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'formatted_address'],
      });

      if (autocompleteRef.current) {
        autocompleteRef.current.addListener('place_changed', () => {
          if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (place.formatted_address) {
              setAddress(place.formatted_address);
            }
          }
        });
      }
    }
  };

  // Load Google Maps script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.initializeGooglePlaces = initializeAutocomplete;
        window.initializeGooglePlaces();
      };
      document.head.appendChild(script);
    } else if (typeof window !== 'undefined' && window.google) {
      initializeAutocomplete();
    }
    
    return () => {
      // Clean up if needed
    };
  }, []);
  
  // Fetch document data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No authenticated user found');
        }
        
        // Get documents from storage
        const { data: files, error: listError } = await supabase.storage
          .from('documents')
          .list(`${user.id}`);
          
        if (listError) {
          throw listError;
        }
        
        // Get document summaries from localStorage
        const storedSummaries = localStorage.getItem('documentSummaries');
        const documentSummaries: DocumentSummaries = storedSummaries ? JSON.parse(storedSummaries) : {};
        
        // Get field stats from localStorage
        const storedStats = localStorage.getItem('fieldStats');
        const stats: FieldStats | null = storedStats ? JSON.parse(storedStats) : null;
        
        if (stats) {
          setFieldStats(stats);
        }
        
        // Set the local O1 form path
        console.log("Setting local O1 form path...");
        setFilledPdfUrl('/o1-form-template-cleaned-filled.pdf');
        
        // Process files
        const docs: DocumentInfo[] = [];
        for (const file of files) {
          // Skip the filled O1 form in the document list
          if (file.name === 'filled-o1-form.pdf' || file.name === 'o1-form-template-cleaned-filled.pdf') continue;
          
          const docType = file.name.split('.')[0];
          const { data: urlData, error: urlError } = await supabase.storage
          .from('documents')
            .createSignedUrl(`${user.id}/${file.name}`, 3600);
            
          if (urlError) {
            console.error(`Error getting URL for ${file.name}:`, urlError);
            continue;
          }
          
          const summary = documentSummaries[docType]?.summary || '';
          
          docs.push({
              fileName: file.name,
            fileUrl: urlData.signedUrl,
            uploadedAt: file.created_at,
            fileType: docType,
            summary
          });
        }
        
        setDocuments(docs);
        
        // Set initial selected document if available
        if (docs.length > 0) {
          setSelectedDoc(docs[0].fileType);
          if (docs[0].summary) {
            setParsedSummary(parseSummary(docs[0].summary));
          }
        }
        
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Error loading your documents. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId]);

  // Update parsed summary when selected document changes
  useEffect(() => {
    if (selectedDoc) {
      const doc = documents.find(d => d.fileType === selectedDoc);
      if (doc?.summary) {
        setParsedSummary(parseSummary(doc.summary));
      }
    }
  }, [selectedDoc, documents]);

  const handleLawyerMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      alert('Please enter your address');
      return;
    }
    
    try {
      setIsMatchingLawyer(true);
      
      // Get document summaries from localStorage
      const storedSummaries = localStorage.getItem('documentSummaries');
      const documentSummaries: DocumentSummaries = storedSummaries ? JSON.parse(storedSummaries) : {};
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // Use the API endpoint from index.py
      const apiUrl = '/api/match-lawyer';
      
      console.log("Making API request to server:", apiUrl);
      console.log("Environment:", process.env.NODE_ENV);
      console.log("API URL from env:", process.env.NEXT_PUBLIC_API_URL);
      
      // Get uploaded documents from Supabase
      const { data: userDocs, error: userDocsError } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (userDocsError) {
        throw new Error('Error fetching user documents: ' + userDocsError.message);
      }
      
      // Create uploaded_documents object
      const uploaded_documents = {
        resume: userDocs?.resume || false,
        publications: userDocs?.publications || false,
        awards: userDocs?.awards || false,
        recommendation: userDocs?.recommendation || false,
        press: userDocs?.press || false,
        salary: userDocs?.salary || false,
        judging: userDocs?.judging || false,
        membership: userDocs?.membership || false,
        contributions: userDocs?.contributions || false
      };
      
      // Make API call to Flask backend for lawyer matching
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          uploaded_documents: uploaded_documents,
          document_summaries: documentSummaries,
          additional_info: {
            address: address,
            additional_comments: additionalComments
          }
        }),
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
      
      const matchedLawyerData = await response.json();
      console.log("API response:", matchedLawyerData);
      
      setMatchedLawyer(matchedLawyerData);
      setShowLawyerForm(false);
    } catch (error) {
      console.error('Error matching lawyer:', error);
      alert('Error finding a matching lawyer. Please try again.');
    } finally {
      setIsMatchingLawyer(false);
    }
  };

  const renderLawyerForm = () => (
    <div className="lawyer-form-container">
      <h3 className="lawyer-form-title">Find Your Immigration Expert</h3>
      <p className="lawyer-form-description">
        Enter your address and any additional information to help us match you with the best immigration lawyer for your O-1 visa case.
      </p>
      
      <form onSubmit={handleLawyerMatch} className="lawyer-form">
        <div className="form-group">
          <label htmlFor="address" className="form-label">Your Address</label>
            <input
            ref={addressInputRef}
            type="text"
              id="address"
            className="form-input"
            placeholder="Enter your address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

        <div className="form-group">
            <label htmlFor="additionalComments" className="form-label">Additional Information</label>
            <textarea
              id="additionalComments"
            className="form-textarea"
            placeholder="Any specific requirements or preferences for your immigration lawyer"
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            rows={4}
          />
          </div>
        
            <button
              type="submit"
          className="submit-button"
          disabled={isMatchingLawyer}
            >
          {isMatchingLawyer ? 'Finding Your Match...' : 'Find My Immigration Lawyer'}
            </button>
      </form>
    </div>
  );

  const renderMatchedLawyer = () => (
    <div className="matched-lawyer-container">
      <h3 className="matched-lawyer-title">Your Matched Immigration Expert</h3>
      
      <div className="lawyer-card">
        <div className="lawyer-header">
          <h4 className="lawyer-name">{matchedLawyer.name}</h4>
          <div className="match-score">
            <span className="match-score-value">{Math.round(matchedLawyer.match_score * 100)}%</span>
            <span className="match-score-label">Match</span>
          </div>
        </div>
        
        <div className="lawyer-details">
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Firm:</span>
            <span className="lawyer-detail-value">{matchedLawyer.firm}</span>
          </div>
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Law School:</span>
            <span className="lawyer-detail-value">{matchedLawyer.law_school}</span>
          </div>
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Bar Admissions:</span>
            <span className="lawyer-detail-value">{matchedLawyer.bar_admissions}</span>
          </div>
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Address:</span>
            <span className="lawyer-detail-value">{matchedLawyer.address}</span>
          </div>
        </div>
        
        <div className="lawyer-description">
          <p>{matchedLawyer.description}</p>
        </div>
        
        <div className="lawyer-actions">
          <button className="contact-button">Contact This Lawyer</button>
          <button 
            className="find-another-button"
            onClick={() => setShowLawyerForm(true)}
          >
            Find Another Match
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Head>
        <style>{SharedStyles}</style>
        <title>Prometheus - Document Review</title>
      </Head>

      <BackgroundEffects />
        
      <div className="min-h-screen bg-transparent p-6">
        <div className="max-w-6xl mx-auto pt-12 md:pt-24">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">Document Review</h1>
            <p className="text-slate-300">
              Review the analysis of your documents and get personalized recommendations for your O-1 visa application.
            </p>
          </div>

          {isLoading ? (
            <div className="card p-8 w-full text-center border-primary-500/30">
              <div className="w-12 h-12 rounded-full border-4 border-slate-600 border-t-primary-400 animate-spin mx-auto mb-4"></div>
              <p className="text-slate-300">Loading your document analysis...</p>
            </div>
          ) : (
            <>
              {fieldStats && <StatsSection stats={fieldStats} filledPdfUrl={filledPdfUrl} apiResponseData={apiResponseData} />}
              
              <div className="card p-6 w-full border-primary-500/30 mt-8">
                <h3 className="text-xl font-semibold text-white mb-4">Document Analysis</h3>
                
                
                {documents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-300 mb-4">No documents found. Please upload your documents first.</p>
                    <button 
                      onClick={() => router.push('/document-collection')}
                      className="primary-button"
                    >
                      Upload Documents
                    </button>
                  </div>
                ) : (
                  <div className="document-review-container">
                    <div className="document-selector">
                      <h4 className="document-selector-title">Your Documents</h4>
                      <ul className="document-list">
                        {documents.map((doc) => (
                          <li 
                            key={doc.fileType}
                            className={`document-item ${selectedDoc === doc.fileType ? 'selected' : ''}`}
                            onClick={() => setSelectedDoc(doc.fileType)}
                          >
                            <span className="document-icon">
                              {doc.fileType === 'resume' && '📄'}
                              {doc.fileType === 'publications' && '📚'}
                              {doc.fileType === 'awards' && '🏆'}
                              {doc.fileType === 'recommendation' && '✉️'}
                              {doc.fileType === 'press' && '📰'}
                              {doc.fileType === 'salary' && '💰'}
                              {doc.fileType === 'judging' && '⚖️'}
                              {doc.fileType === 'membership' && '🏢'}
                              {doc.fileType === 'contributions' && '💡'}
                            </span>
                            <span className="document-name">{doc.fileType.charAt(0).toUpperCase() + doc.fileType.slice(1)}</span>
                            <a 
                              href={doc.fileUrl} 
                                target="_blank"
                                rel="noopener noreferrer"
                              className="document-view-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </a>
                          </li>
                        ))}
                                  </ul>
                                </div>
                    
                    <div className="document-analysis">
                      {selectedDoc ? (
                        <>
                          <h4 className="analysis-title">
                            Analysis: {selectedDoc.charAt(0).toUpperCase() + selectedDoc.slice(1)}
                          </h4>
                          
                          <div className="summary-sections">
                          <SummarySection 
                              title="Strengths" 
                            items={parsedSummary.strengths}
                            colorClass="green"
                          />
                          <SummarySection 
                              title="Weaknesses" 
                            items={parsedSummary.weaknesses}
                            colorClass="red"
                          />
                          <SummarySection 
                              title="Recommendations" 
                            items={parsedSummary.recommendations}
                            colorClass="blue"
                          />
                        </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-slate-300">Select a document to view its analysis.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="card p-6 w-full border-primary-500/30 mt-8">
                <h3 className="text-xl font-semibold text-white mb-4">Next Steps</h3>
                
                <div className="next-steps-grid">
                  <div className="next-step-card">
                    <div className="next-step-icon">📝</div>
                    <h4 className="next-step-title">Strengthen Your Evidence</h4>
                    <p className="next-step-description">
                      Based on our analysis, focus on gathering additional evidence in your priority areas.
                    </p>
                  <button 
                      onClick={() => router.push('/document-collection')}
                      className="next-step-button"
                    >
                      Upload More Documents
                    </button>
                  </div>
                  
                  <div className="next-step-card">
                    <div className="next-step-icon">⚖️</div>
                    <h4 className="next-step-title">Find an Immigration Lawyer</h4>
                    <p className="next-step-description">
                      Connect with an experienced immigration lawyer who specializes in O-1 visas.
                    </p>
                    <button 
                      onClick={() => setShowLawyerForm(true)}
                      className="next-step-button"
                    >
                      Find My Lawyer
                  </button>
                  </div>
                  
                  <div className="next-step-card">
                    <div className="next-step-icon">📊</div>
                    <h4 className="next-step-title">Track Your Progress</h4>
                    <p className="next-step-description">
                      Monitor your application's completeness and track improvements over time.
                    </p>
                    <button 
                      onClick={() => router.push('/dashboard')}
                      className="next-step-button"
                    >
                      View Dashboard
                    </button>
                    </div>
                </div>
            </div>
              
              {showLawyerForm && renderLawyerForm()}
              {matchedLawyer && !showLawyerForm && renderMatchedLawyer()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}