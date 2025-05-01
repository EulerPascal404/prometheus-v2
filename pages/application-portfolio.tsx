import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../config/supabase';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';
import Navbar from '../components/Navbar';

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

export default function ApplicationPortfolio() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingApplication, setIsCreatingApplication] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch applications from Supabase
        const { data: apps, error } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setApplications(apps || []);
      } catch (error) {
        console.error('Error fetching applications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplications();
  }, [router]);

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'in_progress':
        return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      case 'submitted':
        return 'text-primary-400 bg-primary-500/20 border-primary-500/30';
      case 'approved':
        return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      case 'rejected':
        return 'text-rose-400 bg-rose-500/20 border-rose-500/30';
      default:
        return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Add a function to create a new application
  const createNewApplication = async () => {
    try {
      setIsCreatingApplication(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      // Create a new empty application
      const newApplication = {
        user_id: user.id,
        status: 'in_progress',
        score: 0,
        summary: 'New application',
        document_count: 0,
        last_updated: new Date().toISOString(),
        name: 'Untitled Application'
      };
      
      // Insert into Supabase
      const { data, error } = await supabase
        .from('applications')
        .insert([newApplication])
        .select();
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        // Navigate to document collection with the new application ID
        router.push(`/document-collection?applicationId=${data[0].id}`);
      }
    } catch (error) {
      console.error('Error creating new application:', error);
      alert('Failed to create a new application. Please try again.');
    } finally {
      setIsCreatingApplication(false);
    }
  };

  const handleNameEdit = (appId: string, currentName: string) => {
    setEditingName(appId);
    setNewName(currentName);
  };

  const saveName = async (appId: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ name: newName })
        .eq('id', appId);

      if (error) throw error;

      // Update local state
      setApplications(applications.map(app => 
        app.id === appId ? { ...app, name: newName } : app
      ));
      setEditingName(null);
    } catch (error) {
      console.error('Error updating application name:', error);
      alert('Failed to update application name. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <title>Application Portfolio | Prometheus AI</title>
        <style>{SharedStyles}</style>
      </Head>

      <Navbar />
      <BackgroundEffects />

      <div className="min-h-screen bg-transparent p-6">
        <div className="max-w-6xl mx-auto pt-12">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gradient-primary">Application Portfolio</h1>
            <button
              onClick={createNewApplication}
              disabled={isCreatingApplication}
              className={`bg-gradient-to-r from-primary-500/20 to-purple-500/20 hover:from-primary-500/30 hover:to-purple-500/30 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center border border-primary-500/30 hover:border-primary-500/50 ${isCreatingApplication ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isCreatingApplication ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-primary-300 border-t-transparent animate-spin mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Application
                </>
              )}
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 rounded-full border-4 border-slate-600 border-t-primary-400 animate-spin"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Create New Application Card - always visible */}
                <div
                  className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-primary-500/30 overflow-hidden hover:border-primary-500/50 transition-all duration-300 group cursor-pointer"
                  onClick={createNewApplication}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center border border-primary-500/30">
                          <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <span className="text-sm text-slate-400">New</span>
                          <h3 className="text-lg font-medium text-white">Application</h3>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium text-primary-400 bg-primary-500/20 border-primary-500/30">
                        CREATE
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 bg-slate-700/20 rounded-lg">
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Start a New Application</h4>
                        <p className="text-sm text-slate-400">Begin your O-1 visa journey by creating a new application and uploading your documents.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-700/20 rounded-lg">
                          <span className="text-xs text-slate-400">Upload</span>
                          <p className="text-lg font-medium text-white">Documents</p>
                        </div>
                        <div className="p-3 bg-slate-700/20 rounded-lg">
                          <span className="text-xs text-slate-400">Get</span>
                          <p className="text-lg font-medium text-white">Started</p>
                        </div>
                      </div>
                    </div>

                    <button
                      className="w-full mt-6 bg-gradient-to-r from-primary-500/40 to-purple-500/40 hover:from-primary-500/60 hover:to-purple-500/60 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center border border-primary-500/30 hover:border-primary-500/50"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Application
                    </button>
                  </div>
                </div>
                
                {applications.length > 0 && applications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden hover:border-primary-500/30 transition-all duration-300 group"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center border border-primary-500/30">
                            <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            {editingName === app.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={newName}
                                  onChange={(e) => setNewName(e.target.value)}
                                  className="bg-slate-700/50 border border-primary-500/30 rounded px-2 py-1 text-white focus:outline-none focus:border-primary-500"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveName(app.id);
                                    if (e.key === 'Escape') setEditingName(null);
                                  }}
                                />
                                <button
                                  onClick={() => saveName(app.id)}
                                  className="text-primary-400 hover:text-primary-300"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setEditingName(null)}
                                  className="text-slate-400 hover:text-slate-300"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="group">
                                <span className="text-sm text-slate-400">Application Name</span>
                                <h3 
                                  className="text-lg font-medium text-white cursor-pointer hover:text-primary-400 transition-colors"
                                  onClick={() => handleNameEdit(app.id, app.name)}
                                >
                                  {app.name || 'Untitled Application'}
                                </h3>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                          {app.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-700/20 rounded-lg">
                          <span className="text-slate-300">Application Score</span>
                          <span className="text-lg font-semibold text-primary-400">{app.score}/10</span>
                        </div>

                        <div className="p-3 bg-slate-700/20 rounded-lg">
                          <h4 className="text-sm font-medium text-slate-300 mb-2">Summary</h4>
                          <p className="text-sm text-slate-400 line-clamp-3">{app.summary}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-700/20 rounded-lg">
                            <span className="text-xs text-slate-400">Documents</span>
                            <p className="text-lg font-medium text-white">{app.document_count}</p>
                          </div>
                          <div className="p-3 bg-slate-700/20 rounded-lg">
                            <span className="text-xs text-slate-400">Last Updated</span>
                            <p className="text-sm font-medium text-white">{formatDate(app.last_updated)}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => router.push(`/document-review?id=${app.id}`)}
                        className="w-full mt-6 bg-slate-700/40 hover:bg-slate-700/60 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center group-hover:bg-primary-500/20"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
                
                {applications.length === 0 && (
                  <div className="md:col-span-2 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/30 p-6 flex flex-col items-center justify-center">
                    <svg className="w-16 h-16 text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-medium text-white mb-2">No Applications Found</h3>
                    <p className="text-slate-400 max-w-md text-center mb-2">
                      Create your first application using the card on the left.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 