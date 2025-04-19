import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState, useCallback, useRef } from 'react';
import Script from 'next/script';
// Import SharedStyles and BackgroundEffects
import { SharedStyles, BackgroundEffects } from '../components/SharedStyles';
import { supabase } from '../config/supabase';

interface LawyerMatch {
  name: string;
  firm: string;
  law_school: string;
  bar_admissions: string;
  description: string;
  match_score: number;
  address?: string;
  o1_success_rate?: number;
  expertise?: string[];
  distance?: string;  // Add distance from the API response
  field_stats?: {
    total_fields: number;
    user_info_filled: number;
    percent_filled: number;
    na_extraordinary?: number;
    na_recognition?: number;
    na_publications?: number;
    na_leadership?: number;
    na_contributions?: number;
    na_salary?: number;
    na_success?: number;
  };
}

// Interface for Google Maps geocoding response
interface GeocodingResult {
  lat: number;
  lng: number;
}

// Properly declare the Google Maps types
declare global {
  interface Window {
    googleMapsLoaded: boolean;
    initializeGoogleMaps: () => void;
  }
}

// First, add this helper function at the top of the file, after the interfaces
const calculateGrade = (score: number): string => {
  if (score >= 98) return 'A+';
  if (score >= 95) return 'A';
  if (score >= 92) return 'A-';
  if (score >= 89) return 'B+';
  if (score >= 86) return 'B';
  if (score >= 83) return 'B-';
  return 'C+';
};

// Update the getTruncatedText function to get first 10 characters
// Update the getTruncatedText function to get first 10 words and add ellipsis
const getTruncatedText = (text: string): string => {
  const words = text.split(/\s+/);
  return words.length > 10 ? `${words.slice(0, 10).join(' ')}...` : text;
};

// First, add this component function after the existing helper functions near the top
const FieldStatsDisplay = ({ fieldStats }: { fieldStats: LawyerMatch['field_stats'] }) => {
  if (!fieldStats) return null;
  
  // Ensure we have the required base properties
  const safeFieldStats = {
    total_fields: fieldStats.total_fields || 0,
    user_info_filled: fieldStats.user_info_filled || 0,
    percent_filled: fieldStats.percent_filled || 0,
    
    // Add defaults for all possible fields
    na_extraordinary: fieldStats.na_extraordinary || 0,
    na_recognition: fieldStats.na_recognition || 0,
    na_publications: fieldStats.na_publications || 0,
    na_leadership: fieldStats.na_leadership || 0,
    na_contributions: fieldStats.na_contributions || 0,
    na_salary: fieldStats.na_salary || 0,
    na_success: fieldStats.na_success || 0
  };
  
  // Calculate the percentage for display
  const completionPercentage = Math.round(safeFieldStats.percent_filled);

  // Create categories array with labels and values
  const categories = [
    { label: 'Extraordinary Ability', value: safeFieldStats.na_extraordinary },
    { label: 'Recognition', value: safeFieldStats.na_recognition },
    { label: 'Publications', value: safeFieldStats.na_publications },
    { label: 'Leadership', value: safeFieldStats.na_leadership },
    { label: 'Contributions', value: safeFieldStats.na_contributions },
    { label: 'Salary', value: safeFieldStats.na_salary },
    { label: 'Success', value: safeFieldStats.na_success }
  ];

  // Filter out zero values
  const nonZeroCategories = categories.filter(cat => cat.value > 0);
  
  // Debug logs
  console.log("Rendering FieldStatsDisplay with data:", safeFieldStats);
  console.log("Non-zero categories:", nonZeroCategories);
  
  return (
    <div className="border-t border-slate-700/50 pt-4 mt-4 w-full">
      <h3 className="text-center text-sm text-slate-300 font-semibold mb-3">YOUR APPLICATION COMPLETION</h3>
      
      {/* Overall completion percentage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Application Progress</span>
          <span className="text-xs text-primary-400 font-medium">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-primary-500 to-accent-500 h-2 rounded-full" 
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
        <div className="mt-1 text-xs text-slate-500 text-center">
          {safeFieldStats.user_info_filled} of {safeFieldStats.total_fields} fields completed
        </div>
      </div>
      
      {/* Missing categories section - only show if there are non-zero values */}
      {nonZeroCategories.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs text-slate-400 mb-2">AREAS NEEDING ATTENTION:</h4>
          <div className="grid grid-cols-2 gap-2">
            {nonZeroCategories.map((category, index) => (
              <div key={index} className="bg-slate-800/50 rounded px-2 py-1.5 flex justify-between text-xs">
                <span className="text-slate-300">{category.label}</span>
                <span className="text-amber-400">{category.value} fields</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function LawyerSearch() {
  const router = useRouter();
  
  // Add view state enum to control the UI flow
  enum ViewState {
    ADDRESS_ENTRY,  // Initial address entry screen
    LOADING,        // Loading state
    RESULTS         // Results display
  }
  
  // State to control which view is displayed
  const [viewState, setViewState] = useState<ViewState>(ViewState.ADDRESS_ENTRY);
  
  const [matchedLawyer, setMatchedLawyer] = useState<LawyerMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<string | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const mapsAttempted = useRef(false);
  const calculationAttempted = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false); // State for description expansion
  const [address, setAddress] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  // Add style for any Google Maps elements
  useEffect(() => {
    // Create a style element for Google Maps styling
    const styleEl = document.createElement('style');
    styleEl.id = 'google-maps-style';
    styleEl.innerHTML = `
      /* Google Maps related styling */
      .gm-style {
        font-family: 'IBM Plex Mono', 'Space Mono', 'Roboto Mono', monospace;
      }
      
      .gm-style button {
        background: rgba(168, 85, 247, 0.1);
        border: 1px solid rgba(168, 85, 247, 0.25);
        color: #C084FC;
      }
      
      .gm-style button:hover {
        background: rgba(168, 85, 247, 0.15);
        border-color: rgba(168, 85, 247, 0.4);
      }
      
      /* Autocomplete dropdown styling */
      .pac-container {
        background-color: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 0.5rem;
        border: 1px solid rgba(168, 85, 247, 0.2);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        font-family: 'Inter', system-ui, sans-serif;
        margin-top: 4px;
        padding: 8px 0;
        z-index: 1000;
      }
      
      .pac-item {
        padding: 8px 12px;
        color: #E2E8F0;
        font-size: 0.875rem;
        border-top: 1px solid rgba(56, 189, 248, 0.1);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .pac-item:first-child {
        border-top: none;
      }
      
      .pac-item:hover, .pac-item-selected {
        background-color: rgba(168, 85, 247, 0.15);
      }
      
      .pac-icon {
        display: none;
      }
      
      .pac-item-query {
        color: #A855F7;
        font-size: 0.875rem;
        font-weight: 500;
        padding-right: 4px;
      }
      
      .pac-matched {
        color: #60A5FA;
        font-weight: 600;
      }
      
      .pac-logo:after {
        background-color: rgba(15, 23, 42, 0.95);
        color: #94A3B8;
        font-size: 0.75rem;
        padding: 4px 8px;
      }
    `;
    
    document.head.appendChild(styleEl);
    
    return () => {
      const existingStyle = document.getElementById('google-maps-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Handle Google Maps loaded callback
  const handleGoogleMapsLoaded = useCallback(() => {
    console.log("Google Maps API loaded");
    setGoogleMapsReady(true);
  }, []);

  // Set up the global callback function that Google Maps will call when loaded
  useEffect(() => {
    // Define the callback for Google Maps
    window.initializeGoogleMaps = () => {
      handleGoogleMapsLoaded();
    };
    
    return () => {
      // Clean up the global function when component unmounts
      if (window.initializeGoogleMaps) {
        window.initializeGoogleMaps = undefined as any;
      }
    };
  }, [handleGoogleMapsLoaded]);

  // Check if Google Maps is already loaded
  useEffect(() => {
    if (window.google && window.google.maps && !googleMapsReady) {
      console.log("Google Maps already available, initializing");
      handleGoogleMapsLoaded();
    }
  }, [googleMapsReady, handleGoogleMapsLoaded]);

  // Initialize Google Places autocomplete when Maps API is loaded
  useEffect(() => {
    if (googleMapsReady && addressInputRef.current && !autocompleteRef.current) {
      try {
        // Initialize the Places Autocomplete with custom options
        const autocomplete = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          { 
            types: ['address'],
            fields: ['formatted_address', 'geometry'],
            componentRestrictions: { country: 'us' }, // Restrict to US addresses for better results
          }
        );
        
        // Store reference
        autocompleteRef.current = autocomplete;
        
        // Set up the event listener
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place && place.formatted_address) {
            console.log("Selected place:", place);
            setAddress(place.formatted_address);
            
            // Auto-focus the additional comments field after selecting an address
            const commentsField = document.getElementById('additionalComments');
            if (commentsField) {
              setTimeout(() => {
                commentsField.focus();
              }, 100);
            }
          }
        });
        
        console.log("Google Places Autocomplete initialized");
      } catch (error) {
        console.error("Error initializing Places Autocomplete:", error);
      }
    }
  }, [googleMapsReady, addressInputRef.current]);

  // Calculate distance between addresses
  const calculateDistance = useCallback(async () => {
    if (!matchedLawyer?.address || !userAddress || !googleMapsReady) {
      console.log("Cannot calculate distance - missing data or Maps API not ready:", {
        hasLawyerAddress: !!matchedLawyer?.address,
        hasUserAddress: !!userAddress,
        mapsReady: googleMapsReady
      });
      return;
    }

    // Prevent multiple calculation attempts for the same data
    if (calculationAttempted.current) {
      return;
    }
    
    calculationAttempted.current = true;
    console.log("Calculating distance between:", {
      userAddress,
      lawyerAddress: matchedLawyer.address
    });

    setDistanceLoading(true);
    
    try {
      // Double-check Google Maps APIs are available
      if (!window.google || !window.google.maps || !window.google.maps.DistanceMatrixService) {
        console.error("Google Maps Distance Matrix API not available");
        setDistanceLoading(false);
        setDistance("Distance calculator not available");
        return;
      }

      // Use type assertion to avoid TypeScript errors
      const distanceService = new (window.google.maps as any).DistanceMatrixService();
      
      // Wait a moment to ensure Google Maps is fully initialized
      setTimeout(() => {
        distanceService.getDistanceMatrix(
          {
            origins: [userAddress],
            destinations: [matchedLawyer.address],
            travelMode: (window.google.maps as any).TravelMode.DRIVING,
            unitSystem: (window.google.maps as any).UnitSystem.IMPERIAL,
          },
          (response: any, status: string) => {
            console.log("Distance Matrix response:", status, response);
            if (status === 'OK' && response) {
              const elementStatus = response.rows[0].elements[0].status;
              if (elementStatus === 'OK') {
                const distanceText = response.rows[0].elements[0].distance.text;
                const durationText = response.rows[0].elements[0].duration.text;
                setDistance(`${distanceText} (approx. ${durationText} drive)`);
              } else if (elementStatus === 'ZERO_RESULTS') {
                setDistance("No route found - addresses may be too far apart");
              } else {
                setDistance(`Cannot calculate distance: ${elementStatus}`);
                console.error("Distance calculation status:", elementStatus);
              }
            } else {
              setDistance("Distance calculation failed");
              console.error("Distance Matrix error:", status);
            }
            setDistanceLoading(false);
          }
        );
      }, 250); // Small delay to ensure Maps is ready
    } catch (error) {
      console.error("Error calculating distance:", error);
      setDistance("Error calculating distance");
      setDistanceLoading(false);
    }
  }, [matchedLawyer, userAddress, googleMapsReady]);

  // Extract loadData as a standalone function that can be called directly
  const loadData = useCallback(async () => {
    try {
      const storedMatch = localStorage.getItem('lawyerMatch');
      const formData = localStorage.getItem('lawyerFormData');
      
      console.log("Loading data from localStorage", {
        hasStoredMatch: !!storedMatch,
        hasFormData: !!formData
      });
      
      let userData = {
        address: address,
        additional_comments: additionalComments
      };
      
      // First load data from localStorage for immediate display
      if (storedMatch) {
        const matchData = JSON.parse(storedMatch);
        // Clean up lawyer address formatting
        if (matchData.address) {
          matchData.address = matchData.address.trim();
          console.log("Lawyer address:", matchData.address);
        }
        setMatchedLawyer(matchData);
        
        // Debug localStorage field_stats
        console.log("Field Stats from localStorage:", matchData.field_stats);
      }
      
      // Always make an API call to match-lawyer, regardless of localStorage
      console.log("Making API call to match-lawyer endpoint");
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found");
        setLoading(false);
        setViewState(ViewState.RESULTS);
        return;
      }
      
      // Get document summaries from localStorage
      const storedSummaries = localStorage.getItem('documentSummaries');
      const documentSummaries = storedSummaries ? JSON.parse(storedSummaries) : {};
      
      // Get uploaded documents from Supabase
      const { data: userDocs, error: userDocsError } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (userDocsError) {
        console.error('Error fetching user documents:', userDocsError.message);
        setLoading(false);
        setViewState(ViewState.RESULTS);
        return;
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
      
      // Use local API route to avoid CORS issues
      const apiUrl = '/api/match-lawyer';
      
      // Make API call to match lawyer
      console.log("Making API request to match lawyer");
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
          additional_info: userData
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response from match-lawyer API:", errorText);
        setLoading(false); 
        setViewState(ViewState.RESULTS);
        return;
      }
      
      const matchedLawyerData = await response.json();
      console.log("API response:", matchedLawyerData);
      
      // Add debugging for field_stats
      console.log("Field Stats from API:", matchedLawyerData.field_stats);
      
      // Check the full structure of the API response to see if field_stats exists anywhere
      console.log("API response keys:", Object.keys(matchedLawyerData));
      if (!matchedLawyerData.field_stats) {
        console.warn("field_stats not found in direct API response - checking for nested objects");
        for (const key in matchedLawyerData) {
          if (typeof matchedLawyerData[key] === 'object' && matchedLawyerData[key] !== null) {
            console.log(`Checking nested object "${key}" keys:`, Object.keys(matchedLawyerData[key]));
            if (matchedLawyerData[key].field_stats) {
              console.log(`Found field_stats in nested object "${key}":`, matchedLawyerData[key].field_stats);
            }
          }
        }
      }
      
      // Update the state with fresh data from API
      setMatchedLawyer(matchedLawyerData);
      
      // Store in localStorage for future use
      localStorage.setItem('lawyerMatch', JSON.stringify(matchedLawyerData));
      localStorage.setItem('lawyerFormData', JSON.stringify(userData));
      
      // If we already have Maps API ready, attempt to calculate distance
      if (window.google && window.google.maps && !mapsAttempted.current) {
        console.log("Maps API already loaded during data loading");
        setGoogleMapsReady(true);
        mapsAttempted.current = true;
      }
    } catch (e) {
      console.error("Error loading lawyer data:", e);
    } finally {
      setLoading(false);
      setViewState(ViewState.RESULTS);
    }
  }, [address, additionalComments]);

  // On initial mount, check if we have cached address data and prefill the form
  useEffect(() => {
    // Load form data from localStorage
    const formData = localStorage.getItem('lawyerFormData');
    if (formData) {
      const parsedFormData = JSON.parse(formData);
      if (parsedFormData.address) {
        setAddress(parsedFormData.address);
        
        if (parsedFormData.additional_comments) {
          setAdditionalComments(parsedFormData.additional_comments);
        }
      }
    }
  }, []);

  // Reset calculation flag when address changes
  useEffect(() => {
    calculationAttempted.current = false;
  }, [matchedLawyer, userAddress]);

  // Calculate distance when all conditions are met
  useEffect(() => {
    if (matchedLawyer?.address && userAddress && googleMapsReady) {
      console.log("All conditions met, calculating distance");
      
      // If we already have a distance from the API, use it
      if (matchedLawyer.distance) {
        console.log("Using distance from API response:", matchedLawyer.distance);
        setDistance(matchedLawyer.distance);
        return;
      }
      
      // Otherwise calculate it client-side
      const timer = setTimeout(() => {
        calculateDistance();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [matchedLawyer, userAddress, googleMapsReady, calculateDistance]);

  // Function to retry distance calculation if it failed
  const handleRetryCalculation = () => {
    if (matchedLawyer?.address && userAddress) {
      calculationAttempted.current = false;
      calculateDistance();
    }
  };

  // Function to go back
  const handleGoBack = () => {
    // Ideally, navigate back to document review or collection
    router.push('/document-review');
  };

  // Function to toggle description expansion
  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  // Add function to handle lawyer search form submission
  const handleLawyerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim()) {
      alert('Please enter your address');
      return;
    }
    
    setIsSearching(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // Get document summaries from localStorage
      const storedSummaries = localStorage.getItem('documentSummaries');
      const documentSummaries = storedSummaries ? JSON.parse(storedSummaries) : {};
      
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
      
      // API endpoint for lawyer matching
      const apiUrl = '/api/match-lawyer';
      
      console.log("Making API request to match lawyer from form submission");
      // Make API call to match lawyer
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
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response from match-lawyer API:", errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
      
      const matchedLawyerData = await response.json();
      console.log("API response from form submission:", matchedLawyerData);
      
      // Add debugging for field_stats
      console.log("Field Stats from form submission API:", matchedLawyerData.field_stats);
      
      // Save form data for future use
      localStorage.setItem('lawyerFormData', JSON.stringify({
        address: address,
        additional_comments: additionalComments
      }));
      
      // Store the matched lawyer data in localStorage
      localStorage.setItem('lawyerMatch', JSON.stringify(matchedLawyerData));
      
      // Set matched lawyer data
      setMatchedLawyer(matchedLawyerData);
      setUserAddress(address);
    } catch (error) {
      console.error('Error matching lawyer:', error);
      alert('Error finding a matching lawyer. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Add an effect to recalculate distance when userAddress or matchedLawyer is updated from API
  useEffect(() => {
    // Reset distance calculation flag when the data changes
    calculationAttempted.current = false;
    
    // Check if we have both pieces of data and Maps is ready
    if (matchedLawyer?.address && userAddress && googleMapsReady) {
      console.log("Data updated from API call, recalculating distance...");
      // Add a small delay to ensure Google Maps is fully initialized
      const timer = setTimeout(() => {
        calculateDistance();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [matchedLawyer, userAddress, googleMapsReady, calculateDistance]);

  // Add a new component to render the initial address entry screen
  const renderAddressEntryScreen = () => (
    <div className="card w-full overflow-hidden border-accent-400/20">
      <div className="p-6 md:p-8 flex flex-col items-center">
        <h2 className="text-xl font-semibold gradient-text mb-4">Welcome to O-1 Visa Expert Matching</h2>
        <p className="text-slate-300 text-sm mb-6 text-center">
          Let's find the perfect immigration attorney for your extraordinary ability visa. First, please enter your location.
        </p>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          if (address.trim()) {
            setUserAddress(address.trim());
            setViewState(ViewState.LOADING);
            
            // Save address in localStorage for future use
            localStorage.setItem('lawyerFormData', JSON.stringify({
              address: address.trim(),
              additional_comments: additionalComments
            }));
            
            // Proceed to load lawyer data
            loadData();
          } else {
            alert('Please enter your address');
          }
        }} className="w-full max-w-md space-y-4">
          <div className="form-group">
            <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-1">Your Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <input
                ref={addressInputRef}
                type="text"
                id="address"
                className="w-full pl-10 pr-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-primary-500/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/30 text-white"
                placeholder="Enter your full address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              Powered by Google Places autocomplete
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="additionalComments" className="block text-sm font-medium text-slate-300 mb-1">Additional Information</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 pt-2 pointer-events-none text-primary-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <textarea
                id="additionalComments"
                className="w-full pl-10 pr-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-primary-500/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/30 text-white"
                placeholder="Any specific requirements or preferences for your immigration lawyer"
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <button
            type="submit"
            className="gradient-button px-6 py-2.5 text-base w-full flex items-center justify-center"
            disabled={!googleMapsReady}
          >
            {!googleMapsReady ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading Maps...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Find My O-1 Visa Expert
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  // Add a component to render the search form (for updating info later)
  const renderLawyerSearchForm = () => (
    <div className="card w-full overflow-hidden border-accent-400/20">
      <div className="p-6 md:p-8 flex flex-col items-center">
        <h2 className="text-xl font-semibold gradient-text mb-4">Find Your Immigration Expert</h2>
        <p className="text-slate-300 text-sm mb-6 text-center">
          Enter your address and any additional information to help us match you with the best immigration lawyer for your O-1 visa case.
        </p>
        
        <form onSubmit={handleLawyerSearch} className="w-full max-w-md space-y-4">
          <div className="form-group">
            <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-1">Your Address</label>
            <input
              ref={addressInputRef}
              type="text"
              id="address"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-white"
              placeholder="Enter your address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="additionalComments" className="block text-sm font-medium text-slate-300 mb-1">Additional Information</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 pt-2 pointer-events-none text-primary-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <textarea
                id="additionalComments"
                className="w-full pl-10 pr-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-primary-500/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/30 text-white"
                placeholder="Any specific requirements or preferences for your immigration lawyer"
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <button
            type="submit"
            className="gradient-button px-6 py-2.5 text-base w-full"
            disabled={isSearching}
          >
            {isSearching ? 'Finding Your Match...' : 'Find My Immigration Lawyer'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div>
      <Head>
        {/* Use SharedStyles */}
        <style>{SharedStyles}</style>
        <title>O-1 Visa Expert Match - Prometheus</title>
      </Head>

      {/* Use BackgroundEffects */}
      <BackgroundEffects />

      {/* Removed pt-16, using p-6 on content */}
      <div className="min-h-screen bg-transparent">
        <div className="relative z-10 min-h-screen p-6 md:p-8 flex flex-col items-center justify-center">
          <div className="max-w-2xl w-full space-y-8 flex flex-col items-center">
            <h1 className="text-3xl md:text-4xl font-bold gradient-text text-center mb-6">
              YOUR O-1 VISA EXPERT MATCH
            </h1>

            {viewState === ViewState.LOADING && (
              <div className="py-10 flex flex-col items-center">
                <div className="loading-spinner w-8 h-8 border-4 rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-400">Finding your O-1 visa specialist...</p>
              </div>
            )}

            {viewState === ViewState.ADDRESS_ENTRY && renderAddressEntryScreen()}
            
            {viewState === ViewState.RESULTS && !matchedLawyer && renderAddressEntryScreen()}
            
            {viewState === ViewState.RESULTS && matchedLawyer && (
              <div className="card w-full overflow-hidden border-accent-400/20">
                <div className="p-6 md:p-8 flex flex-col items-center">
                  <div className="flex flex-col items-center text-center mb-4 w-full">
                    <h2 className="text-2xl font-semibold gradient-text mb-2">{matchedLawyer.name}</h2>
                    <p className="text-slate-300 text-base mb-3">{matchedLawyer.firm}</p>
                    <div className="match-score-container bg-primary-500/10 border border-primary-500/20 py-3 px-5 rounded-xl">
                      <div className="match-score-value gradient-text text-3xl font-bold">
                        {Math.round(80 + (matchedLawyer.match_score * 20))}%
                        <span className="match-score-grade bg-primary-500/20 text-xs px-2 py-1 rounded-full ml-2 text-primary-400">
                          {calculateGrade(80 + (matchedLawyer.match_score * 20))}
                        </span>
                      </div>
                      <div className="match-score-label text-slate-400 text-sm mt-1">O-1 Visa Expertise Match</div>
                    </div>
                  </div>
                  
                  {/* Expertise tags */}
                  {matchedLawyer.expertise && (
                    <div className="flex flex-wrap justify-center gap-2 my-4">
                      {matchedLawyer.expertise.map((skill, index) => (
                        <span key={index} className="bg-accent-500/10 text-accent-400 text-xs px-2 py-1 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Add O-1 success rate indicator */}
                  {matchedLawyer.o1_success_rate && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 py-2 px-4 rounded-lg mb-4">
                      <div className="text-emerald-400 font-medium">
                        {matchedLawyer.o1_success_rate}% O-1 Visa Approval Rate
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3 border-t border-slate-700/50 pt-4 mt-4 text-sm text-slate-400 w-full text-center">
                    <p><strong className="tech-spec">LAW SCHOOL:</strong> {matchedLawyer.law_school || 'N/A'}</p>
                    <p><strong className="tech-spec">BAR ADMISSIONS:</strong> {matchedLawyer.bar_admissions || 'N/A'}</p>
                    
                    {/* Display address and distance */}
                    {matchedLawyer.address && (
                      <p><strong className="tech-spec">OFFICE LOCATION:</strong> {matchedLawyer.address}</p>
                    )}
                    
                    {userAddress && matchedLawyer.address && (
                      <div className="mt-2">
                        <strong className="tech-spec">DISTANCE FROM YOU:</strong> 
                        {distanceLoading ? (
                          <span className="ml-2 text-slate-500">Calculating...</span>
                        ) : distance ? (
                          <span className="ml-2 text-emerald-400">{distance}</span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <span className="ml-2 text-slate-500">Unable to calculate distance</span>
                            <button 
                              onClick={handleRetryCalculation}
                              className="text-xs text-accent-300 hover:text-accent-200 underline"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Profile Analysis with Expand/Collapse */}
                  {matchedLawyer.description && (
                    <div className="space-y-3 border-t border-slate-700/50 pt-4 mt-4 text-sm text-slate-400 w-full text-center">
                      <div>
                        <strong className="tech-spec">O-1 VISA EXPERTISE:</strong>
                        <p className="inline-block max-w-md mx-auto text-slate-300 text-sm mt-1">
                          {isExpanded ? matchedLawyer.description : getTruncatedText(matchedLawyer.description)}
                        </p>
                        <div className="mt-1">
                          <button
                            onClick={toggleExpansion}
                            className="text-accent-300 hover:text-accent-200 text-xs font-medium"
                          >
                            {isExpanded ? 'Show Less' : 'Read More'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Add Field Stats Display */}
                  {matchedLawyer.field_stats && (
                    <FieldStatsDisplay fieldStats={matchedLawyer.field_stats} />
                  )}
                  
                  <div className="mt-6 text-center w-full">
                    <button
                      className="gradient-button px-6 py-2.5 text-base mx-auto"
                      onClick={() => {
                        alert('Contact functionality is currently under development. This attorney specializes in O-1 visas for exceptional talent.');
                      }}
                    >
                      SCHEDULE CONSULTATION
                    </button>
                    
                    <button
                      className="text-sm text-accent-300 hover:text-accent-200 mt-4 block mx-auto"
                      onClick={() => setViewState(ViewState.ADDRESS_ENTRY)}
                    >
                      Update Your Location
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-center mt-6">
              <button 
                onClick={() => router.back()} 
                className="gradient-button text-sm"
              >
                <span>&larr; BACK</span>
              </button>
            </div>
            
            <div className="text-center text-sm text-slate-500 max-w-lg">
              <p>Our O-1 visa expert matching algorithm considers your field of extraordinary ability, achievements, and specific visa requirements to connect you with the most qualified immigration attorney.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Update the Script tag with the correct callback */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initializeGoogleMaps`}
        strategy="beforeInteractive"
      />
    </div>
  );
}