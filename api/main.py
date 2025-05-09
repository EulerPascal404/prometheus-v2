#!/usr/bin/env python3
"""
Main API module for O-1 Visa Application Automation System.

This module defines the FastAPI application that serves as the backend for
the document automation system. It provides RESTful endpoints for document
processing, user management, and system administration.
"""

import os
import sys
import json
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import ML modules
from ml.document_automation import (
    FormFillingInterface,
    DocumentTemplate,
    verify_model_and_templates
)

# Import authentication middleware
from api.auth_middleware import get_supabase_user, auth_middleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="O-1 Visa Document Automation API",
    description="API for automating O-1 visa application document creation and processing",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add auth middleware to the app
@app.middleware("http")
async def auth_middleware_wrapper(request: Request, call_next):
    # Public paths that don't need authentication
    public_paths = ["/", "/token", "/docs", "/redoc", "/openapi.json"]
    if any(request.url.path.startswith(path) for path in public_paths):
        return await call_next(request)
    
    try:
        await auth_middleware(request)
        return await call_next(request)
    except HTTPException as exc:
        # Properly formatted JSON response for auth errors
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers
        )

# Security configurations
SECRET_KEY = os.getenv("SECRET_KEY", "a-very-secret-key-should-be-replaced-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Root directory for data
ROOT_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = ROOT_DIR / "data" / "uploads"
OUTPUT_DIR = ROOT_DIR / "data" / "output"
MODEL_DIR = ROOT_DIR / "data" / "models"
TEMPLATE_DIR = ROOT_DIR / "data" / "templates"

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)

# Create global form filling interface
form_interface = None

# Models
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None


class UserInDB(User):
    hashed_password: str


class FormField(BaseModel):
    name: str
    value: Any


class DocumentRequest(BaseModel):
    template_name: str
    field_values: Dict[str, Any] = {}
    autopredict: bool = True


class DocumentResponse(BaseModel):
    document_id: str
    template_name: str
    output_path: str
    created_at: datetime
    status: str


# Dummy user database - replace with real DB in production
fake_users_db = {
    "johndoe": {
        "username": "johndoe",
        "full_name": "John Doe",
        "email": "johndoe@example.com",
        "hashed_password": pwd_context.hash("secret"),
        "disabled": False,
    }
}


# Authentication functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)
    return None


def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_form_interface():
    """Get or initialize the form filling interface."""
    global form_interface
    
    if form_interface is None:
        # Initialize form interface
        try:
            form_interface = FormFillingInterface(
                model_dir=MODEL_DIR,
                template_dir=TEMPLATE_DIR,
                output_dir=OUTPUT_DIR
            )
            
            # Verify that models and templates are available
            verify_model_and_templates(form_interface)
            
            logger.info("Form interface initialized successfully.")
        except Exception as e:
            logger.error(f"Error initializing form interface: {str(e)}")
            raise
    
    return form_interface


@app.get("/")
async def root():
    """Root endpoint returning API info."""
    return {
        "message": "O-1 Visa Document Automation API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }


@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and issue access token."""
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users/me", response_model=User)
async def read_users_me(user_info: Dict[str, Any] = Depends(get_supabase_user)):
    """Get current user information."""
    return User(
        username=user_info["username"],
        email=user_info["email"],
        full_name=user_info["full_name"],
        disabled=user_info["disabled"]
    )


@app.get("/templates")
async def get_templates(user_info: Dict[str, Any] = Depends(get_supabase_user)):
    """List available document templates."""
    interface = get_form_interface()
    templates = interface.list_templates()
    
    return {
        "templates": templates,
        "count": len(templates)
    }


@app.get("/templates/{template_name}/fields")
async def get_template_fields(
    template_name: str,
    user_info: Dict[str, Any] = Depends(get_supabase_user)
):
    """Get field names for a specific template."""
    interface = get_form_interface()
    
    try:
        fields = interface.get_field_names(template_name)
        return {
            "template_name": template_name,
            "fields": fields,
            "count": len(fields)
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting template fields: {str(e)}"
        )


@app.post("/documents/fill", response_model=DocumentResponse)
async def fill_document(
    document_request: DocumentRequest,
    background_tasks: BackgroundTasks,
    user_info: Dict[str, Any] = Depends(get_supabase_user)
):
    """Fill a document template with provided values."""
    interface = get_form_interface()
    
    try:
        # Generate unique document ID
        document_id = f"{user_info['username']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create output file path
        output_file = OUTPUT_DIR / f"{document_id}.pdf"
        
        # Fill the form (in background to avoid blocking)
        def fill_document_task():
            try:
                filled_path = interface.fill_form(
                    template_name=document_request.template_name,
                    field_values=document_request.field_values,
                    output_file=output_file,
                    autopredict=document_request.autopredict
                )
                logger.info(f"Document filled successfully: {filled_path}")
            except Exception as e:
                logger.error(f"Error filling document {document_id}: {str(e)}")
        
        background_tasks.add_task(fill_document_task)
        
        return {
            "document_id": document_id,
            "template_name": document_request.template_name,
            "output_path": str(output_file),
            "created_at": datetime.now(),
            "status": "processing"
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error filling document: {str(e)}"
        )


@app.post("/documents/upload-template")
async def upload_template(
    template_file: UploadFile = File(...),
    user_info: Dict[str, Any] = Depends(get_supabase_user)
):
    """Upload a new document template."""
    # Save the template file
    template_path = TEMPLATE_DIR / template_file.filename
    
    try:
        # Save uploaded file
        with open(template_path, "wb") as f:
            contents = await template_file.read()
            f.write(contents)
        
        # Reload the form interface to recognize the new template
        global form_interface
        form_interface = None
        interface = get_form_interface()
        
        return {
            "message": "Template uploaded successfully",
            "template_name": template_file.filename,
            "template_path": str(template_path)
        }
    
    except Exception as e:
        if template_path.exists():
            template_path.unlink()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading template: {str(e)}"
        )


@app.get("/documents/{document_id}")
async def get_document_status(
    document_id: str,
    user_info: Dict[str, Any] = Depends(get_supabase_user)
):
    """Get the status of a document."""
    # Check if the document exists
    document_path = OUTPUT_DIR / f"{document_id}.pdf"
    
    if document_path.exists():
        return {
            "document_id": document_id,
            "status": "completed",
            "output_path": str(document_path),
            "size_bytes": document_path.stat().st_size,
            "created_at": datetime.fromtimestamp(document_path.stat().st_mtime)
        }
    else:
        # Check if it's still processing
        if document_id.startswith(f"{user_info['username']}_"):
            return {
                "document_id": document_id,
                "status": "processing",
                "message": "Document is still being processed"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document not found: {document_id}"
            )


@app.post("/predict-fields")
async def predict_field_values(
    field_names: List[str],
    user_info: Dict[str, Any] = Depends(get_supabase_user)
):
    """Predict values for a list of field names."""
    interface = get_form_interface()
    
    try:
        predictions = interface.predict_field_values(field_names)
        return {
            "predictions": predictions,
            "count": len(predictions)
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error predicting field values: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 