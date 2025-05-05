import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file and Vercel environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

/**
 * Supabase Schema
 * 
 * Tables:
 * 1. users - Created automatically by Supabase Auth
 *    - id (UUID, PK)
 *    - email
 *    - ... other Auth fields
 * 
 * 2. applications
 *    - id (UUID, PK)
 *    - user_id (UUID, FK to users.id)
 *    - status (enum: 'in_progress', 'submitted', 'approved', 'rejected')
 *    - score (integer)
 *    - summary (text)
 *    - document_count (integer)
 *    - created_at (timestamp)
 *    - last_updated (timestamp)
 * 
 * 3. application_documents
 *    - id (UUID, PK)
 *    - application_id (UUID, FK to applications.id)
 *    - doc_type (text)
 *    - filename (text)
 *    - file_path (text)
 *    - uploaded_at (timestamp)
 *    - storage_path (text)
 * 
 * 4. user_documents
 *    - id (UUID, PK)
 *    - user_id (UUID, FK to users.id)
 *    - application_id (UUID, FK to applications.id)
 *    - processing_status (text)
 *    - last_validated (timestamp)
 *    
 * Storage Buckets:
 * - documents/
 *   - {user_id}/applications/{application_id}/{doc_type}/{file_id}-{filename}
 */