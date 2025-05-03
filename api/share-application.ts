import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../config/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { applicationId } = req.query;

  if (!applicationId) {
    return res.status(400).json({ error: 'Application ID is required' });
  }

  try {
    // Fetch the application data
    const { data: application, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error) throw error;
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Format the data for the certificate view
    const formattedApplication = {
      id: application.id,
      name: application.name || 'Untitled Application',
      score: application.score || 0,
      status: application.status || 'in_progress',
      summary: application.summary || 'No summary available',
      document_count: application.document_count || 0,
      last_updated: application.last_updated || new Date().toISOString()
    };

    // Return the formatted application data
    return res.status(200).json(formattedApplication);
  } catch (error) {
    console.error('Error fetching application:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 