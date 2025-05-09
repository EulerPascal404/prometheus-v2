import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../config/supabase';
import Navbar from '../components/Navbar';
import { BackgroundEffects } from '../components/BackgroundEffects';

interface DocumentStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
}

interface RecentActivity {
  id: string;
  type: 'creation' | 'update' | 'deletion';
  document_name: string;
  timestamp: string;
}

interface DocumentByTemplate {
  template_name: string;
  count: number;
  percentage: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentStats, setDocumentStats] = useState<DocumentStats>({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [documentsByTemplate, setDocumentsByTemplate] = useState<DocumentByTemplate[]>([]);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        // Check authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const user = sessionData.session?.user;

        if (!token) {
          router.push('/auth?redirect=dashboard');
          return;
        }

        // Set user name if available
        if (user?.user_metadata?.full_name) {
          setUserName(user.user_metadata.full_name);
        } else if (user?.email) {
          setUserName(user.email.split('@')[0]);
        }

        // Fetch dashboard data
        const response = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Update state with fetched data
        setDocumentStats(data.document_stats);
        setRecentActivities(data.recent_activities);
        setDocumentsByTemplate(data.documents_by_template);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [router]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'creation':
        return (
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'update':
        return (
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </div>
        );
      case 'deletion':
        return (
          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  // Mock data for initial rendering or when API fails
  const mockStats: DocumentStats = {
    total: 12,
    completed: 8,
    processing: 3,
    failed: 1
  };

  const mockActivities: RecentActivity[] = [
    {
      id: '1',
      type: 'creation',
      document_name: 'O-1 Visa Application',
      timestamp: new Date().toISOString()
    },
    {
      id: '2',
      type: 'update',
      document_name: 'Recommendation Letter',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: '3',
      type: 'deletion',
      document_name: 'Draft Application',
      timestamp: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  const mockTemplateData: DocumentByTemplate[] = [
    {
      template_name: 'O-1 Visa Application',
      count: 5,
      percentage: 41.7
    },
    {
      template_name: 'Recommendation Letter',
      count: 4,
      percentage: 33.3
    },
    {
      template_name: 'Support Documentation',
      count: 3,
      percentage: 25.0
    }
  ];

  // Use mock data if loading or error occurred
  const stats = documentStats.total > 0 ? documentStats : mockStats;
  const activities = recentActivities.length > 0 ? recentActivities : mockActivities;
  const templateData = documentsByTemplate.length > 0 ? documentsByTemplate : mockTemplateData;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Dashboard | O-1 Visa Automation</title>
        <meta name="description" content="Dashboard for your O-1 visa application documents" />
      </Head>

      <Navbar />
      <BackgroundEffects />

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header with greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {userName ? `Welcome, ${userName}` : 'Welcome to your Dashboard'}
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor your document status and recent activity
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Link href="/templates" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
              <path d="M3 8a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            New Document
          </Link>
          
          <Link href="/documents" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            View All Documents
          </Link>
        </div>

        {/* Stats overview */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Total Documents
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {stats.total}
              </dd>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Completed
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-green-600">
                {stats.completed}
              </dd>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Processing
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-blue-600">
                {stats.processing}
              </dd>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Failed
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-red-600">
                {stats.failed}
              </dd>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent activity */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="p-6 text-red-600">
                  <p>Error loading activity data: {error}</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No recent activity</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {activities.map((activity) => (
                    <li key={activity.id} className="px-6 py-4">
                      <div className="flex items-center space-x-4">
                        {getActivityIcon(activity.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activity.document_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {activity.type === 'creation' ? 'Created' : 
                             activity.type === 'update' ? 'Updated' : 'Deleted'}
                          </p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(activity.timestamp)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <Link href="/documents" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  View all documents →
                </Link>
              </div>
            </div>
          </div>

          {/* Document distribution by template */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Documents by Template</h2>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="p-6 text-red-600">
                  <p>Error loading template data: {error}</p>
                </div>
              ) : templateData.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No documents created yet</p>
                </div>
              ) : (
                <div className="px-6 py-4">
                  {templateData.map((item, i) => (
                    <div key={i} className="mb-4 last:mb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900">{item.template_name}</span>
                        <span className="text-sm text-gray-500">{item.count} ({item.percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <Link href="/templates" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  View all templates →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 