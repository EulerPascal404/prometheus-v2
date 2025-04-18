import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';
import Script from 'next/script';

// Define types that were previously imported from utils/documentProcessor
export interface FieldStats {
  total_fields: number;
  user_info_filled: number;
  percent_filled: number;
  N_A_per: number;      // Fields needed for personal info
  N_A_r: number;        // Fields needed for resume info
  N_A_rl: number;       // Fields needed for recommendation letters
  N_A_ar: number;       // Fields needed for awards/recognition
  N_A_p: number;        // Fields needed for publications
  N_A_ss: number;       // Fields needed for salary/success info
  N_A_pm: number;       // Fields needed for professional membership
  // Additional fields used in document-review.tsx
  na_extraordinary: number;  // Fields needed for extraordinary ability evidence
  na_recognition: number;    // Fields needed for recognition evidence
  na_publications: number;   // Fields needed for publications evidence
  na_leadership: number;     // Fields needed for leadership evidence
  na_contributions: number;  // Fields needed for contributions evidence
  na_salary: number;         // Fields needed for salary evidence
  na_success: number;        // Fields needed for success evidence
}

export interface DocumentSummary {
  summary: string;
  pages: number;
  pdf_filled_pages: number;
  processed: boolean;
  text_preview?: string;
  error?: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface DocumentSummaries {
  [key: string]: DocumentSummary;
}

// Function to parse document summaries (simplified version)
export function parseSummary(analysis: string): ParsedSummary {
  console.log('Parsing analysis:', analysis);
  
  const sections = {
    strengths: [] as string[],
    weaknesses: [] as string[],
    recommendations: [] as string[]
  };

  try {
    // Split the analysis into sections based on headers
    const sectionRegex = /(?:###\s*)?(?:Strengths|Weaknesses|Recommendations):/gi;
    const parts = analysis.split(sectionRegex);
    
    // Skip the first part (it's before any section header)
    for (let i = 1; i < parts.length; i++) {
      const sectionContent = parts[i].trim();
      
      // Determine which section this is based on the previous header
      let currentSection: 'strengths' | 'weaknesses' | 'recommendations' | null = null;
      const prevHeader = analysis.substring(0, analysis.indexOf(parts[i])).match(sectionRegex);
      
      if (prevHeader) {
        const headerText = prevHeader[prevHeader.length - 1].toLowerCase();
        if (headerText.includes('strengths')) {
          currentSection = 'strengths';
        } else if (headerText.includes('weaknesses')) {
          currentSection = 'weaknesses';
        } else if (headerText.includes('recommendations')) {
          currentSection = 'recommendations';
        }
      }
      
      if (currentSection) {
        // Split the section content by [SEP] markers
        const bulletPoints = sectionContent.split('[SEP]');
        
        // Process each bullet point
        for (const bulletPoint of bulletPoints) {
          const cleanedPoint = bulletPoint
            .replace(/^\[|\]$/g, '') // Remove square brackets if present
            .trim();
            
          if (cleanedPoint) {
            sections[currentSection].push(cleanedPoint);
          }
        }
      }
    }

    console.log('Parsed sections:', sections);

    return {
      strengths: sections.strengths,
      weaknesses: sections.weaknesses,
      recommendations: sections.recommendations,
      hasAttemptedReparse: false
    };
  } catch (error) {
    console.error('Error parsing summary:', error);
    return {
      strengths: [],
      weaknesses: [],
      recommendations: [],
      hasAttemptedReparse: false
    };
  }
}

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
  hasAttemptedReparse: boolean;
}

// Helper function to safely extract document summary from API response
function getDocumentSummaryFromApi(data: any, documentType: string): ParsedSummary | null {
  if (!data?.document_summaries?.[documentType]) {
    console.log('No summary found for document type:', documentType);
    return null;
  }

  const summary = data.document_summaries[documentType];
  console.log('Found summary for', documentType, ':', summary);

  // Direct approach - if arrays are present and have content
  if (Array.isArray(summary.strengths) && summary.strengths.length > 0) {
    console.log('Using provided arrays from API data');
    return {
      strengths: summary.strengths,
      weaknesses: Array.isArray(summary.weaknesses) ? summary.weaknesses : [],
      recommendations: Array.isArray(summary.recommendations) ? summary.recommendations : [],
      hasAttemptedReparse: false
    };
  }
  
  // Parse from summary text if arrays are empty but summary text exists
  if (typeof summary.summary === 'string' && summary.summary.trim()) {
    console.log('Parsing from summary text');
    return parseSummary(summary.summary);
  }

  console.log('No usable data found in API response for', documentType);
  return null;
}

function SummarySection({ title, items, colorClass }: { 
  title: string; 
  items: string[];
  colorClass: 'green' | 'red' | 'blue';
}) {
  console.log(`Rendering ${title} section with ${items.length} items:`, items);
  
  return (
    <div className="summary-section" style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '15px' }}>
      <h4 className={`summary-title summary-title-${colorClass}`} style={{ fontWeight: 'bold', marginBottom: '10px' }}>{title}</h4>
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2.5" style={{ marginBottom: '5px' }}>
            <span className={`summary-dot summary-dot-${colorClass}`} style={{ 
              display: 'inline-block', 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              backgroundColor: colorClass === 'green' ? '#4CAF50' : colorClass === 'red' ? '#F44336' : '#2196F3',
              marginRight: '10px'
            }} />
            <span className="summary-text" style={{ color: '#fff' }}>{item}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-slate-500 italic" style={{ color: '#aaa' }}>No items found.</li>
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
  // Ensure we have valid stats object with fallbacks for any missing properties
  const safeStats: FieldStats = {
    total_fields: stats.total_fields || 45,
    user_info_filled: stats.user_info_filled || 20,
    percent_filled: stats.percent_filled || 44.44,
    N_A_per: stats.N_A_per || 4,
    N_A_r: stats.N_A_r || 5,
    N_A_rl: stats.N_A_rl || 3,
    N_A_ar: stats.N_A_ar || 4,
    N_A_p: stats.N_A_p || 5,
    N_A_ss: stats.N_A_ss || 4,
    N_A_pm: stats.N_A_pm || 2,
    na_extraordinary: stats.na_extraordinary || 5,
    na_recognition: stats.na_recognition || 4,
    na_publications: stats.na_publications || 5,
    na_leadership: stats.na_leadership || 3,
    na_contributions: stats.na_contributions || 4,
    na_salary: stats.na_salary || 4,
    na_success: stats.na_success || 3
  };

  // Helper function to determine priority areas based on field stats
  const getPriorityAreas = () => {
    // Use API response data if available, otherwise use safeStats
    const fieldStats = apiResponseData?.field_stats || safeStats;
    
    const areas = [
      { key: 'na_extraordinary', label: 'Extraordinary Ability Evidence', value: fieldStats.na_extraordinary || 5 },
      { key: 'na_recognition', label: 'Awards & Recognition', value: fieldStats.na_recognition || 4 },
      { key: 'na_publications', label: 'Published Materials', value: fieldStats.na_publications || 5 },
      { key: 'na_leadership', label: 'Leadership/Judging Roles', value: fieldStats.na_leadership || 3 },
      { key: 'na_contributions', label: 'Original Contributions', value: fieldStats.na_contributions || 4 },
      { key: 'na_salary', label: 'High Salary', value: fieldStats.na_salary || 4 },
      { key: 'na_success', label: 'Commercial Success', value: fieldStats.na_success || 3 }
    ];
    
    // Sort by highest number of missing fields
    return areas.sort((a, b) => b.value - a.value).slice(0, 3);
  };

  // Get form field data from API response if available
  const getFormFieldData = () => {
    if (apiResponseData?.document_summaries?.resume?.pdf_filled_pages?.[1]) {
      const formData = apiResponseData.document_summaries.resume.pdf_filled_pages[1];
      return [
        { label: 'Awards & Recognition', value: formData['N/A_ar'] || 4 },
        { label: 'Publications', value: formData['N/A_p'] || 5 },
        { label: 'Original Contributions', value: formData['N/A_per'] || 4 },
        { label: 'Professional Memberships', value: formData['N/A_pm'] || 2 },
        { label: 'Recognition', value: formData['N/A_r'] || 5 },
        { label: 'Leadership/Judging', value: formData['N/A_rl'] || 3 },
        { label: 'Commercial Success', value: formData['N/A_ss'] || 4 }
      ];
    }
    
    // Fallback to original stats if API data not available
    const fieldStats = apiResponseData?.field_stats || safeStats;
    return [
      { label: 'Extraordinary Ability', value: fieldStats.na_extraordinary || 5 },
      { label: 'Awards & Recognition', value: fieldStats.na_recognition || 4 },
      { label: 'Publications', value: fieldStats.na_publications || 5 },
      { label: 'Leadership/Judging', value: fieldStats.na_leadership || 3 },
      { label: 'Original Contributions', value: fieldStats.na_contributions || 4 },
      { label: 'High Salary', value: fieldStats.na_salary || 4 },
      { label: 'Commercial Success', value: fieldStats.na_success || 3 }
    ];
  };
  
  // Get petition completeness data from API response if available
  const getPetitionCompletenessData = () => {
    if (apiResponseData?.document_summaries?.resume?.pdf_filled_pages?.[1]) {
      const formData = apiResponseData.document_summaries.resume.pdf_filled_pages[1];
      return {
        totalFields: formData.total_fields || 45,
        fieldsFilled: formData.user_info_filled || 20,
        percentFilled: (formData.percent_filled || 44.44) / 10 // Divide by 10 as requested
      };
    }
    
    // Fallback to original stats if API data not available
    const fieldStats = apiResponseData?.field_stats || safeStats;
    return {
      totalFields: fieldStats.total_fields || 45,
      fieldsFilled: fieldStats.user_info_filled || 20,
      percentFilled: (fieldStats.percent_filled || 44.44) / 10 // Divide by 10 as requested
    };
  };

  // Calculate all derived data
  const priorityAreas = getPriorityAreas();
  const fieldStats = apiResponseData?.field_stats || safeStats;
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

// Function to validate API response data
function validateApiResponseData(data: any): boolean {
  if (!data) {
    console.error("API response data is null or undefined");
    return false;
  }
  
  if (!data.document_summaries) {
    console.error("API response data is missing document_summaries");
    return false;
  }
  
  // Check if document_summaries is an object
  if (typeof data.document_summaries !== 'object') {
    console.error("API response data document_summaries is not an object");
    return false;
  }
  
  // Check if document_summaries has any keys
  const docTypes = Object.keys(data.document_summaries);
  if (docTypes.length === 0) {
    console.error("API response data document_summaries is empty");
    return false;
  }
  
  console.log("API response data document_summaries has the following document types:", docTypes);
  
  // Check if each document summary has the required fields or can be parsed
  let isValid = true;
  docTypes.forEach(docType => {
    const summary = data.document_summaries[docType];
    
    // First check if we have strengths/weaknesses/recommendations arrays
    const hasArrays = Array.isArray(summary.strengths) || 
                      Array.isArray(summary.weaknesses) || 
                      Array.isArray(summary.recommendations);
                      
    // If we don't have arrays, check if we at least have a summary text
    const hasSummary = typeof summary.summary === 'string' && summary.summary.trim() !== '';
    
    if (!hasArrays && !hasSummary) {
      console.error(`Document summary for ${docType} is missing both arrays and summary text`);
      isValid = false;
    }
    
    // Add structure to any document that's missing it 
    if (!Array.isArray(summary.strengths)) {
      console.warn(`Document summary for ${docType} is missing strengths array, adding empty array`);
      summary.strengths = [];
    }
    
    if (!Array.isArray(summary.weaknesses)) {
      console.warn(`Document summary for ${docType} is missing weaknesses array, adding empty array`);
      summary.weaknesses = [];
    }
    
    if (!Array.isArray(summary.recommendations)) {
      console.warn(`Document summary for ${docType} is missing recommendations array, adding empty array`);
      summary.recommendations = [];
    }
    
    // Try to parse from summary text if needed and arrays are empty
    if (hasSummary && 
        summary.strengths.length === 0 && 
        summary.weaknesses.length === 0 && 
        summary.recommendations.length === 0) {
      console.log(`Attempting to parse from summary text for ${docType}`);
      const parsed = parseSummary(summary.summary);
      
      // Update the document summary with parsed arrays
      if (parsed.strengths.length > 0 || parsed.weaknesses.length > 0 || parsed.recommendations.length > 0) {
        console.log(`Successfully parsed arrays for ${docType}`, parsed);
        summary.strengths = parsed.strengths;
        summary.weaknesses = parsed.weaknesses;
        summary.recommendations = parsed.recommendations;
      }
    }
  });
  
  return isValid;
}

export default function DocumentReview() {
  const router = useRouter();
  const { userId, processed, apiResponse } = router.query;
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState<ParsedSummary>({ strengths: [], weaknesses: [], recommendations: [], hasAttemptedReparse: false });
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
  
  // Default mock stats to use when no data is available
  const defaultStats: FieldStats = {
    total_fields: 45,
    user_info_filled: 20,
    percent_filled: 44.44,
    N_A_per: 4,
    N_A_r: 5,
    N_A_rl: 3,
    N_A_ar: 4,
    N_A_p: 5,
    N_A_ss: 4,
    N_A_pm: 2,
    na_extraordinary: 5,
    na_recognition: 4,
    na_publications: 5,
    na_leadership: 3,
    na_contributions: 4,
    na_salary: 4,
    na_success: 3
  };
  
  // Parse API response data from URL query
  useEffect(() => {
    if (apiResponse && typeof apiResponse === 'string') {
      try {
        const parsedData = JSON.parse(apiResponse);
        console.log("Raw parsed API response data:", parsedData);
        
        // Ensure document_summaries exists
        if (!parsedData.document_summaries) {
          console.warn("API response missing document_summaries, creating empty object");
          parsedData.document_summaries = {};
        }
        
        // Ensure each document summary has the necessary structure
        if (typeof parsedData.document_summaries === 'object') {
          Object.keys(parsedData.document_summaries).forEach(docType => {
            const summary = parsedData.document_summaries[docType];
            console.log(`Document summary for ${docType}:`, summary);
            
            // If summary is missing or not an object, initialize it
            if (!summary || typeof summary !== 'object') {
              console.warn(`Invalid summary for ${docType}, creating empty object`);
              parsedData.document_summaries[docType] = {
                summary: '',
                strengths: [],
                weaknesses: [],
                recommendations: []
              };
              return; // Skip the rest for this docType
            }
            
            // Ensure we have the core summary text
            if (typeof summary.summary !== 'string') {
              console.warn(`Missing summary text for ${docType}`);
              summary.summary = '';
            }
            
            // Check and initialize arrays if needed
            if (!Array.isArray(summary.strengths)) {
              console.warn(`Missing strengths array for ${docType}`);
              summary.strengths = [];
            }
            
            if (!Array.isArray(summary.weaknesses)) {
              console.warn(`Missing weaknesses array for ${docType}`);
              summary.weaknesses = [];
            }
            
            if (!Array.isArray(summary.recommendations)) {
              console.warn(`Missing recommendations array for ${docType}`);
              summary.recommendations = [];
            }
            
            // If arrays are empty but we have a summary text, try to parse it
            if (summary.summary && 
                summary.strengths.length === 0 && 
                summary.weaknesses.length === 0 && 
                summary.recommendations.length === 0) {
              console.log(`Attempting to parse summary for ${docType}`);
              const parsed = parseSummary(summary.summary);
              if (parsed.strengths.length > 0 || parsed.weaknesses.length > 0 || parsed.recommendations.length > 0) {
                console.log(`Successfully parsed arrays for ${docType}`, parsed);
                summary.strengths = parsed.strengths;
                summary.weaknesses = parsed.weaknesses;
                summary.recommendations = parsed.recommendations;
              }
            }
            
            // Log the final arrays to verify they have content
            console.log(`${docType} final strengths:`, summary.strengths);
            console.log(`${docType} final weaknesses:`, summary.weaknesses);
            console.log(`${docType} final recommendations:`, summary.recommendations);
          });
        }
        
        // Validate the enhanced data
        const isValid = validateApiResponseData(parsedData);
        console.log("API response data validation result:", isValid);
        
        // Set the data even if not entirely valid (we've added fallbacks where needed)
        setApiResponseData(parsedData);
        console.log("Final API Response Data:", parsedData);
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
        
        // Here is the critical part: Directly initialize a document and its summary
        // First check if we have API response data
        if (apiResponseData && apiResponseData.document_summaries) {
          console.log("Found API response data:", apiResponseData);
          
          // Find a document with content
          const apiDocTypes = Object.keys(apiResponseData.document_summaries);
          for (const docType of apiDocTypes) {
            const apiSummary = apiResponseData.document_summaries[docType];
            const hasContent = (
              Array.isArray(apiSummary.strengths) && apiSummary.strengths.length > 0 ||
              Array.isArray(apiSummary.weaknesses) && apiSummary.weaknesses.length > 0 ||
              Array.isArray(apiSummary.recommendations) && apiSummary.recommendations.length > 0
            );
            
            if (hasContent) {
              console.log(`Found API document with content: ${docType}`);
              
              // Set it as selected document
              setSelectedDoc(docType);
              
              // Directly initialize parsed summary
              const directSummary: ParsedSummary = {
                strengths: Array.isArray(apiSummary.strengths) ? [...apiSummary.strengths] : [],
                weaknesses: Array.isArray(apiSummary.weaknesses) ? [...apiSummary.weaknesses] : [],
                recommendations: Array.isArray(apiSummary.recommendations) ? [...apiSummary.recommendations] : [],
                hasAttemptedReparse: true
              };
              
              console.log("Setting parsed summary directly:", directSummary);
              setParsedSummary(directSummary);
              break; // Found one document, stop searching
            }
          }
        }
        // Fall back to default document selection if no API data
        else if (docs.length > 0) {
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
  }, [userId, apiResponseData]);

  // Update parsed summary when selected document changes
  useEffect(() => {
    if (selectedDoc) {
      console.log(`Selected document changed to: ${selectedDoc}`);
      
      // DIRECT CONSOLE LOG FOR DEBUGGING
      if (apiResponseData?.document_summaries?.[selectedDoc]) {
        console.log("DIRECT ACCESS TO API DATA FOR SELECTED DOC:");
        console.log("Strengths:", apiResponseData.document_summaries[selectedDoc].strengths);
        console.log("Weaknesses:", apiResponseData.document_summaries[selectedDoc].weaknesses);
        console.log("Recommendations:", apiResponseData.document_summaries[selectedDoc].recommendations);
      }
      
      // First priority: Use API data if available
      if (apiResponseData?.document_summaries?.[selectedDoc]) {
        const docData = apiResponseData.document_summaries[selectedDoc];
        
        // Create a fresh object to avoid reference issues
        const apiParsed: ParsedSummary = {
          strengths: Array.isArray(docData.strengths) ? [...docData.strengths] : [],
          weaknesses: Array.isArray(docData.weaknesses) ? [...docData.weaknesses] : [],
          recommendations: Array.isArray(docData.recommendations) ? [...docData.recommendations] : [],
          hasAttemptedReparse: false
        };
        
        console.log("API data parsed summary:", apiParsed);
        
        // Only use API data if it has content
        if (apiParsed.strengths.length > 0 || apiParsed.weaknesses.length > 0 || apiParsed.recommendations.length > 0) {
          console.log("Using API data for parsed summary");
          setParsedSummary(apiParsed);
          return; // Exit early
        }
      }
      
      // Second priority: Parse from document summary
      const doc = documents.find(d => d.fileType === selectedDoc);
      if (doc?.summary) {
        console.log(`Using document summary for ${selectedDoc}`);
        const parsed = parseSummary(doc.summary);
        console.log(`Parsed from document summary:`, parsed);
        setParsedSummary(parsed);
      } else {
        console.log("No document summary found, setting empty parsed summary");
        setParsedSummary({
          strengths: [],
          weaknesses: [],
          recommendations: [],
          hasAttemptedReparse: false
        });
      }
    }
  }, [selectedDoc, documents, apiResponseData]);

  // Add a useEffect to log the parsed summary when it changes
  useEffect(() => {
    console.log("parsedSummary state updated:", parsedSummary);
    
    // If parsedSummary is empty but we have document summaries in the API response,
    // try a direct approach to set the arrays
    if ((!parsedSummary.strengths.length && !parsedSummary.weaknesses.length && !parsedSummary.recommendations.length) && 
        selectedDoc && apiResponseData?.document_summaries?.[selectedDoc]) {
      
      const summaryData = apiResponseData.document_summaries[selectedDoc];
      console.log("Direct access to API summary data:", summaryData);
      
      if (summaryData) {
        const directParsed: ParsedSummary = {
          strengths: Array.isArray(summaryData.strengths) ? summaryData.strengths : [],
          weaknesses: Array.isArray(summaryData.weaknesses) ? summaryData.weaknesses : [],
          recommendations: Array.isArray(summaryData.recommendations) ? summaryData.recommendations : [],
          hasAttemptedReparse: true
        };
        
        if (directParsed.strengths.length || directParsed.weaknesses.length || directParsed.recommendations.length) {
          console.log("Setting parsedSummary directly from API data:", directParsed);
          setParsedSummary(directParsed);
        }
      }
    }
  }, [parsedSummary, selectedDoc, apiResponseData]);

  // Set initial parsedSummary when apiResponseData is loaded
  useEffect(() => {
    if (apiResponseData && apiResponseData.document_summaries && selectedDoc) {
      console.log("Setting initial parsedSummary from apiResponseData for", selectedDoc);
      const summary = apiResponseData.document_summaries[selectedDoc];
      
      if (summary) {
        // Create a fresh parsed summary directly from API data
        const initialParsed: ParsedSummary = {
          strengths: Array.isArray(summary.strengths) ? [...summary.strengths] : [],
          weaknesses: Array.isArray(summary.weaknesses) ? [...summary.weaknesses] : [],
          recommendations: Array.isArray(summary.recommendations) ? [...summary.recommendations] : [],
          hasAttemptedReparse: false
        };
        
        console.log("Initial parsed summary from API:", initialParsed);
        
        // Only update if we have actual content
        if (initialParsed.strengths.length > 0 || 
            initialParsed.weaknesses.length > 0 || 
            initialParsed.recommendations.length > 0) {
          console.log("Setting parsedSummary directly from API data");
          setParsedSummary(initialParsed);
        } else if (typeof summary.summary === 'string' && summary.summary.trim()) {
          // Try parsing from the summary text as a last resort
          console.log("Trying to parse directly from summary text");
          const parsedFromText = parseSummary(summary.summary);
          console.log("Parsed from text:", parsedFromText);
          
          if (parsedFromText.strengths.length > 0 || 
              parsedFromText.weaknesses.length > 0 || 
              parsedFromText.recommendations.length > 0) {
            console.log("Setting parsedSummary from parsed text");
            setParsedSummary(parsedFromText);
          }
        }
      }
    }
  }, [apiResponseData, selectedDoc]);

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
      
      // Use local API route to avoid CORS issues
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
              {/* Always display StatsSection with fallback to defaultStats */}
              <StatsSection stats={fieldStats || defaultStats} filledPdfUrl={filledPdfUrl} apiResponseData={apiResponseData} />
              
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