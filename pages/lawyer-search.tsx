import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState, useCallback, useRef } from 'react';
import Script from 'next/script';
// Import SharedStyles and BackgroundEffects
import { SharedStyles, BackgroundEffects } from '../components/SharedStyles';

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
    google: typeof google;
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

export default function LawyerSearch() {
  const router = useRouter();
  const [matchedLawyer, setMatchedLawyer] = useState<LawyerMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<string | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const mapsAttempted = useRef(false);
  const calculationAttempted = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false); // State for description expansion
  
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
      delete window.initializeGoogleMaps;
    };
  }, [handleGoogleMapsLoaded]);

  // Check if Google Maps is already loaded
  useEffect(() => {
    if (window.google && window.google.maps && !googleMapsReady) {
      console.log("Google Maps already available, initializing");
      handleGoogleMapsLoaded();
    }
  }, [googleMapsReady, handleGoogleMapsLoaded]);

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

      const distanceService = new window.google.maps.DistanceMatrixService();
      
      // Wait a moment to ensure Google Maps is fully initialized
      setTimeout(() => {
        distanceService.getDistanceMatrix(
          {
            origins: [userAddress],
            destinations: [matchedLawyer.address],
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.IMPERIAL,
          },
          (response, status) => {
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

  // Load data from localStorage
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedMatch = localStorage.getItem('lawyerMatch');
        const formData = localStorage.getItem('lawyerFormData');
        
        console.log("Loading data from localStorage", {
          hasStoredMatch: !!storedMatch,
          hasFormData: !!formData
        });
        
        if (storedMatch) {
          const matchData = JSON.parse(storedMatch);
          // Clean up lawyer address formatting
          if (matchData.address) {
            matchData.address = matchData.address.trim();
            console.log("Lawyer address:", matchData.address);
          }
          setMatchedLawyer(matchData);
        }
        
        if (formData) {
          const parsedFormData = JSON.parse(formData);
          if (parsedFormData.address) {
            // Clean up user address formatting
            const cleanAddress = parsedFormData.address.trim();
            console.log("User address:", cleanAddress);
            setUserAddress(cleanAddress);
          }
        }
        
        // If we already have Maps API ready, attempt to calculate distance
        if (window.google && window.google.maps && !mapsAttempted.current) {
          console.log("Maps API already loaded during data loading");
          setGoogleMapsReady(true);
          mapsAttempted.current = true;
        }
      } catch (e) {
        console.error("Error parsing stored data:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Reset calculation flag when address changes
  useEffect(() => {
    calculationAttempted.current = false;
  }, [matchedLawyer, userAddress]);

  // Calculate distance when all conditions are met
  useEffect(() => {
    if (matchedLawyer?.address && userAddress && googleMapsReady) {
      console.log("All conditions met, calculating distance");
      // Add a small delay to ensure everything is ready
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

            {loading && (
              <div className="py-10 flex flex-col items-center">
                <div className="loading-spinner w-8 h-8 border-4 rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-400">Finding your O-1 visa specialist...</p>
              </div>
            )}

            {!loading && matchedLawyer ? (
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
                  <div className="mt-6 text-center w-full">
                    <button
                      className="gradient-button px-6 py-2.5 text-base mx-auto"
                      onClick={() => {
                        alert('Contact functionality is currently under development. This attorney specializes in O-1 visas for exceptional talent.');
                      }}
                    >
                      SCHEDULE CONSULTATION
                    </button>
                  </div>
                </div>
              </div>
            ) : !loading && (
              // Use card style for the 'not found' message
              <div className="card p-6 md:p-8 text-center w-full border-accent-400/20">
                <p className="text-slate-300 text-lg mb-4">NO O-1 EXPERT MATCH FOUND</p>
                <p className="text-slate-400 mb-6">We couldn't find a suitable O-1 visa expert based on your qualification profile.</p>
                <button onClick={handleGoBack} className="gradient-button text-sm mx-auto">
                  RETURN TO ANALYSIS
                </button>
              </div>
            )}
            {!loading && (
              <div className="text-center mt-6">
                <button 
                  onClick={() => router.back()} 
                  className="gradient-button text-sm"
                >
                  <span>&larr; BACK</span>
                </button>
              </div>
            )}
            
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