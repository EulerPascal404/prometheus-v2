import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../config/supabase';
import Navbar from '../components/Navbar';
import { BackgroundEffects } from '../components/BackgroundEffects';

interface Template {
  id: string;
  name: string;
  description: string;
  field_count: number;
  created_at: string;
  last_used: string | null;
}

export default function Templates() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          router.push('/auth?redirect=templates');
          return;
        }

        const response = await fetch('/api/templates', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.statusText}`);
        }

        const data = await response.json();
        setTemplates(data);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, [router]);

  const handleTemplateSelect = (templateId: string) => {
    router.push(`/form-editor?templateId=${templateId}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        router.push('/auth?redirect=templates');
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append('template_file', file);

      // Upload template
      const response = await fetch('/api/documents/upload-template', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload template: ${errorText}`);
      }

      const result = await response.json();
      console.log('Template uploaded successfully:', result);
      setUploadSuccess(true);
      
      // Refresh templates list
      setTimeout(() => {
        setUploadSuccess(false);
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error('Error uploading template:', err);
      setUploadError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Document Templates | O-1 Visa Automation</title>
        <meta name="description" content="Manage document templates for O-1 visa applications" />
      </Head>

      <Navbar />
      <BackgroundEffects />

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Document Templates</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Select a template to fill out or upload a new template to the system.
          </p>
        </div>

        {/* Upload section */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload New Template</h2>
          
          <div className="flex items-center space-x-4">
            <label className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-md text-white text-sm font-medium transition-colors">
              <span>Select PDF Template</span>
              <input
                type="file"
                accept=".pdf"
                className="sr-only"
                onChange={handleFileUpload}
                disabled={uploadLoading}
              />
            </label>
            <span className="text-sm text-gray-500">
              Only PDF templates with fillable form fields are supported
            </span>
          </div>

          {uploadLoading && (
            <div className="mt-4 flex items-center text-blue-600">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Uploading...</span>
            </div>
          )}

          {uploadError && (
            <div className="mt-4 text-red-600 text-sm">
              <p>Error: {uploadError}</p>
            </div>
          )}

          {uploadSuccess && (
            <div className="mt-4 text-green-600 text-sm flex items-center">
              <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Template uploaded successfully!</span>
            </div>
          )}
        </div>

        {/* Templates list */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Available Templates</h2>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-red-600">
              <p>Error loading templates: {error}</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4">No templates available. Upload a template to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fields</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {templates.map((template) => (
                    <tr key={template.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{template.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{template.description || 'No description'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{template.field_count} fields</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {template.last_used 
                            ? new Date(template.last_used).toLocaleDateString() 
                            : 'Never used'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleTemplateSelect(template.id)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Fill Form
                        </button>
                        <a
                          href={`/api/templates/${template.id}/download`}
                          className="text-green-600 hover:text-green-900"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 