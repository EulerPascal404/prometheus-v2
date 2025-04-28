-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create application_metadata table
CREATE TABLE public.application_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    document_summaries JSONB DEFAULT '{}',
    field_stats JSONB DEFAULT '{}',
    api_response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_application_metadata_application_id ON public.application_metadata(application_id);

-- Row Level Security (RLS) Policies
CREATE POLICY "Users can view metadata for their applications"
    ON public.application_metadata 
    FOR SELECT
    USING (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert metadata for their applications"
    ON public.application_metadata 
    FOR INSERT
    WITH CHECK (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

CREATE POLICY "Users can update metadata for their applications"
    ON public.application_metadata 
    FOR UPDATE
    USING (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete metadata for their applications"
    ON public.application_metadata 
    FOR DELETE
    USING (application_id IN (SELECT id FROM public.applications WHERE user_id = auth.uid()));

-- Enable RLS on the new table
ALTER TABLE public.application_metadata ENABLE ROW LEVEL SECURITY; 