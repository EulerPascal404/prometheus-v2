import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Log the request body for debugging
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Determine the backend URL based on environment
    let backendUrl;
    if (process.env.NODE_ENV === 'development') {
      backendUrl = 'http://localhost:8000';
    } else {
      backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.getprometheus.ai';
    }
    
    const apiUrl = `${backendUrl}/api/validate-documents`;
    
    console.log(`Forwarding request to: ${apiUrl}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Backend URL: ${backendUrl}`);
    
    // Create headers object without the host header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Copy authorization header if it exists
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization as string;
    }
    
    // Make the request to the backend
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    console.log(`Backend response status: ${response.status}`);
    
    // Get the response data
    const data = await response.json();
    console.log(`Backend response data:`, data);
    
    // Return the same status code and data
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error in validate-documents API route:', error);
    // Return more detailed error information
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
} 