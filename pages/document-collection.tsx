import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import OpenAI from 'openai';
import { SharedStyles, BackgroundEffects } from '../components/SharedStyles';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
  const [uploadedDocs, setUploadedDocs] = useState(new Set<string>());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [documentSummaries, setDocumentSummaries] = useState<Record<string, any>>({});
  
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
    console.log('Starting file upload for document type:', docType, 'File:', file.name);
    
    try {
      // Clear the processing flags and summaries when uploading new documents
      sessionStorage.removeItem('documentsProcessed');
      sessionStorage.removeItem('documentSummaries');
      localStorage.removeItem('documentSummaries');
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        throw new Error('Authentication error: ' + authError.message);
      }
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${docType}.${fileExt}`;
      console.log('Attempting to upload file:', fileName);
      
      // Check if file already exists and remove it
      const { data: existingFile } = await supabase.storage
        .from('documents')
        .list(`${user.id}`);

      if (existingFile?.some(f => f.name.startsWith(docType + '.'))) {
        const { error: removeError } = await supabase.storage
          .from('documents')
          .remove([fileName]);
          
        if (removeError) {
          console.error('Error removing existing file:', removeError);
        }
      }

      // Upload new file
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error('File upload failed: ' + uploadError.message);
      }

      console.log('File uploaded successfully:', uploadData);

      // Update user_documents table
      const { error: updateError } = await supabase
        .from('user_documents')
        .upsert({
          user_id: user.id,
          [docType]: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error('Database update failed: ' + updateError.message);
      }

      // Update local state
      setUploadedDocs(prev => {
        const newSet = new Set(prev);
        newSet.add(docType);
        console.log('Updated uploadedDocs:', Array.from(newSet));
        return newSet;
      });

      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert(error instanceof Error ? error.message : 'Error uploading document. Please try again.');
    }
  };

  // Add debugging useEffect
  useEffect(() => {
    console.log('uploadedDocs changed:', Array.from(uploadedDocs));
    console.log('Resume uploaded?', uploadedDocs.has('resume'));
  }, [uploadedDocs]);

  const handleContinueToDashboard = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const documentsObject = Array.from(uploadedDocs).reduce((obj, docType) => {
        obj[docType] = true;
        return obj;
      }, {} as Record<string, boolean>);

      router.push({
        pathname: '/processing-documents',
        query: { 
          documents: JSON.stringify(documentsObject)
        }
      });
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while processing your documents.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <Head>
        <style>{SharedStyles}</style>
        <title>Prometheus - Document Collection</title>
      </Head>

      {isLoading && <LoadingScreen />}

      <BackgroundEffects />

      <div className="min-h-screen bg-transparent p-6">
        <div className="max-w-3xl mx-auto pt-12 md:pt-24">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">Document Collection</h1>
            <p className="text-slate-300">
              Upload your supporting documents to help Prometheus AI build your strongest O-1 visa case.
            </p>
          </div>

          <div className="card p-5 md:p-6 w-full text-center border-primary-500/30">
            <p className="text-sm text-slate-300">
              <strong className="font-semibold text-accent-300">Important:</strong> At Prometheus, we help the world's top talent establish extraordinary ability. Strong documentation significantly increases your O-1 visa approval chances.
            </p>
          </div>

          <div className="space-y-4 w-full">
            {documentTypes.map((doc) => (
              <div
                key={doc.id}
                className={`card group hover:border-accent-400/30 ${doc.required ? 'border-l-4 border-l-primary-500' : ''}`}
              >
                <div className="p-5 md:p-6 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="space-y-2 text-center">
                      <h2 className="text-lg font-semibold gradient-text flex flex-wrap items-center justify-center gap-2">
                        {doc.name}
                        {doc.required && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-primary-500/20 rounded-full text-primary-400">Required</span>
                        )}
                      </h2>
                      <p className="text-sm text-slate-400 max-w-lg mx-auto">{doc.description}</p>
                    </div>
                    <div className="mt-1">
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(doc.id, file);
                        }}
                        style={{ display: 'none', position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: '0' }}
                        id={`file-${doc.id}`}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="sr-only"
                      />
                      <label
                        htmlFor={`file-${doc.id}`}
                        className="gradient-button cursor-pointer text-sm inline-flex items-center"
                      >
                        Upload
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </label>
                    </div>
                  </div>
                  {uploadedDocs.has(doc.id) && (
                    <div className="mt-3 flex items-center justify-center">
                      <svg
                        className="text-emerald-400 w-3.5 h-3.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="ml-2 text-xs text-emerald-400">
                        Document uploaded successfully
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center w-full pt-4">
            <button
              onClick={handleContinueToDashboard}
              disabled={!uploadedDocs.has('resume') || isProcessing}
              className={`gradient-button text-base px-6 py-2.5 ${(!uploadedDocs.has('resume') || isProcessing) ? 'opacity-70 cursor-not-allowed' : ''}`}
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
          </div>
          
          <div className="text-center text-sm text-slate-500 max-w-lg">
            <p>Not ready to upload all documents? You can start with your resume and add more evidence later. Our AI will identify your strongest qualifications and help position you as exceptional talent for your O-1 petition.</p>
          </div>
        </div>
      </div>
    </div>
  );
}