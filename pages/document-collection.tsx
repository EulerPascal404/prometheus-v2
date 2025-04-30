import { useState, useEffect, useRef } from 'react';
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
  application_id?: string;
}

// New interface for application data
interface Application {
  id: string;
  created_at: string;
  status: 'in_progress' | 'submitted' | 'approved' | 'rejected';
  score: number;
  summary: string;
  document_count: number;
  last_updated: string;
  name: string;
}

interface PersonalInfo {
  name: string;
  phone: string;
  address: string;
  extraInfo: string;
}

// Add this interface extension after the PersonalInfo interface
interface Window {
  google: any; // Using any to avoid type conflicts
  initializeGooglePlaces: () => void;
}

// Add this interface near the top with other interfaces
interface UserPersonalInfo {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address: string;
  extra_info: string;
  created_at: string;
  last_updated: string;
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

// Function to handle file uploads
async function uploadFileToStorage(docType: string, file: File, applicationId?: string | null) {
  try {
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }
    
    // Check if file is PDF
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported');
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size should not exceed 10MB');
    }
    
    // Generate a unique file ID
    const fileId = Date.now().toString();
    
    // Create storage path
    // documents/[user_id]/applications/[application_id]/[document_type]/[files]
    let storagePath;
    if (applicationId) {
      storagePath = `${user.id}/applications/${applicationId}/${docType}/${fileId}-${file.name}`;
    } else {
      storagePath = `${user.id}/${docType}/${fileId}-${file.name}`;
    }
    
    console.log(`Uploading file to storage path: ${storagePath}`);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file);
      
    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    // Update local state
    return {
      id: fileId,
      docType,
      filename: file.name,
      uploadedAt: new Date(),
      application_id: applicationId || undefined
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
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
  const { applicationId } = router.query;
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [documentSummaries, setDocumentSummaries] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    phone: '',
    address: '',
    extraInfo: ''
  });
  
  // Add these refs for Google Maps autocomplete
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  
  // Add state for existing applications
  const [existingApplications, setExistingApplications] = useState<Application[]>([]);
  const [showApplicationSelector, setShowApplicationSelector] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  
  // Add this state near other state declarations
  const [userPersonalInfo, setUserPersonalInfo] = useState<UserPersonalInfo | null>(null);
  const [isLoadingPersonalInfo, setIsLoadingPersonalInfo] = useState(true);
  
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

  // Initial user check
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('Initial user check:', user);
      
      if (error || !user) {
        console.error('No authenticated user found:', error);
        router.push('/auth');
        return;
      }
      
      // Check if we already have an applicationId
      if (applicationId) {
        setSelectedApplicationId(applicationId as string);
        // If we have an applicationId, we'll load specific documents below
      } else {
        // Otherwise, show the application selector
        setShowApplicationSelector(true);
      }
      
      // Fetch applications from Supabase
      const { data: applications, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (appError) {
        console.error('Error loading applications:', appError);
      } else if (applications) {
        setExistingApplications(applications);
      }
      
      setIsLoading(false);
    };

    checkUser();
  }, [applicationId, router]);
  
  // Add function to load documents for a specific application
  useEffect(() => {
    const loadApplicationDocuments = async () => {
      if (!applicationId && !selectedApplicationId) return;
      
      const appId = (applicationId || selectedApplicationId) as string;
      if (!appId) return;
      
      try {
        setIsLoading(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user found');
          return;
        }
        
        // Fetch files from the application-specific path in storage
        // The correct path structure is:
        // documents/[user_id]/applications/[application_id]/[document_type]/[files]
        const { data: docTypes, error: docTypesError } = await supabase.storage
          .from('documents')
          .list(`${user.id}/applications/${appId}`);
          
        if (docTypesError) {
          console.error('Error fetching application folders:', docTypesError);
          setIsLoading(false);
          return;
        }
        
        if (!docTypes || docTypes.length === 0) {
          // No documents yet
          setUploadedDocs([]);
          setIsLoading(false);
          return;
        }
        
        // Collect all documents from all document type folders
        const allDocuments: UploadedDocument[] = [];
        
        for (const folder of docTypes) {
          if (folder.name && !folder.name.includes('.')) { // It's a folder, not a file
            const docType = folder.name;
            
            const { data: files, error: filesError } = await supabase.storage
              .from('documents')
              .list(`${user.id}/applications/${appId}/${docType}`);
              
            if (filesError) {
              console.error(`Error fetching files for ${docType}:`, filesError);
              continue;
            }
            
            if (files && files.length > 0) {
              for (const fileObj of files) {
                // Extract the original fileId from the filename (assuming format: fileId-originalFilename)
                const fileIdMatch = fileObj.name.match(/^([^-]+)-(.+)$/);
                const fileId = fileIdMatch ? fileIdMatch[1] : Date.now().toString();
                const originalFilename = fileIdMatch ? fileIdMatch[2] : fileObj.name;
                
                allDocuments.push({
                  id: fileId,
                  docType: docType,
                  filename: originalFilename,
                  uploadedAt: new Date(fileObj.created_at || Date.now()),
                  application_id: appId
                });
              }
            }
          }
        }
        
        setUploadedDocs(allDocuments);
      } catch (error) {
        console.error('Error loading application documents:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (applicationId || selectedApplicationId) {
      loadApplicationDocuments();
    }
  }, [applicationId, selectedApplicationId]);
  
  // Function to create a new application and redirect
  const createNewApplication = async () => {
    try {
      setIsProcessing(true);
      setError(null); // Clear any previous errors
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Authentication error:', authError);
        throw new Error('Authentication failed. Please try logging in again.');
      }
      if (!user) {
        console.error('No authenticated user found');
        throw new Error('No authenticated user found. Please log in.');
      }
      
      // Get user's personal info - handle case where table doesn't exist or no data
      let personalInfoData: { full_name?: string; phone?: string; address?: string; extra_info?: string } | null = null;
      try {
        const { data, error: personalInfoError } = await supabase
          .from('user_personal_info')
          .select('full_name, phone, address, extra_info')
          .eq('user_id', user.id)
          .single();

        if (personalInfoError && personalInfoError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error fetching personal info:', personalInfoError);
          // Don't throw error, just log it and continue with empty personal info
        } else {
          personalInfoData = data as { full_name?: string; phone?: string; address?: string; extra_info?: string } | null;
        }
      } catch (err) {
        console.error('Error accessing user_personal_info table:', err);
        // Continue with empty personal info
      }

      // Create a new empty application with personal info if available
      const newApplication = {
        user_id: user.id,
        status: 'in_progress',
        score: 0,
        summary: 'New application',
        document_count: 0,
        last_updated: new Date().toISOString(),
        name: 'Untitled Application',
        personal_name: personalInfoData?.full_name || '',
        personal_phone: personalInfoData?.phone || '',
        personal_address: personalInfoData?.address || '',
        personal_extra_info: personalInfoData?.extra_info || ''
      };
      
      console.log('Creating new application with data:', newApplication);
      
      // Insert into Supabase
      const { data, error: insertError } = await supabase
        .from('applications')
        .insert([newApplication])
        .select();
      
      if (insertError) {
        console.error('Error inserting application:', insertError);
        throw new Error(`Failed to create application: ${insertError.message}`);
      }
      
      if (data && data.length > 0) {
        console.log('Successfully created application:', data[0]);
        // Navigate to document collection with the new application ID
        router.push(`/document-collection?applicationId=${data[0].id}`);
      } else {
        throw new Error('No data returned after creating application');
      }
    } catch (error) {
      console.error('Error creating new application:', error);
      setError(error instanceof Error ? error.message : 'Failed to create a new application. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to select an existing application
  const selectApplication = (appId: string) => {
    setSelectedApplicationId(appId);
    setShowApplicationSelector(false);
    router.push(`/document-collection?applicationId=${appId}`);
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
      
      // Use document's application_id if available
      // documents/[user_id]/applications/[application_id]/[document_type]/[files]
      const storagePath = docToRemove.application_id
        ? `${user.id}/applications/${docToRemove.application_id}/${docToRemove.docType}/${docToRemove.id}-${docToRemove.filename}`
        : `${user.id}/${docToRemove.docType}/${docToRemove.id}-${docToRemove.filename}`;
      
      console.log(`Deleting file from storage path: ${storagePath}`);
      
      // Delete from Supabase storage
      const { error: deleteError } = await supabase.storage
        .from('documents')
        .remove([storagePath]);
        
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

  // Add this useEffect to load personal info when the component mounts
  useEffect(() => {
    const loadPersonalInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('user_personal_info')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error loading personal info:', error);
          return;
        }

        if (data) {
          setUserPersonalInfo(data);
          setPersonalInfo({
            name: data.full_name || '',
            phone: data.phone || '',
            address: data.address || '',
            extraInfo: data.extra_info || ''
          });
        }
      } catch (error) {
        console.error('Error loading personal info:', error);
      } finally {
        setIsLoadingPersonalInfo(false);
      }
    };

    loadPersonalInfo();
  }, []);

  // Update the handlePersonalInfoChange function
  const handlePersonalInfoChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPersonalInfo(prevInfo => ({
      ...prevInfo,
      [name]: value
    }));

    // Save to database after a short delay
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const personalInfoData = {
        user_id: user.id,
        full_name: name === 'name' ? value : personalInfo.name,
        phone: name === 'phone' ? value : personalInfo.phone,
        address: name === 'address' ? value : personalInfo.address,
        extra_info: name === 'extraInfo' ? value : personalInfo.extraInfo
      };

      if (userPersonalInfo) {
        // Update existing record
        const { error } = await supabase
          .from('user_personal_info')
          .update(personalInfoData)
          .eq('id', userPersonalInfo.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('user_personal_info')
          .insert([personalInfoData]);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving personal info:', error);
    }
  };

  const isPersonalInfoComplete = () => {
    return personalInfo.name.trim() !== '' && 
           personalInfo.phone.trim() !== '' && 
           personalInfo.address.trim() !== '';
  };

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

      // Check if required personal info is complete
      if (!isPersonalInfoComplete()) {
        throw new Error('Please complete all required personal information fields');
      }

      // Prepare documents object for processing
      const documentsObject = {};
      documentTypes.forEach(doc => {
        documentsObject[doc.id] = hasDocType(doc.id);
      });

      // Store personal info in localStorage for use in document-review
      localStorage.setItem('personalInfo', JSON.stringify(personalInfo));

      console.log('Submitting documents for processing:', documentsObject);
      console.log('Personal info:', personalInfo);

      // Save documents to localStorage
      const documentsToProcess = uploadedDocs.map(doc => ({
        id: doc.id,
        docType: doc.docType,
        filename: doc.filename,
        uploadedAt: doc.uploadedAt,
        application_id: doc.application_id || applicationId || undefined
      }));
      
      localStorage.setItem('uploadedDocuments', JSON.stringify(documentsToProcess));
      
      // Navigate to processing page with application id if available
      const query = applicationId ? { documents: JSON.stringify(documentsToProcess), applicationId } : { documents: JSON.stringify(documentsToProcess) };
      router.push({
        pathname: '/processing-documents',
        query
      });
    } catch (error) {
      console.error('Error continuing to dashboard:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while processing your documents');
      setIsProcessing(false);
    }
  };

  // Initialize Google Maps script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setGoogleMapsReady(true);
      document.head.appendChild(script);
    } else {
      setGoogleMapsReady(true);
    }
  }, []);

  // Initialize Google Places autocomplete
  useEffect(() => {
    if (googleMapsReady && addressInputRef.current && !autocomplete) {
      const input = addressInputRef.current;
      const options = {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components'],
        types: ['address']
      };
      
      const autocompleteInstance = new google.maps.places.Autocomplete(input, options);
      setAutocomplete(autocompleteInstance);

      autocompleteInstance.addListener('place_changed', () => {
        const place = autocompleteInstance.getPlace();
        const newAddress = place.formatted_address || personalInfo.address || '';
        setPersonalInfo(prev => ({
          ...prev,
          address: newAddress
        }));
      });
    }
  }, [googleMapsReady, autocomplete]);

  // Add the missing handleFileUpload method inside the component
  const handleFileUpload = async (docType: string, file: File) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      const appId = applicationId || selectedApplicationId;
      const newDoc = await uploadFileToStorage(docType, file, appId as string);
      
      if (newDoc) {
        setUploadedDocs(prev => [...prev, newDoc]);
        
        // If it's a resume document, try to generate a summary
        if (docType === 'resume') {
          try {
            // Extract text from the PDF
            const text = await extractTextFromPdf(file);
            
            // Generate summary using OpenAI
            const summary = await generateSummary(text, docType);
            
            // Store the summary
            setDocumentSummaries(prev => ({
              ...prev,
              [newDoc.id]: summary
            }));
          } catch (error) {
            console.error('Error processing resume:', error);
            // Don't block the upload if summary generation fails
          }
        }
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while uploading the document');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add the missing renderApplicationSelector function
  const renderApplicationSelector = () => (
    <div className="max-w-xl mx-auto pt-12 md:pt-24">
      <div className="text-center mb-8 relative">
        <h1 className="text-3xl font-bold gradient-text mb-2">Welcome to Prometheus</h1>
        <p className="text-slate-300">
          Let's get started with your O-1 visa application. You can create a new application or continue an existing one.
        </p>
      </div>

      <div className="card p-6 w-full border-primary-500/30 mb-8">
        <div className="flex flex-col items-center gap-6">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold gradient-text">Your Applications</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              You can manage multiple visa applications separately. Each application has its own documents and status.
            </p>
          </div>
          
          {/* Create New Application Button */}
          <button
            onClick={createNewApplication}
            disabled={isProcessing}
            className={`gradient-button text-base px-6 py-3 w-full max-w-md ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? 'Creating Application...' : 'Create New Application'}
            {!isProcessing && (
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
            {isProcessing && (
              <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin ml-2"></div>
            )}
          </button>
          
          {/* Existing Applications List */}
          {existingApplications.length > 0 && (
            <div className="w-full max-w-md">
              <h3 className="text-md font-medium text-slate-300 mb-3">Or continue with an existing application:</h3>
              <div className="space-y-3 mt-2">
                {existingApplications.map(app => (
                  <button
                    key={app.id}
                    onClick={() => selectApplication(app.id)}
                    className="w-full bg-slate-800/70 hover:bg-slate-800 border border-slate-700/50 rounded-lg p-4 text-left transition-colors duration-200"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-300">
                            {app.name || 'Untitled Application'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            app.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                            app.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-400' :
                            app.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {app.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {app.document_count} document{app.document_count !== 1 ? 's' : ''} • 
                          Last updated: {new Date(app.last_updated).toLocaleDateString()}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center text-sm text-slate-500 max-w-lg mx-auto">
        <p>Creating multiple applications allows you to prepare different visa petitions or explore various options without mixing your documents.</p>
      </div>
    </div>
  );

  // Simplified resume-only view
  const renderSimpleUpload = () => (
    <div className="max-w-xl mx-auto pt-12 md:pt-24">
      <div className="text-center mb-8 relative">
        <h1 className="text-3xl font-bold gradient-text mb-2">Get Started with Your O-1 Analysis</h1>
        <p className="text-slate-300">
          Upload your resume and Prometheus AI will analyze your qualifications for an O-1 extraordinary ability visa.
        </p>
      </div>

      {/* Personal Information Section */}
      <div className="card p-5 md:p-6 w-full border-primary-500/30 mb-8">
        <div className="flex flex-col items-center gap-6">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold gradient-text">Personal Information</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Please provide your contact information to help us personalize your O-1 visa application.
            </p>
          </div>
          
          <div className="w-full space-y-4">
            <div className="space-y-1">
              <label htmlFor="name" className="block text-sm font-medium text-slate-300">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={personalInfo.name}
                onChange={handlePersonalInfoChange}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={personalInfo.phone}
                onChange={handlePersonalInfoChange}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="+1 123 456 7890"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-1">Your Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <input
                  ref={addressInputRef}
                  type="text"
                  id="address"
                  name="address"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pl-10"
                  placeholder="Enter your full address"
                  value={personalInfo.address}
                  onChange={handlePersonalInfoChange}
                  required
                />
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                Powered by Google Places autocomplete
              </p>
            </div>
            
            <div className="space-y-1">
              <label htmlFor="extraInfo" className="block text-sm font-medium text-slate-300">Additional Information</label>
              <textarea
                id="extraInfo"
                name="extraInfo"
                value={personalInfo.extraInfo}
                onChange={handlePersonalInfoChange}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Any additional information you'd like to share"
                rows={3}
              />
            </div>
            
            <div className="text-xs text-slate-500">
              <p>* Required fields</p>
            </div>
          </div>
        </div>
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
    <div className="max-w-xl mx-auto pt-12 md:pt-24">
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

      {/* Personal Information Section */}
      <div className="card p-5 md:p-6 w-full border-primary-500/30 mb-8 border-l-4 border-l-primary-500">
        <div className="flex flex-col gap-4">
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-semibold gradient-text flex flex-wrap items-center justify-center gap-2">
              Personal Information
              <span className="text-xs font-medium px-2 py-0.5 bg-primary-500/20 rounded-full text-primary-400">Required</span>
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Please provide your contact information to help us personalize your O-1 visa application.
            </p>
          </div>
          
          <div className="w-full space-y-4">
            <div className="space-y-1">
              <label htmlFor="name-full" className="block text-sm font-medium text-slate-300">Full Name *</label>
              <input
                type="text"
                id="name-full"
                name="name"
                value={personalInfo.name}
                onChange={handlePersonalInfoChange}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="phone-full" className="block text-sm font-medium text-slate-300">Phone Number *</label>
              <input
                type="tel"
                id="phone-full"
                name="phone"
                value={personalInfo.phone}
                onChange={handlePersonalInfoChange}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="+1 123 456 7890"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="address-full" className="block text-sm font-medium text-slate-300">Address *</label>
              <input
                type="text"
                id="address-full"
                name="address"
                value={personalInfo.address}
                onChange={handlePersonalInfoChange}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="123 Main St, City, State, ZIP"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="extraInfo-full" className="block text-sm font-medium text-slate-300">Additional Information</label>
              <textarea
                id="extraInfo-full"
                name="extraInfo"
                value={personalInfo.extraInfo}
                onChange={handlePersonalInfoChange}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Any additional information you'd like to share"
                rows={3}
              />
            </div>
            
            <div className="text-xs text-slate-500">
              <p>* Required fields</p>
            </div>
          </div>
        </div>
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

  // Add style for any Google Maps elements
  useEffect(() => {
    // Create a style element for Google Maps styling
    const styleEl = document.createElement('style');
    styleEl.id = 'google-maps-style';
    styleEl.innerHTML = `
      /* Google Maps related styling */
      .gm-style {
        font-family: 'IBM Plex Mono', 'Space Mono', 'Roboto Mono', monospace;
      }
      
      .gm-style button {
        background: rgba(168, 85, 247, 0.1);
        border: 1px solid rgba(168, 85, 247, 0.25);
        color: #C084FC;
      }
      
      .gm-style button:hover {
        background: rgba(168, 85, 247, 0.15);
        border-color: rgba(168, 85, 247, 0.4);
      }
      
      /* Autocomplete dropdown styling */
      .pac-container {
        background-color: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 0.5rem;
        border: 1px solid rgba(168, 85, 247, 0.2);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        font-family: 'Inter', system-ui, sans-serif;
        margin-top: 4px;
        padding: 8px 0;
        z-index: 1000;
      }
      
      .pac-item {
        padding: 8px 12px;
        color: #E2E8F0;
        font-size: 0.875rem;
        border-top: 1px solid rgba(56, 189, 248, 0.1);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .pac-item:first-child {
        border-top: none;
      }
      
      .pac-item:hover, .pac-item-selected {
        background-color: rgba(168, 85, 247, 0.15);
      }
      
      .pac-icon {
        display: none;
      }
      
      .pac-item-query {
        color: #A855F7;
        font-size: 0.875rem;
        font-weight: 500;
        padding-right: 4px;
      }
      
      .pac-matched {
        color: #60A5FA;
        font-weight: 600;
      }
      
      .pac-logo:after {
        background-color: rgba(15, 23, 42, 0.95);
        color: #94A3B8;
        font-size: 0.75rem;
        padding: 4px 8px;
      }
    `;
    
    document.head.appendChild(styleEl);
    
    return () => {
      const existingStyle = document.getElementById('google-maps-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

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
        {showApplicationSelector ? (
          renderApplicationSelector()
        ) : (
          showAllDocuments ? renderFullDocumentCollection() : renderSimpleUpload()
        )}
      </div>
    </div>
  );
}