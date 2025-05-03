import { useEffect } from 'react';
import Head from 'next/head';

export default function DirectMapsTest() {
  // Set API key in window when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <Head>
        <title>Direct Google Maps Test</title>
        <meta 
          name="google-maps-key" 
          content={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} 
        />
        <script src="/direct-maps.js" />
      </Head>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Direct Google Maps Test</h1>
        
        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Simple Autocomplete</h2>
          <p className="text-slate-300 mb-4">
            This test page uses a direct script approach to load Google Maps and implement
            autocomplete functionality without any React/Next.js abstractions.
          </p>
          
          <div id="maps-direct-container" className="mt-4 mb-4">
            {/* The direct-maps.js script will insert the input and results here */}
          </div>
          
          <div className="mt-6 text-sm text-slate-400">
            <p>
              If autocomplete is working, you should see suggestions when you type in the input field above.
              If not, check the browser console for errors.
            </p>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debugging Information</h2>
          
          <div className="space-y-2">
            <div>
              <span className="text-slate-400">API Key available: </span>
              <span className="text-green-400">
                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Yes' : 'No'}
              </span>
            </div>
            
            <div>
              <span className="text-slate-400">API Key begins with: </span>
              <span className="text-primary-400">
                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 
                  ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.substring(0, 5) + '...' 
                  : 'N/A'}
              </span>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="font-medium text-lg mb-2">Troubleshooting</h3>
            <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
              <li>Make sure your NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your .env file</li>
              <li>Verify the API key has Maps JavaScript API and Places API enabled</li>
              <li>Check browser console for any error messages</li>
              <li>Try clearing your browser cache or using incognito mode</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 