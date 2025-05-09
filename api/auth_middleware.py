#!/usr/bin/env python3
"""
Authentication middleware for integrating Supabase JWT with FastAPI.

This module provides utilities to verify and decode Supabase JWT tokens,
and align the authentication flow with the custom JWT implementation
used in the main API.
"""

import os
import time
import json
import logging
from typing import Dict, Any, Optional, List
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get Supabase JWT secret key - this should match the JWT secret in your Supabase project
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
# Fallback to API secret key if Supabase JWT secret is not set
JWT_SECRET_KEY = os.getenv("SECRET_KEY", "a-very-secret-key-should-be-replaced-in-production")

security = HTTPBearer()

async def get_supabase_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verify and decode Supabase JWT token.
    Returns user information extracted from the token.
    """
    try:
        token = credentials.credentials
        
        # Try to decode with Supabase JWT secret first
        try:
            if SUPABASE_JWT_SECRET:
                # Decode Supabase JWT
                payload = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated"
                )
                
                # Extract user data
                user_id = payload.get("sub")
                # Custom user data is stored in the 'user_metadata' field
                user_metadata = payload.get("user_metadata", {})
                
                return {
                    "id": user_id,
                    "email": user_metadata.get("email"),
                    "full_name": user_metadata.get("full_name"),
                    "username": user_metadata.get("email"),
                    "disabled": False
                }
            else:
                raise ValueError("SUPABASE_JWT_SECRET not configured")
                
        except (JWTError, ValueError) as e:
            logger.warning(f"Could not verify Supabase token, trying regular JWT: {str(e)}")
            
            # Fallback to our custom JWT handling
            payload = jwt.decode(
                token,
                JWT_SECRET_KEY,
                algorithms=["HS256"]
            )
            
            username = payload.get("sub")
            if not username:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Return user data in the format expected by the API
            return {
                "id": username,
                "username": username,
                "email": f"{username}@example.com",  # Placeholder
                "full_name": username,
                "disabled": False
            }
            
    except JWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Utility function to extract token from standard Authorization header
def get_token_from_header(authorization: str) -> Optional[str]:
    """Extract token from Authorization header."""
    if not authorization:
        return None
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]

# Request middleware for FastAPI
async def auth_middleware(request: Request) -> None:
    """
    Middleware to check authentication for all endpoints.
    This is an alternative to using the Depends approach,
    useful for applying to specific routers or the entire app.
    """
    # Skip auth for public endpoints
    public_paths = ["/docs", "/redoc", "/openapi.json", "/", "/token"]
    for public_path in public_paths:
        if request.url.path.startswith(public_path):
            return None
    
    # Get token from header
    auth_header = request.headers.get("Authorization")
    token = get_token_from_header(auth_header)
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token (reuse logic from get_supabase_user)
    try:
        # Try Supabase JWT first
        if SUPABASE_JWT_SECRET:
            try:
                jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
                return None
            except JWTError:
                # Fallback to API JWT
                jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
                return None
        else:
            # Just try API JWT
            jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            return None
            
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) 