#!/bin/bash
# Script to set up secure environment variables for production deployment

# Check if running in production environment
if [ "$NODE_ENV" != "production" ]; then
  echo "Warning: This script is intended for production environments."
  echo "Current environment: $NODE_ENV"
  read -p "Do you want to continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Generate a secure secret key for JWT tokens
generate_secret() {
  openssl rand -base64 32
}

# Default deployment platform (vercel, netlify, etc.)
PLATFORM=${1:-vercel}
echo "Setting up environment variables for $PLATFORM deployment..."

# Generate secure secret key for JWT
JWT_SECRET=$(generate_secret)
echo "Generated new JWT secret key"

# Generate secure secret key for Supabase JWT verification
SUPABASE_JWT_SECRET=$(generate_secret)
echo "Generated new Supabase JWT secret key"

# Set environment variables based on platform
case $PLATFORM in
  vercel)
    # Vercel CLI must be installed and authenticated
    echo "Setting Vercel environment variables..."
    vercel env add SECRET_KEY production "$JWT_SECRET"
    vercel env add SUPABASE_JWT_SECRET production "$SUPABASE_JWT_SECRET"
    
    # Prompt for Supabase configuration
    read -p "Enter your Supabase URL: " SUPABASE_URL
    read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
    
    vercel env add NEXT_PUBLIC_SUPABASE_URL production "$SUPABASE_URL"
    vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production "$SUPABASE_ANON_KEY"
    
    # Set other Vercel environment variables
    read -p "Enter your production site URL: " SITE_URL
    vercel env add NEXT_PUBLIC_SITE_URL production "$SITE_URL"
    
    echo "Vercel environment variables have been set."
    echo "Run 'vercel env ls' to view your environment variables."
    ;;
    
  netlify)
    # Netlify CLI must be installed and authenticated
    echo "Setting Netlify environment variables..."
    netlify env:set SECRET_KEY "$JWT_SECRET" --scope production
    netlify env:set SUPABASE_JWT_SECRET "$SUPABASE_JWT_SECRET" --scope production
    
    # Prompt for Supabase configuration
    read -p "Enter your Supabase URL: " SUPABASE_URL
    read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
    
    netlify env:set NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL" --scope production
    netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY" --scope production
    
    # Set other Netlify environment variables
    read -p "Enter your production site URL: " SITE_URL
    netlify env:set NEXT_PUBLIC_SITE_URL "$SITE_URL" --scope production
    
    echo "Netlify environment variables have been set."
    echo "Run 'netlify env:list' to view your environment variables."
    ;;
    
  local)
    # For local development - create .env.local file
    echo "Creating .env.local file with secure environment variables..."
    
    cat > .env.local << EOL
# Security keys - KEEP THESE SECRET
SECRET_KEY=${JWT_SECRET}
SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}

# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Site configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# API settings
API_BASE_URL=http://localhost:8000

# For development
NODE_ENV=development
VERCEL_ENV=development
EOL

    echo ".env.local file created."
    echo "Please manually fill in your Supabase credentials in .env.local"
    ;;
    
  *)
    echo "Unsupported platform: $PLATFORM"
    echo "Supported platforms: vercel, netlify, local"
    exit 1
    ;;
esac

echo "Environment setup complete!"
echo "IMPORTANT: Make sure to securely store these keys and never commit them to version control." 