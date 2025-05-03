// This script directly loads Google Maps API and implements autocomplete
// It can be included in a page with a simple script tag
(function() {
  console.log('Direct Maps Script Loaded');
  
  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded, initializing maps loader');
    
    // Check if there's a container for the autocomplete input
    const container = document.getElementById('maps-direct-container');
    if (!container) {
      console.error('No container found with id "maps-direct-container"');
      return;
    }
    
    // Create input field and results div
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'Enter an address...');
    input.className = 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white mb-2';
    
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'mt-2 text-sm';
    
    const statusDiv = document.createElement('div');
    statusDiv.className = 'text-xs text-slate-400 mt-2';
    statusDiv.textContent = 'Loading Google Maps...';
    
    // Add to container
    container.appendChild(input);
    container.appendChild(resultsDiv);
    container.appendChild(statusDiv);
    
    // Load Google Maps API
    let mapScript = document.createElement('script');
    mapScript.setAttribute('async', '');
    mapScript.setAttribute('defer', '');
    
    // Get API key from meta tag or window variable
    let apiKey = '';
    const metaTag = document.querySelector('meta[name="google-maps-key"]');
    if (metaTag) {
      apiKey = metaTag.getAttribute('content');
    } else if (window.GOOGLE_MAPS_API_KEY) {
      apiKey = window.GOOGLE_MAPS_API_KEY;
    }
    
    if (!apiKey) {
      statusDiv.textContent = 'Error: No Google Maps API key found';
      statusDiv.className = 'text-xs text-red-400 mt-2';
      return;
    }
    
    // Set global callback
    window.initDirectMaps = function() {
      console.log('Google Maps initialized via direct script');
      statusDiv.textContent = 'Google Maps loaded successfully';
      statusDiv.className = 'text-xs text-green-400 mt-2';
      
      // Check if Places API is available
      if (!google.maps.places) {
        statusDiv.textContent = 'Error: Google Maps Places API not available';
        statusDiv.className = 'text-xs text-red-400 mt-2';
        return;
      }
      
      // Initialize autocomplete
      try {
        const autocomplete = new google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry', 'name'],
          types: ['address']
        });
        
        // Add event listener
        autocomplete.addListener('place_changed', function() {
          const place = autocomplete.getPlace();
          if (place && place.formatted_address) {
            resultsDiv.textContent = 'Selected: ' + place.formatted_address;
            resultsDiv.className = 'mt-2 text-sm text-green-400';
          } else {
            resultsDiv.textContent = 'No place selected';
            resultsDiv.className = 'mt-2 text-sm text-red-400';
          }
        });
        
        console.log('Autocomplete initialized successfully');
      } catch (err) {
        console.error('Error initializing autocomplete:', err);
        statusDiv.textContent = 'Error initializing autocomplete: ' + err.message;
        statusDiv.className = 'text-xs text-red-400 mt-2';
      }
    };
    
    // Set script source with API key and callback
    mapScript.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initDirectMaps`;
    
    // Handle script errors
    mapScript.onerror = function() {
      statusDiv.textContent = 'Error loading Google Maps API';
      statusDiv.className = 'text-xs text-red-400 mt-2';
    };
    
    // Add script to document
    document.head.appendChild(mapScript);
  });
})(); 