import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function MapsTest() {
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean>(false);
  const [googleLoaded, setGoogleLoaded] = useState<boolean>(false);
  const [placesLoaded, setPlacesLoaded] = useState<boolean>(false);
  const [address, setAddress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  };

  // Check if API key is available
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      setApiKeyAvailable(true);
      addLog(`API key available: ${apiKey.substring(0, 5)}...`);
    } else {
      setApiKeyAvailable(false);
      setError('Google Maps API key not found. Make sure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your .env file');
      addLog('API key not found');
    }
  }, []);

  // Load Google Maps
  useEffect(() => {
    if (!apiKeyAvailable) return;

    // Load script directly
    const loadGoogleMapsScript = () => {
      try {
        addLog('Loading Google Maps script...');
        // Check if script already exists
        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
          addLog('Google Maps script already exists');
          // Check if Google is defined
          if (window.google && window.google.maps) {
            addLog('Google Maps already loaded');
            setGoogleLoaded(true);
            if (window.google.maps.places) {
              addLog('Places API loaded');
              setPlacesLoaded(true);
            } else {
              addLog('Places API not available');
            }
            return;
          }
        }

        const script = document.createElement('script');
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
        script.async = true;
        script.defer = true;

        // Define callback
        window.initMap = () => {
          addLog('Google Maps initialized');
          setGoogleLoaded(true);
          if (window.google.maps.places) {
            addLog('Places API loaded');
            setPlacesLoaded(true);
          } else {
            addLog('Places API not available');
          }
        };

        // Handle error
        script.onerror = () => {
          addLog('Error loading Google Maps script');
          setError('Failed to load Google Maps API script');
        };

        document.head.appendChild(script);
        addLog('Added script to document head');
      } catch (err) {
        addLog(`Error in script loading: ${err instanceof Error ? err.message : String(err)}`);
        setError(`Error loading script: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    // If window.loadGoogleMaps is available, use it
    if (typeof window !== 'undefined' && window.loadGoogleMaps) {
      addLog('Using global loadGoogleMaps');
      window.loadGoogleMaps()
        .then(() => {
          addLog('Maps loaded via global loader');
          setGoogleLoaded(true);
          if (window.google?.maps?.places) {
            addLog('Places API loaded');
            setPlacesLoaded(true);
          } else {
            addLog('Places API not available after global load');
          }
        })
        .catch(err => {
          addLog(`Error with global loader: ${err instanceof Error ? err.message : String(err)}`);
          setError(`Global loader error: ${err instanceof Error ? err.message : String(err)}`);
          // Fall back to direct loading
          loadGoogleMapsScript();
        });
    } else {
      addLog('No global loader available, loading directly');
      loadGoogleMapsScript();
    }

    // Clean up 
    return () => {
      if (window.initMap) {
        // @ts-ignore
        delete window.initMap;
      }
    };
  }, [apiKeyAvailable]);

  // Initialize autocomplete when Places API is loaded
  useEffect(() => {
    if (!placesLoaded || !inputRef.current) {
      return;
    }

    try {
      addLog('Initializing autocomplete...');
      // Clean up any existing instances
      if (autocompleteRef.current) {
        addLog('Cleaning up existing autocomplete');
        // No clean method, just create a new one
      }

      addLog('Creating new Autocomplete instance');
      const options = {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'name'],
        types: ['address']
      };

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        options
      );

      addLog('Adding place_changed listener');
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place && place.formatted_address) {
          addLog(`Place selected: ${place.formatted_address}`);
          setAddress(place.formatted_address);
        } else {
          addLog('No address found in place object');
        }
      });

      addLog('Autocomplete initialized successfully');
    } catch (err) {
      addLog(`Error initializing autocomplete: ${err instanceof Error ? err.message : String(err)}`);
      setError(`Autocomplete initialization error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [placesLoaded]);

  // Try direct initialization
  const handleInitializeDirectly = () => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      addLog('Google Maps Places API not available for direct initialization');
      setError('Google Maps Places API not available');
      return;
    }

    if (!inputRef.current) {
      addLog('Input reference not available');
      return;
    }

    try {
      addLog('Manually initializing autocomplete...');
      const options = {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'name'],
        types: ['address']
      };

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        options
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place && place.formatted_address) {
          addLog(`Place selected: ${place.formatted_address}`);
          setAddress(place.formatted_address);
        }
      });

      addLog('Manual initialization complete');
    } catch (err) {
      addLog(`Manual initialization error: ${err instanceof Error ? err.message : String(err)}`);
      setError(`Manual initialization error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <Head>
        <title>Google Maps Test</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Google Maps Autocomplete Test</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatusItem 
              label="API Key" 
              status={apiKeyAvailable ? 'available' : 'missing'} 
            />
            <StatusItem 
              label="Google Maps" 
              status={googleLoaded ? 'loaded' : 'not loaded'} 
            />
            <StatusItem 
              label="Places API" 
              status={placesLoaded ? 'loaded' : 'not loaded'} 
            />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Autocomplete Test</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-2">
                Enter an address
              </label>
              <input
                ref={inputRef}
                type="text"
                id="address"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                placeholder="Start typing an address..."
              />
            </div>

            {address && (
              <div className="bg-green-500/20 border border-green-500 text-green-300 p-4 rounded-lg">
                <p><strong>Selected address:</strong> {address}</p>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={handleInitializeDirectly}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Initialize Manually
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-black rounded p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-slate-500">No logs yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="pb-1">
                  <span className="text-green-400">&gt;</span> <span className="text-slate-300">{log}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
interface StatusItemProps {
  label: string;
  status: 'available' | 'missing' | 'loaded' | 'not loaded' | 'error';
}

function StatusItem({ label, status }: StatusItemProps) {
  let statusColor = '';
  let statusText = status;

  switch (status) {
    case 'available':
    case 'loaded':
      statusColor = 'text-green-400';
      break;
    case 'missing':
    case 'not loaded':
      statusColor = 'text-red-400';
      break;
    case 'error':
      statusColor = 'text-yellow-400';
      break;
  }

  return (
    <div className="bg-slate-900 p-3 rounded">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-lg font-medium ${statusColor}`}>
        {statusText.charAt(0).toUpperCase() + statusText.slice(1)}
      </p>
    </div>
  );
}

// Add this to the global window object for TypeScript
declare global {
  interface Window {
    google: any;
    initMap: () => void;
    loadGoogleMaps?: () => Promise<void>;
  }
} 