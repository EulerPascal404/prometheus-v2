#!/bin/bash

# Set up Vercel environment variables
echo "Setting up Vercel environment variables..."

# API URL
echo "Adding NEXT_PUBLIC_API_URL..."
vercel env add NEXT_PUBLIC_API_URL

# Supabase credentials
echo "Adding NEXT_PUBLIC_SUPABASE_URL..."
vercel env add NEXT_PUBLIC_SUPABASE_URL

echo "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Google Maps API Key
echo "Adding NEXT_PUBLIC_GOOGLE_MAPS_API_KEY..."
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

echo "Done setting up environment variables. Now deploying..."
vercel --prod 