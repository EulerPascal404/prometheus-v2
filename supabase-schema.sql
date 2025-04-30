-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security (RLS)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Applications Table
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'approved', 'rejected')) DEFAULT 'in_progress',
    score INTEGER DEFAULT 0,
    summary TEXT DEFAULT 'New application',
    document_count INTEGER DEFAULT 0,
    -- Add personal info fields
    personal_name TEXT,
    personal_phone TEXT,
    personal_address TEXT,
    personal_extra_info TEXT,
    -- Add document processing fields
    field_stats JSONB DEFAULT '{}',
    document_summaries JSONB DEFAULT '{}',
    processing_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Application Documents Table
CREATE TABLE public.application_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    doc_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    -- Removing redundant file_path field
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    storage_path TEXT NOT NULL,
    file_size INTEGER
);

-- User Documents Table (for processing status)
CREATE TABLE public.user_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    processing_status TEXT DEFAULT 'pending',
    completion_score INTEGER DEFAULT 0,
    last_validated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User Personal Information Table
CREATE TABLE public.user_personal_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT,
    phone TEXT,
    address TEXT,
    extra_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Create a function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_updated on applications
CREATE TRIGGER update_applications_last_updated
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_column();

-- Create trigger to automatically update last_updated on user_personal_info
CREATE TRIGGER update_user_personal_info_last_updated
BEFORE UPDATE ON public.user_personal_info
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_column();

-- Create trigger to update document_count when documents are added/removed
CREATE OR REPLACE FUNCTION update_document_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.applications
        SET document_count = document_count + 1
        WHERE id = NEW.application_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.applications
        SET document_count = document_count - 1
        WHERE id = OLD.application_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_application_document_count
AFTER INSERT OR DELETE ON public.application_documents
FOR EACH ROW
EXECUTE FUNCTION update_document_count();

-- Indexes for performance
CREATE INDEX idx_applications_user_id ON public.applications(user_id);
CREATE INDEX idx_application_documents_application_id ON public.application_documents(application_id);
CREATE INDEX idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX idx_user_documents_application_id ON public.user_documents(application_id);
CREATE INDEX idx_application_documents_doc_type ON public.application_documents(doc_type);

-- Row Level Security (RLS) Policies
-- Applications: Users can only see and modify their own applications
CREATE POLICY "Users can view their own applications"
    ON public.applications 
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications"
    ON public.applications 
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
    ON public.applications 
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications"
    ON public.applications 
    FOR DELETE
    USING (auth.uid() = user_id);

-- Application Documents: Users can only see and modify documents for their applications
CREATE POLICY "Users can view documents for their applications"
    ON public.application_documents 
    FOR SELECT
    USING (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert documents to their applications"
    ON public.application_documents 
    FOR INSERT
    WITH CHECK (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

CREATE POLICY "Users can update documents in their applications"
    ON public.application_documents 
    FOR UPDATE
    USING (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete documents from their applications"
    ON public.application_documents 
    FOR DELETE
    USING (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

-- User Documents: Users can only see and modify their own document processing entries
CREATE POLICY "Users can view their document processing status"
    ON public.user_documents 
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert processing status for their documents"
    ON public.user_documents 
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update processing status for their documents"
    ON public.user_documents 
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete processing status for their documents"
    ON public.user_documents 
    FOR DELETE
    USING (auth.uid() = user_id);

-- User Personal Information: Users can only see and modify their own personal information
CREATE POLICY "Users can view their own personal info"
    ON public.user_personal_info 
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personal info"
    ON public.user_personal_info 
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personal info"
    ON public.user_personal_info 
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal info"
    ON public.user_personal_info 
    FOR DELETE
    USING (auth.uid() = user_id);

-- Enable RLS on all tables
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_personal_info ENABLE ROW LEVEL SECURITY;

-- Storage configuration (run these in separate steps through the Supabase dashboard)
-- 1. Create a new bucket called 'documents' in the Storage section
-- 2. Set up the following storage policy:

-- Example storage policy for documents bucket - implement through dashboard
/*
-- For the storage bucket named 'documents' go to the Storage section in the dashboard
-- and create the following policies:

CREATE POLICY "Users can upload their own documents" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Extract user_id from path like '{user_id}/applications/{application_id}/'
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own documents" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  -- Extract user_id from path
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own documents" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own documents" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  (storage.foldername(name))[1] = auth.uid()::text
);
*/ 