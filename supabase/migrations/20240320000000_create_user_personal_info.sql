-- Create user_personal_info table
CREATE TABLE IF NOT EXISTS public.user_personal_info (
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

-- Create trigger to automatically update last_updated
CREATE TRIGGER update_user_personal_info_last_updated
BEFORE UPDATE ON public.user_personal_info
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_column();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_personal_info_user_id ON public.user_personal_info(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_personal_info ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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