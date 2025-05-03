import { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

// Global variable to track if Google Maps is being loaded
let mapsLoading = false;
let mapsLoaded = false;

// Store loading promise globally
let loadPromise: Promise<void> | null = null;

// Add to window object for global access
declare global {
  interface Window {
    initializeGoogleMaps?: () => void;
    googleMapsLoaded?: boolean;
    googleMapsError?: Error;
    loadGoogleMaps?: () => Promise<void>;
    googleMapsReadyCallback?: (callback: () => void) => void;
    _googleMapsCallbacks?: Array<() => void>;
  }
}

function MyApp({ Component, pageProps }: AppProps) {
  const [mapsInitialized, setMapsInitialized] = useState(false);

  // Initialize Google Maps globally - this runs before any components mount
  useEffect(() => {
    // Setup callbacks system
    window._googleMapsCallbacks = window._googleMapsCallbacks || [];
    window.googleMapsReadyCallback = (callback) => {
      if (window.googleMapsLoaded && window.google?.maps?.places) {
        // If Maps is already ready, call immediately
        callback();
      } else {
        // Otherwise queue for when it's ready
        window._googleMapsCallbacks = window._googleMapsCallbacks || [];
        window._googleMapsCallbacks.push(callback);
      }
    };

    // Define verification function that checks if Places API is actually ready
    const verifyPlacesApiReady = () => {
      // Check if Maps and Places APIs are fully loaded
      if (window.google?.maps?.places) {
        console.log("Places API verified as available");
        mapsLoaded = true;
        mapsLoading = false;
        window.googleMapsLoaded = true;

        // Execute any queued callbacks
        if (window._googleMapsCallbacks && window._googleMapsCallbacks.length > 0) {
          console.log(`Executing ${window._googleMapsCallbacks.length} queued callbacks`);
          window._googleMapsCallbacks.forEach(callback => {
            try {
              callback();
            } catch (e) {
              console.error("Error in Maps callback:", e);
            }
          });
          window._googleMapsCallbacks = [];
        }
        
        return true;
      }
      return false;
    };

    // Define global loading function
    const createLoadFunction = () => {
      window.loadGoogleMaps = async () => {
        // Return existing promise if already loading
        if (loadPromise) {
          return loadPromise;
        }
        
        // If already loaded and verified, return resolved promise
        if (mapsLoaded && verifyPlacesApiReady()) {
          return Promise.resolve();
        }
        
        // Prevent multiple loads
        if (mapsLoading) {
          // Create a new promise that waits for loading to complete
          return new Promise<void>((resolve) => {
            // Safe access to googleMapsReadyCallback
            if (window.googleMapsReadyCallback) {
              window.googleMapsReadyCallback(() => resolve());
            } else {
              // Fallback if callback mechanism isn't ready
              const checkInterval = setInterval(() => {
                if (window.google?.maps?.places) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 300);
              // Prevent memory leaks
              setTimeout(() => clearInterval(checkInterval), 10000);
            }
          });
        }
        
        mapsLoading = true;
        
        // Create the loading promise
        loadPromise = new Promise<void>((resolve, reject) => {
          try {
            // Don't add script if it already exists
            const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
            if (existingScript) {
              console.log("Google Maps script already exists in document");
              
              // Check if Places API is actually loaded
              if (verifyPlacesApiReady()) {
                resolve();
                return;
              }
              
              // Places API isn't ready yet, wait for it
              console.log("Script exists but Places API not ready, waiting...");
              
              // Try to wait for Places API to load
              let attempts = 0;
              const checkPlacesInterval = setInterval(() => {
                attempts++;
                if (verifyPlacesApiReady()) {
                  clearInterval(checkPlacesInterval);
                  resolve();
                } else if (attempts > 20) { // 10 seconds max wait
                  clearInterval(checkPlacesInterval);
                  console.error("Places API failed to load after 10s");
                  // Remove the script and try again
                  if (existingScript.parentNode) {
                    existingScript.parentNode.removeChild(existingScript);
                  }
                  // Reset loading state
                  mapsLoading = false;
                  loadPromise = null;
                  
                  // Try loadGoogleMaps again, but safely
                  const currentLoader = window.loadGoogleMaps;
                  if (currentLoader) {
                    currentLoader().then(resolve).catch(reject);
                  } else {
                    reject(new Error("Google Maps loader not available"));
                  }
                }
              }, 500);
              
              return;
            }
            
            // Define callback
            window.initializeGoogleMaps = () => {
              console.log("Google Maps initialized globally");
              
              // Check that Places is available
              setTimeout(() => {
                if (verifyPlacesApiReady()) {
                  resolve();
                } else {
                  console.warn("Maps loaded but Places API not available after callback");
                  // Wait a bit longer
                  let attempts = 0;
                  const checkPlacesInterval = setInterval(() => {
                    attempts++;
                    if (verifyPlacesApiReady()) {
                      clearInterval(checkPlacesInterval);
                      resolve();
                    } else if (attempts > 10) {
                      clearInterval(checkPlacesInterval);
                      console.error("Places API failed to load after Maps init");
                      reject(new Error("Places API not available after Maps initialization"));
                    }
                  }, 500);
                }
              }, 300);
            };
            
            // Get API key
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            console.log("Loading Google Maps with API key:", apiKey ? "Key available" : "No API key found");
            
            if (!apiKey) {
              console.error("No Google Maps API key found in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
              reject(new Error("No Google Maps API key provided"));
              return;
            }
            
            // Load script
            const script = document.createElement('script');
            const cacheBuster = new Date().getTime();
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initializeGoogleMaps&v=weekly&_=${cacheBuster}`;
            script.async = true;
            script.defer = true;
            script.onerror = (err) => {
              console.error("Error loading Google Maps:", err);
              mapsLoading = false;
              loadPromise = null;
              // Create a proper Error object
              const errorMessage = typeof err === 'string' ? err : 'Failed to load Google Maps API';
              window.googleMapsError = new Error(errorMessage);
              reject(window.googleMapsError);
            };
            
            document.head.appendChild(script);
            console.log("Google Maps script added to document");
          } catch (error) {
            console.error("Error in loadGoogleMaps:", error);
            mapsLoading = false;
            loadPromise = null;
            window.googleMapsError = error as Error;
            reject(error);
          }
        });
        
        // Clean up promise reference when done
        loadPromise.then(() => {
          setMapsInitialized(true);
        }).catch(() => {
          loadPromise = null;
        });
        
        return loadPromise;
      };
    };
    
    // Create the load function
    createLoadFunction();
    
    // Initial load - but wait for next tick to ensure window.loadGoogleMaps is available
    setTimeout(() => {
      if (window.loadGoogleMaps) {
        window.loadGoogleMaps().catch(err => {
          console.error("Failed to load Google Maps on initial load:", err);
        });
      }
    }, 0);
    
    return () => {
      // Preserve the global functions between page navigations
    };
  }, []);
  
  return <Component {...pageProps} />;
}

export default MyApp; 