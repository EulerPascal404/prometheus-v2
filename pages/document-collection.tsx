import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import OpenAI from 'openai';
import { SharedStyles, BackgroundEffects } from '../components/SharedStyles';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Only import PDF.js on the client side
let pdfjsLib: any = null;
if (typeof window !== 'undefined') {
  import('pdfjs-dist').then(module => {
    pdfjsLib = module;
    // Set the worker source for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  });
}

interface DocumentType {
  id: string;
  name: string;
  required: boolean;
  description: string;
}

interface UploadedDocument {
  id: string;
  docType: string;
  filename: string;
  uploadedAt: Date;
}

// Function to extract text from PDF
async function extractTextFromPdf(file: File): Promise<string> {
  // Ensure we're in the browser environment
  if (typeof window === 'undefined') {
    throw new Error('PDF processing can only be done in the browser');
  }
  
  // Make sure PDF.js is loaded
  if (!pdfjsLib) {
    await new Promise(resolve => {
      const checkPdfJs = setInterval(() => {
        if (pdfjsLib) {
          clearInterval(checkPdfJs);
          resolve(true);
        }
      }, 100);
    });
  }
  
  console.log(`Extracting text from PDF: ${file.name}`);
  console.log(`File size: ${file.size} bytes`);
  console.log(`File type: ${file.type}`);
  
  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log(`ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);
    
    // Load the PDF document
    console.log('Loading PDF document...');
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    console.log(`PDF loaded successfully. Pages: ${pdfDocument.numPages}`);
    
    // Extract text from all pages
    let extractedText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      console.log(`Extracting text from page ${i} of ${pdfDocument.numPages}...`);
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      extractedText += pageText + '\n\n';
    }
    
    console.log(`Text extraction complete. Total length: ${extractedText.length} characters`);
    
    // Log a preview of the extracted text
    const textPreview = extractedText.substring(0, 500);
    console.log(`Text preview: ${textPreview}...`);
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

// Function to generate summary using OpenAI
async function generateSummary(text: string, docType: string): Promise<{
  analysis: string;
  sections: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}> {
  try {
    // Construct the prompt based on document type
    let prompt = '';
    switch (docType) {
      case 'resume':
        prompt = `Analyze the following CV/resume and provide a structured analysis with strengths, weaknesses, and recommendations for improvement. Format the response with clear sections for Strengths, Weaknesses, and Recommendations. Each section should contain bullet points with specific observations.`;
        break;
      case 'cover_letter':
        prompt = `Analyze the following cover letter and provide a structured analysis with strengths, weaknesses, and recommendations for improvement. Format the response with clear sections for Strengths, Weaknesses, and Recommendations. Each section should contain bullet points with specific observations.`;
        break;
      case 'research_paper':
        prompt = `Analyze the following research paper and provide a structured analysis with strengths, weaknesses, and recommendations for improvement. Format the response with clear sections for Strengths, Weaknesses, and Recommendations. Each section should contain bullet points with specific observations.`;
        break;
      default:
        prompt = `Analyze the following document and provide a structured analysis with strengths, weaknesses, and recommendations for improvement. Format the response with clear sections for Strengths, Weaknesses, and Recommendations. Each section should contain bullet points with specific observations.`;
    }

    prompt += `\n\nDocument content:\n${text}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert document reviewer specializing in academic and professional documents. Provide detailed, constructive feedback with specific examples and actionable recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    if (!completion.choices || completion.choices.length === 0 || !completion.choices[0].message.content) {
      throw new Error('No content returned from OpenAI API');
    }

    const analysis = completion.choices[0].message.content;

    // Parse the analysis into structured sections
    const sections = {
      strengths: extractSection(analysis, 'Strengths:'),
      weaknesses: extractSection(analysis, 'Weaknesses:'),
      recommendations: extractSection(analysis, 'Recommendations:')
    };

    return { analysis, sections };
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

// Helper function to extract a section from the analysis
function extractSection(analysis: string, sectionName: string): string[] {
  const sectionRegex = new RegExp(`${sectionName}\\s*([\\s\\S]*?)(?=\\n\\n|$)`, 'i');
  const match = analysis.match(sectionRegex);
  
  if (!match) return [];
  
  const sectionContent = match[1].trim();
  return sectionContent
    .split('\n')
    .map(item => item.trim())
    .filter(item => item.length > 0 && (item.startsWith('-') || item.startsWith('•')))
    .map(item => item.substring(1).trim());
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/90 border border-slate-700/50 rounded-xl p-8 max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-600 border-t-primary-400 animate-spin mb-6"></div>
          <h3 className="text-xl font-semibold text-white mb-2">Preparing Your Application</h3>
          <p className="text-slate-300 text-sm">Please wait while we set up your O-1 visa application workspace...</p>
        </div>
      </div>
    </div>
  );
}

export default function DocumentCollection() {
  const router = useRouter();
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [documentSummaries, setDocumentSummaries] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  
  const documentTypes: DocumentType[] = [
    {
      id: 'resume',
      name: 'Resume/CV',
      required: true,
      description: 'Upload your detailed professional resume or curriculum vitae showcasing your extraordinary achievements.'
    },
    {
      id: 'publications',
      name: 'Publications or Notable Work',
      required: false,
      description: 'Include any published articles, books, research papers, or notable work in your field.'
    },
    {
      id: 'awards',
      name: 'Awards & Recognitions',
      required: false,
      description: 'Provide documentation of significant awards, honors, or industry recognition you have received.'
    },
    {
      id: 'recommendation',
      name: 'Recommendation Letters',
      required: false,
      description: 'Letters from experts in your field attesting to your extraordinary ability and achievements.'
    },
    {
      id: 'press',
      name: 'Press Coverage',
      required: false,
      description: 'Media mentions, press articles, or interviews that demonstrate your prominence in your field.'
    },
    {
      id: 'salary',
      name: 'Salary Evidence',
      required: false,
      description: 'Documentation showing substantial remuneration compared to others in your field.'
    },
    {
      id: 'judging',
      name: 'Judging Experience',
      required: false,
      description: 'Evidence of judging the work of others in your field, such as peer review or competition judging.'
    },
    {
      id: 'membership',
      name: 'Professional Membership',
      required: false,
      description: 'Proof of membership in associations requiring outstanding achievement for membership.'
    },
    {
      id: 'contributions',
      name: 'Original Contributions',
      required: false,
      description: 'Documentation of original scientific, scholarly, or business-related contributions of major significance.'
    }
  ];

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('Initial user check:', user);
      
      if (error || !user) {
        console.error('No authenticated user found:', error);
        router.push('/auth');
      }
      setIsLoading(false);
    };

    checkUser();
  }, []);

  const handleFileUpload = async (docType: string, file: File) => {
    try {
      setError(null);
      setIsProcessing(true);
      
      // Validate file type
      if (!file.type.includes('pdf')) {
        throw new Error('Please upload a PDF file');
      }
      
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Generate a unique ID for the file
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const filename = file.name;
      
      // Upload file to Supabase storage with unique filename
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`${user.id}/${docType}/${fileId}-${filename}`, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      // Update local state with new document
      const newDocument: UploadedDocument = {
        id: fileId,
        docType,
        filename,
        uploadedAt: new Date()
      };
      
      setUploadedDocs(prev => [...prev, newDocument]);
      
      // Clear any previous errors
      setError(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while uploading the file');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to check if any documents of a specific type have been uploaded
  const hasDocType = (docType: string) => {
    return uploadedDocs.some(doc => doc.docType === docType);
  };
  
  // Get documents of a specific type
  const getDocumentsOfType = (docType: string) => {
    return uploadedDocs.filter(doc => doc.docType === docType);
  };

  // Remove a specific document
  const removeDocument = async (docToRemove: UploadedDocument) => {
    try {
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // Delete from Supabase storage
      const { error: deleteError } = await supabase.storage
        .from('documents')
        .remove([`${user.id}/${docToRemove.docType}/${docToRemove.id}-${docToRemove.filename}`]);
        
      if (deleteError) {
        throw new Error(`Failed to delete file: ${deleteError.message}`);
      }
      
      // Update local state
      setUploadedDocs(prev => prev.filter(doc => doc.id !== docToRemove.id));
    } catch (error) {
      console.error('Error removing document:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while removing the document');
    }
  };

  // Add debugging useEffect
  useEffect(() => {
    console.log('uploadedDocs changed:', uploadedDocs);
    console.log('Resume uploaded?', hasDocType('resume'));
  }, [uploadedDocs]);

  const handleContinueToDashboard = async () => {
    try {
      // Prevent multiple submissions
      if (isProcessing) {
        return;
      }
      
      setError(null);
      setIsProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Check if required documents are uploaded
      if (!hasDocType('resume')) {
        throw new Error('Please upload your resume before proceeding');
      }

      // Prepare documents object for processing
      const documentsObject = {};
      documentTypes.forEach(doc => {
        documentsObject[doc.id] = hasDocType(doc.id);
      });

      console.log('Submitting documents for processing:', documentsObject);

      // Use replace instead of push to prevent back button from returning to this page
      router.replace({
        pathname: '/processing-documents',
        query: { documents: JSON.stringify(documentsObject) }
      });
    } catch (error) {
      console.error('Error continuing to dashboard:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while processing your documents');
      setIsProcessing(false);
    }
  };

  // Simplified resume-only view
  const renderSimpleUpload = () => (
    <div className="max-w-xl mx-auto pt-12 md:pt-24">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold gradient-text mb-2">Get Started with Your O-1 Analysis</h1>
        <p className="text-slate-300">
          Upload your resume and Prometheus AI will analyze your qualifications for an O-1 extraordinary ability visa.
        </p>
      </div>

      <div className="card p-5 md:p-6 w-full border-primary-500/30 mb-8">
        <div className="flex flex-col items-center gap-6">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold gradient-text">Upload Your Resume/CV</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Let our AI review your professional background and identify your strongest qualifications for an O-1 visa petition.
            </p>
          </div>
          
          <div className="w-full max-w-md">
            <div className="border-2 border-dashed border-primary-500/30 rounded-xl p-8 text-center hover:border-primary-500/50 transition-all duration-300">
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload('resume', file);
                }}
                style={{ display: 'none' }}
                id="file-resume"
                accept=".pdf"
                className="sr-only"
              />
              <label
                htmlFor="file-resume"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg className="w-12 h-12 text-primary-400/70 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-slate-300 text-sm mb-2">Drag and drop your resume here or click to browse</span>
                <span className="text-xs text-slate-500">(PDF format, max 10MB)</span>
              </label>
            </div>
            
            {/* List uploaded resumes */}
            {getDocumentsOfType('resume').length > 0 && (
              <div className="mt-4 bg-slate-800/70 border border-slate-700/50 rounded-lg overflow-hidden">
                <div className="p-3 border-b border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300">Uploaded Resumes ({getDocumentsOfType('resume').length})</h3>
                </div>
                <ul className="divide-y divide-slate-700/50">
                  {getDocumentsOfType('resume').map((doc) => (
                    <li key={doc.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center">
                        <svg className="text-primary-400 w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-slate-300 truncate max-w-[180px]">{doc.filename}</span>
                      </div>
                      <button 
                        onClick={() => removeDocument(doc)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        aria-label="Remove document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-4 w-full max-w-md">
            <button
              onClick={handleContinueToDashboard}
              disabled={!hasDocType('resume') || isProcessing}
              className={`gradient-button text-base px-6 py-3 ${(!hasDocType('resume') || isProcessing) ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? 'Processing...' : 'Analyze My Qualifications'}
              {!isProcessing && (
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
              {isProcessing && (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin ml-2"></div>
              )}
            </button>
            
            <button
              onClick={() => setShowAllDocuments(true)}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors flex items-center justify-center mt-2"
            >
              <span>I have additional supporting documents</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div className="text-center text-sm text-slate-500 max-w-lg mx-auto">
        <p>Your resume is all we need to get started. Our AI will evaluate your qualifications and help identify the strongest evidence for your O-1 visa petition.</p>
      </div>
    </div>
  );

  // Full document collection view
  const renderFullDocumentCollection = () => (
    <div className="max-w-3xl mx-auto pt-12 md:pt-24">
      <div className="text-center mb-8 relative">
        <button 
          onClick={() => setShowAllDocuments(false)}
          className="absolute -top-2 right-0 p-2 text-slate-400 hover:text-primary-400 transition-colors rounded-full hover:bg-slate-800/50"
          aria-label="Return to simple view"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold gradient-text mb-2">Comprehensive Document Collection</h1>
        <p className="text-slate-300">
          Upload supporting documents to strengthen your O-1 visa case and improve your qualification score.
        </p>
      </div>

      <div className="card p-5 md:p-6 w-full text-center border-primary-500/30 mb-8">
        <p className="text-sm text-slate-300">
          <strong className="font-semibold text-accent-300">Important:</strong> At Prometheus, we help the world's top talent establish extraordinary ability. Strong documentation significantly increases your O-1 visa approval chances.
        </p>
      </div>

      <div className="space-y-8 w-full">
        {documentTypes.map((doc) => (
          <div
            key={doc.id}
            className={`card group hover:border-accent-400/30 ${doc.required ? 'border-l-4 border-l-primary-500' : ''}`}
          >
            <div className="p-5 md:p-6">
              <div className="flex flex-col gap-4">
                <div className="space-y-2 text-center">
                  <h2 className="text-lg font-semibold gradient-text flex flex-wrap items-center justify-center gap-2">
                    {doc.name}
                    {doc.required && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-primary-500/20 rounded-full text-primary-400">Required</span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-400 max-w-lg mx-auto">{doc.description}</p>
                </div>
                
                {/* File Upload Area */}
                <div className="flex justify-center">
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(doc.id, file);
                    }}
                    style={{ display: 'none' }}
                    id={`file-${doc.id}`}
                    accept=".pdf"
                    className="sr-only"
                  />
                  <label
                    htmlFor={`file-${doc.id}`}
                    className="gradient-button cursor-pointer text-sm inline-flex items-center"
                  >
                    Add Document
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </label>
                </div>
                
                {/* List of uploaded documents for this type */}
                {getDocumentsOfType(doc.id).length > 0 && (
                  <div className="mt-2 bg-slate-800/70 border border-slate-700/50 rounded-lg overflow-hidden">
                    <div className="p-3 border-b border-slate-700/50 flex justify-between items-center">
                      <h3 className="text-sm font-medium text-slate-300">Uploaded Documents ({getDocumentsOfType(doc.id).length})</h3>
                    </div>
                    <ul className="divide-y divide-slate-700/50 max-h-[200px] overflow-y-auto">
                      {getDocumentsOfType(doc.id).map((document) => (
                        <li key={document.id} className="p-3 flex items-center justify-between">
                          <div className="flex items-center">
                            <svg className="text-primary-400 w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-slate-300 truncate max-w-[250px]">{document.filename}</span>
                            <span className="text-xs text-slate-500 ml-2">
                              {new Date(document.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={() => removeDocument(document)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                            aria-label="Remove document"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center w-full pt-6">
        <button
          onClick={handleContinueToDashboard}
          disabled={!hasDocType('resume') || isProcessing}
          className={`gradient-button text-base px-6 py-2.5 ${(!hasDocType('resume') || isProcessing) ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? 'Processing...' : 'Analyze My Qualifications'}
          {!isProcessing && (
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          )}
          {isProcessing && (
            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin ml-2"></div>
          )}
        </button>
        
        <button
          onClick={() => setShowAllDocuments(false)}
          className="text-sm text-primary-400 hover:text-primary-300 transition-colors mt-4 flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to simple upload</span>
        </button>
      </div>
      
      <div className="text-center text-sm text-slate-500 max-w-lg my-6 mx-auto">
        <p>Not ready to upload all documents? You can start with your resume and add more evidence later. Our AI will identify your strongest qualifications and help position you as exceptional talent for your O-1 petition.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <style>{SharedStyles}</style>
        <title>Prometheus - Document Collection</title>
      </Head>

      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}

      {isLoading && <LoadingScreen />}

      <BackgroundEffects />

      <div className="min-h-screen bg-transparent p-6">
        {showAllDocuments ? renderFullDocumentCollection() : renderSimpleUpload()}
      </div>
    </div>
  );
}