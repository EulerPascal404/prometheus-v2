import { createClient } from '@supabase/supabase-js';
import { Configuration, OpenAIApi } from 'openai';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Helper function to process PDF content
async function processPdfContent(docType, userId) {
  try {
    console.log(`[processPdfContent] Starting processing for ${docType} for user ${userId}`);
    
    // Update status to processing
    const { error: updateError } = await supabase
      .from('user_documents')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (updateError) {
      console.error(`[processPdfContent] Error updating status:`, updateError);
      throw updateError;
    }
    
    // Log the start of processing
    const { error: logError } = await supabase
      .from('processing_logs')
      .insert({
        user_id: userId,
        document_type: docType,
        status: 'processing',
        message: `Starting processing for ${docType}`,
        created_at: new Date().toISOString()
      });
    
    if (logError) {
      console.error(`[processPdfContent] Error logging:`, logError);
    }
    
    // Simulate processing time (in a real implementation, this would be actual processing)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate a summary using OpenAI
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert in analyzing O-1 visa applications. Provide a concise summary of the document's strengths and weaknesses for O-1 visa qualification."
        },
        {
          role: "user",
          content: `Analyze this ${docType} document for O-1 visa qualification. Identify strengths, weaknesses, and recommendations.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    
    const summary = completion.data.choices[0].message.content;
    
    // Log completion
    await supabase
      .from('processing_logs')
      .insert({
        user_id: userId,
        document_type: docType,
        status: 'completed',
        message: `Completed processing for ${docType}`,
        created_at: new Date().toISOString()
      });
    
    // Update status to completed
    const { error: completeError } = await supabase
      .from('user_documents')
      .update({ 
        status: 'completed',
        summary: summary,
        completion_score: 100,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (completeError) {
      console.error(`[processPdfContent] Error updating completion status:`, completeError);
      throw completeError;
    }
    
    return { success: true, summary };
  } catch (error) {
    console.error(`[processPdfContent] Error processing ${docType}:`, error);
    
    // Update status to error
    await supabase
      .from('user_documents')
      .update({ 
        status: 'error',
        error_message: error.message || 'Unknown error occurred',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    // Log the error
    await supabase
      .from('processing_logs')
      .insert({
        user_id: userId,
        document_type: docType,
        status: 'error',
        message: `Error processing ${docType}: ${error.message || 'Unknown error'}`,
        created_at: new Date().toISOString()
      });
    
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export default async function handler(req, res) {
  // Handle different HTTP methods
  if (req.method === 'POST') {
    try {
      console.log('[POST /api/process-documents] Request received');
      
      const { userInfo, userId } = req.body;
      
      if (!userId) {
        console.error('[POST /api/process-documents] Missing userId');
        return res.status(400).json({ error: 'Missing userId parameter' });
      }
      
      if (!userInfo || Object.keys(userInfo).length === 0) {
        console.error('[POST /api/process-documents] Missing or empty userInfo');
        return res.status(400).json({ error: 'Missing or empty userInfo parameter' });
      }
      
      console.log(`[POST /api/process-documents] Processing documents for user: ${userId}`);
      console.log(`[POST /api/process-documents] User info:`, userInfo);
      
      // Create or update user document record
      const { error: upsertError } = await supabase
        .from('user_documents')
        .upsert({
          user_id: userId,
          ...userInfo,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (upsertError) {
        console.error('[POST /api/process-documents] Error upserting user document:', upsertError);
        return res.status(500).json({ error: 'Failed to create user document record' });
      }
      
      // Start processing each document type
      const processingPromises = Object.keys(userInfo).map(docType => 
        processPdfContent(docType, userId)
      );
      
      // Wait for all processing to complete
      const results = await Promise.all(processingPromises);
      
      // Check if any processing failed
      const failures = results.filter(result => !result.success);
      
      if (failures.length > 0) {
        console.warn(`[POST /api/process-documents] ${failures.length} document types failed processing`);
      }
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Document processing initiated',
        results
      });
      
    } catch (error) {
      console.error('[POST /api/process-documents] Error:', error);
      return res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message || 'An unexpected error occurred'
      });
    }
  } 
  else if (req.method === 'GET') {
    try {
      console.log('[GET /api/process-documents] Request received');
      
      const { userId } = req.query;
      
      if (!userId) {
        console.error('[GET /api/process-documents] Missing userId');
        return res.status(400).json({ error: 'Missing userId parameter' });
      }
      
      console.log(`[GET /api/process-documents] Fetching documents for user: ${userId}`);
      
      // Fetch user document record
      const { data: userDoc, error: fetchError } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (fetchError) {
        console.error('[GET /api/process-documents] Error fetching user document:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch user document record' });
      }
      
      if (!userDoc) {
        console.error('[GET /api/process-documents] No document record found for user');
        return res.status(404).json({ error: 'No document record found for user' });
      }
      
      // Fetch processing logs
      const { data: logs, error: logsError } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (logsError) {
        console.error('[GET /api/process-documents] Error fetching logs:', logsError);
      }
      
      // Return user document and logs
      return res.status(200).json({
        success: true,
        userDocument: userDoc,
        logs: logs || []
      });
      
    } catch (error) {
      console.error('[GET /api/process-documents] Error:', error);
      return res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message || 'An unexpected error occurred'
      });
    }
  }
  else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 