import React, { useEffect, useState } from 'react'
import { supabase } from '../config/supabase'
import { useRouter } from 'next/router'

export default function Dashboard() {
  console.log('React version:', React.version)
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    console.log('Dashboard: Setting up auth state change listener');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'Session:', session);
        
        if (session?.user) {
          console.log('User is authenticated:', session.user.email);
          
          // Check if user has already uploaded required documents
          const checkDocuments = async () => {
            console.log('Checking for user documents...');
            
            const { data: documents, error } = await supabase
              .from('user_documents')
              .select('*')
              .eq('user_id', session.user.id)
              .single();

            if (error) {
              console.error('Error fetching documents:', error);
            }

            console.log('Documents found:', documents);

            if (!documents || !documents.resume) {
              console.log('No resume found, redirecting to document collection');
              router.push('/document-collection');
            } else {
              console.log('Resume found, setting user state');
              setUser(session.user);
            }
          };

          try {
            await checkDocuments();
          } catch (error) {
            console.error('Error in checkDocuments:', error);
          }
        } else {
          console.log('No session, redirecting to auth page');
          router.push('/auth');
        }
      }
    )

    return () => {
      console.log('Cleaning up auth subscription');
      subscription?.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (!user) return null

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Sign Out
        </button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl mb-4">Welcome, {user.email}</h2>
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  )
}