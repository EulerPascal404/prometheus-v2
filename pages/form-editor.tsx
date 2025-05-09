import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../config/supabase';
import Navbar from '../components/Navbar';
import { BackgroundEffects } from '../components/BackgroundEffects';
import FormEditor from '../components/FormEditor';

export default function FormEditorPage() {
  const router = useRouter();
  const { templateId, documentId } = router.query;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    async function checkAuth() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const isAuthed = !!sessionData.session?.access_token;
        
        setIsAuthenticated(isAuthed);
        
        if (!isAuthed) {
          router.push(`/auth?redirect=form-editor${
            templateId ? `&templateId=${templateId}` : ''
          }${
            documentId ? `&documentId=${documentId}` : ''
          }`);
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error checking auth:', err);
        setLoading(false);
      }
    }

    checkAuth();
  }, [router, templateId, documentId]);

  const handleSaveComplete = () => {
    // Show success message and redirect
    alert('Document saved successfully!');
    router.push('/documents');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>
          {documentId ? 'Edit Document' : 'Create Document'} | O-1 Visa Automation
        </title>
        <meta name="description" content="Fill or edit document templates for O-1 visa applications" />
      </Head>

      <Navbar />
      <BackgroundEffects />

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {documentId ? 'Edit Document' : 'Create New Document'}
            </h1>
            <p className="text-gray-600 mt-2">
              {documentId 
                ? 'Update your document information below'
                : 'Fill out the form fields to generate your document'
              }
            </p>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back
            </button>
            
            <button
              onClick={() => router.push('/templates')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              All Templates
            </button>
          </div>
        </div>

        {(!templateId && !documentId) ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Please select a template from the <a href="/templates" className="font-medium underline text-yellow-700 hover:text-yellow-600">templates page</a> or specify a templateId in the URL.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <FormEditor 
            templateId={templateId as string} 
            documentId={documentId as string} 
            onSave={handleSaveComplete}
          />
        )}
      </main>
    </div>
  );
} 