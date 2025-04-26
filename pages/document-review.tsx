import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import Head from 'next/head';
import { SharedStyles } from '../components/SharedStyles';
import { BackgroundEffects } from '../components/BackgroundEffects';
import Script from 'next/script';

// Define types that were previously imported from utils/documentProcessor
export interface FieldStats {
  total_fields: number;
  user_info_filled: number;
  percent_filled: number;
  N_A_per: number;      // Fields needed for personal info
  N_A_r: number;        // Fields needed for resume info
  N_A_rl: number;       // Fields needed for recommendation letters
  N_A_ar: number;       // Fields needed for awards/recognition
  N_A_p: number;        // Fields needed for publications
  N_A_ss: number;       // Fields needed for salary/success info
  N_A_pm: number;       // Fields needed for professional membership
  // Additional fields used in document-review.tsx
  na_extraordinary: number;  // Fields needed for extraordinary ability evidence
  na_recognition: number;    // Fields needed for recognition evidence
  na_publications: number;   // Fields needed for publications evidence
  na_leadership: number;     // Fields needed for leadership evidence
  na_contributions: number;  // Fields needed for contributions evidence
  na_salary: number;         // Fields needed for salary evidence
  na_success: number;        // Fields needed for success evidence
}

interface PriorityArea {
  key: string;
  label: string;
  value: number;
}

interface DocumentSummary {
  pages: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface DocumentSummaries {
  [key: string]: DocumentSummary;
}

interface PersonalInfo {
  name: string;
  phone: string;
  address: string;
  extraInfo: string;
}

// Function to parse document summaries (simplified version)
export function parseSummary(analysis: string): ParsedSummary {
  console.log('Parsing analysis:', analysis);
  
  const sections = {
    strengths: [] as string[],
    weaknesses: [] as string[],
    recommendations: [] as string[]
  };

  try {
    // Split the analysis into sections based on headers
    const sectionRegex = /(?:###\s*)?(?:Strengths|Weaknesses|Recommendations):/gi;
    const parts = analysis.split(sectionRegex);
    
    // Skip the first part (it's before any section header)
    for (let i = 1; i < parts.length; i++) {
      const sectionContent = parts[i].trim();
      
      // Determine which section this is based on the previous header
      let currentSection: 'strengths' | 'weaknesses' | 'recommendations' | null = null;
      const prevHeader = analysis.substring(0, analysis.indexOf(parts[i])).match(sectionRegex);
      
      if (prevHeader) {
        const headerText = prevHeader[prevHeader.length - 1].toLowerCase();
        if (headerText.includes('strengths')) {
          currentSection = 'strengths';
        } else if (headerText.includes('weaknesses')) {
          currentSection = 'weaknesses';
        } else if (headerText.includes('recommendations')) {
          currentSection = 'recommendations';
        }
      }
      
      if (currentSection) {
        // Split the section content by [SEP] markers
        const bulletPoints = sectionContent.split('[SEP]');
        
        // Process each bullet point
        for (const bulletPoint of bulletPoints) {
          const cleanedPoint = bulletPoint
            .replace(/^\[|\]$/g, '') // Remove square brackets if present
            .trim();
            
          if (cleanedPoint) {
            sections[currentSection].push(cleanedPoint);
          }
        }
      }
    }

    console.log('Parsed sections:', sections);

    return {
      strengths: sections.strengths,
      weaknesses: sections.weaknesses,
      recommendations: sections.recommendations,
      hasAttemptedReparse: false
    };
  } catch (error) {
    console.error('Error parsing summary:', error);
    return {
      strengths: [],
      weaknesses: [],
      recommendations: [],
      hasAttemptedReparse: false
    };
  }
}

interface DocumentInfo {
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  fileType: string;
  summary?: string;
}

interface ParsedSummary {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  hasAttemptedReparse: boolean;
}

// Helper function to safely extract document summary from API response
function getDocumentSummaryFromApi(data: any, documentType: string): ParsedSummary | null {
  if (!data?.document_summaries?.[documentType]) {
    console.log('No summary found for document type:', documentType);
    return null;
  }

  const summary = data.document_summaries[documentType];
  console.log('Found summary for', documentType, ':', summary);

  // Direct approach - if arrays are present and have content
  if (Array.isArray(summary.strengths) && summary.strengths.length > 0) {
    console.log('Using provided arrays from API data');
    return {
      strengths: summary.strengths,
      weaknesses: Array.isArray(summary.weaknesses) ? summary.weaknesses : [],
      recommendations: Array.isArray(summary.recommendations) ? summary.recommendations : [],
      hasAttemptedReparse: false
    };
  }
  
  // Parse from summary text if arrays are empty but summary text exists
  if (typeof summary.summary === 'string' && summary.summary.trim()) {
    console.log('Parsing from summary text');
    return parseSummary(summary.summary);
  }

  console.log('No usable data found in API response for', documentType);
  return null;
}

function SummarySection({ title, items, colorClass }: { 
  title: string; 
  items: string[];
  colorClass: 'green' | 'red' | 'blue';
}) {
  console.log(`Rendering ${title} section with ${items.length} items:`, items);
  
  return (
    <div className="summary-section bg-slate-800/40 p-4 rounded-lg border border-slate-700/30 hover:border-primary-500/30 transition-colors duration-300 group">
      <h4 className={`summary-title text-lg font-medium text-white mb-3 flex items-center ${
        colorClass === 'green' ? 'text-emerald-400' : 
        colorClass === 'red' ? 'text-rose-400' : 
        'text-primary-400'
      }`}>
        <svg className={`w-4 h-4 mr-2 ${
          colorClass === 'green' ? 'text-emerald-400' : 
          colorClass === 'red' ? 'text-rose-400' : 
          'text-primary-400'
        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {colorClass === 'green' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : colorClass === 'red' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        {title}
      </h4>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li 
            key={index} 
            className="flex items-start gap-3 group-hover:bg-slate-700/30 p-3 rounded-lg transition-all duration-300 hover:transform hover:translate-x-1"
          >
            <div className={`flex-shrink-0 mt-1 ${
              colorClass === 'green' ? 'text-emerald-400' : 
              colorClass === 'red' ? 'text-rose-400' : 
              'text-primary-400'
            }`}>
              {colorClass === 'green' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
              ) : colorClass === 'red' ? (
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
                </svg>
              )}
            </div>
            <span className="text-slate-300 group-hover:text-white transition-colors duration-300 leading-relaxed">{item}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-slate-500 italic p-3 flex items-center justify-center">
            <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No items found.
          </li>
        )}
      </ul>
    </div>
  );
}

// Remove the custom Google Places API type declarations since we're using @types/google.maps
declare global {
  interface Window {
    google: any; // Using any to avoid type conflicts
    initializeGooglePlaces: () => void;
  }
}

// Modified StatsSection component to focus on O-1 criteria
function StatsSection({ stats, filledPdfUrl, apiResponseData, personalInfo }: { 
  stats: FieldStats, 
  filledPdfUrl: string | null,
  apiResponseData?: any,
  personalInfo: PersonalInfo
}) {
  const router = useRouter();
  
  // Check which personal info fields are missing
  const missingPersonalInfoFields: string[] = [];
  if (!personalInfo.name) missingPersonalInfoFields.push('Full Name');
  if (!personalInfo.phone) missingPersonalInfoFields.push('Phone Number');
  if (!personalInfo.address) missingPersonalInfoFields.push('Address');
  
  const hasMissingPersonalInfo = missingPersonalInfoFields.length > 0;

  // Ensure we have valid stats object with fallbacks for any missing properties
  const safeStats: FieldStats = {
    total_fields: stats.total_fields,
    user_info_filled: stats.user_info_filled,
    percent_filled: stats.percent_filled,
    N_A_per: stats.N_A_per,
    N_A_r: stats.N_A_r,
    N_A_rl: stats.N_A_rl,
    N_A_ar: stats.N_A_ar,
    N_A_p: stats.N_A_p,
    N_A_ss: stats.N_A_ss,
    N_A_pm: stats.N_A_pm,
    na_extraordinary: stats.na_extraordinary,
    na_recognition: stats.na_recognition,
    na_publications: stats.na_publications,
    na_leadership: stats.na_leadership,
    na_contributions: stats.na_contributions,
    na_salary: stats.na_salary,
    na_success: stats.na_success
  };

  // Calculate application score from API data or derive from completion percentage
  const applicationScore = apiResponseData?.completion_score || Math.round(safeStats.percent_filled / 10);
  
  // Determine color gradient based on score
  const getScoreColorGradient = (score: number) => {
    if (score <= 3) return { start: '#EF4444', end: '#F87171' }; // Red gradient for low scores
    if (score <= 6) return { start: '#F59E0B', end: '#FBBF24' }; // Amber gradient for medium scores
    return { start: '#10B981', end: '#34D399' };                  // Green gradient for high scores
  };
  
  const scoreColors = getScoreColorGradient(applicationScore);
  
  // Calculate missing fields total
  const totalMissingFields = safeStats.N_A_per + safeStats.N_A_r + safeStats.N_A_rl + 
    safeStats.N_A_ar + safeStats.N_A_p + safeStats.N_A_ss + safeStats.N_A_pm;

  return (
    <div className="stats-container">
      <h3 className="stats-title">O-1 Petition Strength Analysis</h3>
      
      <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 mb-6">
        <h4 className="text-xl font-semibold text-white mb-4">Application Score</h4>
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="relative w-40 h-40 mb-6 md:mb-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle 
                cx="50" 
                cy="50" 
                r="45" 
                fill="none" 
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth="10" 
              />
              {/* Score indicator circle with dynamic gradient */}
              <circle 
                cx="50" 
                cy="50" 
                r="45" 
                fill="none" 
                stroke="url(#scoreGradient)"
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - applicationScore / 10)}`}
                strokeLinecap="round"
              />
              {/* Dynamic gradient definition */}
            <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={scoreColors.start} />
                  <stop offset="100%" stopColor={scoreColors.end} />
              </linearGradient>
            </defs>
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-3xl font-bold text-white">{applicationScore}</div>
              <div className="text-sm text-slate-400">out of 10</div>
        </div>
      </div>

          <div className="w-full md:w-3/5 bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
            <h5 className="text-primary-300 font-medium mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Missing Fields Overview
            </h5>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/30">
              {/* Missing fields indicators with visual status indicators */}
              {[
                { 
                  label: 'Personal Information', 
                  value: safeStats.N_A_per, 
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )
                },
                { 
                  label: 'Resume Details', 
                  value: safeStats.N_A_r, 
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )
                },
                { 
                  label: 'Recommendation Letters', 
                  value: safeStats.N_A_rl, 
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )
                },
                { 
                  label: 'Awards & Recognition', 
                  value: safeStats.N_A_ar, 
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  )
                },
                { 
                  label: 'Publications', 
                  value: safeStats.N_A_p, 
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  )
                },
                { 
                  label: 'Salary & Success', 
                  value: safeStats.N_A_ss, 
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                },
                { 
                  label: 'Professional Membership', 
                  value: safeStats.N_A_pm, 
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )
                }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-700/30 transition-colors duration-200">
                  <div className="flex items-center">
                    <span className={`mr-2 ${
                      item.value > 3 ? 'text-red-400' : 
                      item.value > 0 ? 'text-amber-400' : 
                      'text-green-400'
                    }`}>{item.icon}</span>
                    <span className="text-slate-300">{item.label}</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.value > 3 ? 'bg-red-500/20 text-red-400' : 
                      item.value > 0 ? 'bg-amber-500/20 text-amber-400' : 
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {item.value > 0 ? `${item.value} missing` : 'Complete'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t border-slate-700/30 flex justify-between items-center">
              <span className="text-slate-400 text-sm">Total Missing Fields:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                totalMissingFields > 10 ? 'bg-red-500/20 text-red-400' : 
                totalMissingFields > 5 ? 'bg-amber-500/20 text-amber-400' : 
                'bg-green-500/20 text-green-400'
              }`}>
                {totalMissingFields}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* New Critical Issues Section */}
      {totalMissingFields > 0 && (
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h4 className="text-xl font-semibold text-white">Critical Issues</h4>
          </div>
          
          <div className="space-y-4">
            {/* Critical sections that need attention */}
            {[
               { 
                name: 'Personal Information', 
                criticalThreshold: 3,
                value: safeStats.N_A_per,
                icon: '👤',
                importance: 'High priority - required for O-1 eligibility',
                tip: 'Include personal information, including name, address, email, and phone number'
              },
              { 
                name: 'Resume/CV', 
                criticalThreshold: 4,
                value: safeStats.N_A_r,
                icon: '📄',
                importance: 'High priority - required for O-1 eligibility',
                tip: 'Include all relevant work experience, education, and skills'
              },
              
              { 
                name: 'Awards & Recognition', 
                criticalThreshold: 3,
                value: safeStats.N_A_ar,
                icon: '🏆',
                importance: 'High priority - required for O-1 eligibility',
                tip: 'Include major awards, recognition, and press coverage'
              },
              { 
                name: 'Publications', 
                criticalThreshold: 2,
                value: safeStats.N_A_p,
                icon: '📚',
                importance: 'Key evidence for extraordinary ability',
                tip: 'Include all published work, with proper citations'
              },
              { 
                name: 'Recommendation Letters', 
                criticalThreshold: 1,
                value: safeStats.N_A_rl,
                icon: '✉️',
                importance: 'Essential validation from industry experts',
                tip: 'Secure letters from prominent individuals in your field'
              },
              { 
                name: 'Salary Evidence', 
                criticalThreshold: 1,
                value: safeStats.N_A_ss,
                icon: '💰',
                importance: 'Required for O-1 eligibility',
                tip: 'Provide evidence of your salary or compensation'
              },
              { 
                name: 'Professional Memberships', 
                criticalThreshold: 1,
                value: safeStats.N_A_pm,
                icon: '🔖',
                importance: 'Essential for O-1 eligibility',
                tip: 'Include proof of membership in professional organizations'
              }

            ]
            .filter(section => section.value >= section.criticalThreshold)
            .map(section => (
              <div key={section.name} className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-red-500/20 rounded-full p-2 mr-3">
                    <span className="text-xl">{section.icon}</span>
                  </div>
                  <div>
                    <h5 className="text-lg font-medium text-red-300 flex items-center">
                      {section.name}
                      <span className="ml-2 px-2 py-0.5 bg-red-500/30 text-red-200 text-xs rounded-full">
                        {section.value} missing
                      </span>
                    </h5>
                    <p className="text-slate-300 text-sm mt-1">{section.importance}</p>
                    <div className="mt-2 bg-slate-800/50 rounded p-3 text-slate-300 text-sm">
                      <span className="font-medium text-primary-300">Tip:</span> {section.tip}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Show if no critical issues */}
            {![safeStats.N_A_ar >= 3, safeStats.N_A_p >= 2, safeStats.N_A_rl >= 1, safeStats.N_A_per >= 3, safeStats.N_A_r >= 3, safeStats.N_A_ss >= 1, safeStats.N_A_pm >= 1].some(Boolean) && (
              <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4 text-center">
                <div className="flex justify-center mb-2">
                  <div className="bg-green-500/20 rounded-full p-2">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h5 className="text-lg font-medium text-green-300">No Critical Issues Found</h5>
                <p className="text-slate-300 text-sm mt-1">
                  You've addressed all the most critical sections for your O-1 petition!
                </p>
              </div>
                  )}
                </div>
              </div>
      )}

      {/* New Document Upload Section to Address Missing Fields */}
      <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 mb-6">
        <div className="flex items-center mb-4">
          <svg className="w-5 h-5 text-primary-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h4 className="text-xl font-semibold text-white">Upload Supporting Documents</h4>
            </div>
        
        <div className="space-y-6">
          <p className="text-slate-300 text-sm">
            Address your application's missing fields by uploading the necessary supporting documents.
          </p>
          
          {/* Personal Information Card */}
          <div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md bg-slate-800/80 border-primary-500/30 hover:border-primary-500/50 mb-6">
            <div className="flex items-start mb-3">
              <div className="flex-shrink-0 bg-primary-500/20 rounded-full p-2 mr-3 text-xl">
                👤
              </div>
              <div>
                <h5 className="font-medium text-primary-300 flex items-center">
                  Personal Information
                  {hasMissingPersonalInfo && (
                    <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">Required</span>
                  )}
                </h5>
                <p className="text-slate-400 text-sm mt-1">Your contact details for the O-1 application</p>
        </div>
      </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-lg">
              <div>
                <h6 className="text-sm font-medium text-slate-400 mb-1">Full Name</h6>
                <p className={`font-medium ${personalInfo.name ? 'text-white' : 'text-red-300'}`}>
                  {personalInfo.name || "Not provided"}
                </p>
              </div>
              
              <div>
                <h6 className="text-sm font-medium text-slate-400 mb-1">Phone Number</h6>
                <p className={`font-medium ${personalInfo.phone ? 'text-white' : 'text-red-300'}`}>
                  {personalInfo.phone || "Not provided"}
                </p>
              </div>
              
              <div>
                <h6 className="text-sm font-medium text-slate-400 mb-1">Address</h6>
                <p className={`font-medium ${personalInfo.address ? 'text-white' : 'text-red-300'}`}>
                  {personalInfo.address || "Not provided"}
                </p>
              </div>
              
              <div>
                <h6 className="text-sm font-medium text-slate-400 mb-1">Additional Info</h6>
                <p className="text-white font-medium">{personalInfo.extraInfo || "None provided"}</p>
              </div>
            </div>
            
            <div className="mt-3 text-right">
              <button 
                onClick={() => router.push('/document-collection')}
                className="text-primary-400 hover:text-primary-300 text-sm inline-flex items-center bg-primary-500/10 px-3 py-1 rounded transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Personal Information
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                type: 'awards',
                label: 'Awards & Recognition',
                description: 'Upload certificates, awards, or press mentions',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
                status: safeStats.N_A_ar > 3 ? 'critical' : safeStats.N_A_ar > 0 ? 'warning' : 'complete'
              },
              {
                type: 'publications',
                label: 'Publications',
                description: 'Upload published articles or papers',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                ),
                status: safeStats.N_A_p > 3 ? 'critical' : safeStats.N_A_p > 0 ? 'warning' : 'complete'
              },
              {
                type: 'recommendation',
                label: 'Recommendation Letters',
                description: 'Upload letters from experts in your field',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
                status: safeStats.N_A_rl > 3 ? 'critical' : safeStats.N_A_rl > 0 ? 'warning' : 'complete'
              },
              {
                type: 'resume',
                label: 'Resume/CV',
                description: 'Upload your detailed curriculum vitae',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                status: safeStats.N_A_r > 3 ? 'critical' : safeStats.N_A_r > 0 ? 'warning' : 'complete'
              },
              {
                type: 'salary',
                label: 'Salary Evidence',
                description: 'Upload salary slips or contracts',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                status: safeStats.N_A_ss > 3 ? 'critical' : safeStats.N_A_ss > 0 ? 'warning' : 'complete'
              },
              {
                type: 'membership',
                label: 'Professional Memberships',
                description: 'Upload proof of membership in professional organizations',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                ),
                status: safeStats.N_A_pm > 3 ? 'critical' : safeStats.N_A_pm > 0 ? 'warning' : 'complete'
              }
            ].map((doc) => (
              <div 
                key={doc.type}
                className={`border rounded-lg p-4 transition-all duration-300 hover:shadow-md ${
                  doc.status === 'critical' 
                    ? 'bg-red-900/20 border-red-800/30 hover:border-red-500/50' 
                    : doc.status === 'warning'
                      ? 'bg-amber-900/20 border-amber-800/30 hover:border-amber-500/50'
                      : 'bg-green-900/20 border-green-800/30 hover:border-green-500/50'
                }`}
              >
                <div className="flex items-start mb-3">
                  <div className={`flex-shrink-0 rounded-full p-2 mr-3 ${
                    doc.status === 'critical' 
                      ? 'bg-red-500/20 text-red-400' 
                      : doc.status === 'warning'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-green-500/20 text-green-400'
                  }`}>
                    {doc.icon}
              </div>
                  <div>
                    <h5 className={`font-medium ${
                      doc.status === 'critical' 
                        ? 'text-red-300' 
                        : doc.status === 'warning'
                          ? 'text-amber-300'
                          : 'text-green-300'
                    }`}>
                      {doc.label}
                    </h5>
                    <p className="text-slate-400 text-sm mt-1">{doc.description}</p>
            </div>
        </div>
                
                <label 
                  className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    doc.status === 'critical' 
                      ? 'border-red-700/50 hover:bg-red-900/30' 
                      : doc.status === 'warning'
                        ? 'border-amber-700/50 hover:bg-amber-900/30'
                        : 'border-green-700/50 hover:bg-green-900/30'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg 
                      className={`w-8 h-8 mb-3 ${
                        doc.status === 'critical' 
                          ? 'text-red-500' 
                          : doc.status === 'warning'
                            ? 'text-amber-500'
                            : 'text-green-500'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-1 text-sm text-slate-400">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-500">PDF, DOC, DOCX (MAX. 10MB)</p>
      </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.doc,.docx" 
                    onChange={(e) => {
                      // Handle file upload functionality
                      console.log(`Uploading ${doc.type} document:`, e.target.files);
                      // Implement actual upload logic here
                    }}
                  />
                </label>
                
                {doc.status === 'complete' && (
                  <div className="flex items-center justify-center mt-3 text-green-400 bg-green-900/20 rounded-lg p-2">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">Complete</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-center mt-6">
            <button 
              className="bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-300 flex items-center"
              onClick={() => {
                // Handle document analysis
                console.log("Analyzing uploaded documents...");
                // Implement document analysis functionality
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Analyze Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Function to validate API response data
function validateApiResponseData(data: any): boolean {
  if (!data) {
    console.error("API response data is null or undefined");
    return false;
  }
  
  if (!data.document_summaries) {
    console.error("API response data is missing document_summaries");
    return false;
  }
  
  // Check if document_summaries is an object
  if (typeof data.document_summaries !== 'object') {
    console.error("API response data document_summaries is not an object");
    return false;
  }
  
  // Check if document_summaries has any keys
  const docTypes = Object.keys(data.document_summaries);
  if (docTypes.length === 0) {
    console.error("API response data document_summaries is empty");
    return false;
  }
  
  console.log("API response data document_summaries has the following document types:", docTypes);
  
  // Check if each document summary has the required fields or can be parsed
  let isValid = true;
  docTypes.forEach(docType => {
    const summary = data.document_summaries[docType];
    
    // First check if we have strengths/weaknesses/recommendations arrays
    const hasArrays = Array.isArray(summary.strengths) || 
                      Array.isArray(summary.weaknesses) || 
                      Array.isArray(summary.recommendations);
                      
    // If we don't have arrays, check if we at least have a summary text
    const hasSummary = typeof summary.summary === 'string' && summary.summary.trim() !== '';
    
    if (!hasArrays && !hasSummary) {
      console.error(`Document summary for ${docType} is missing both arrays and summary text`);
      isValid = false;
    }
    
    // Add structure to any document that's missing it 
    if (!Array.isArray(summary.strengths)) {
      console.warn(`Document summary for ${docType} is missing strengths array, adding empty array`);
      summary.strengths = [];
    }
    
    if (!Array.isArray(summary.weaknesses)) {
      console.warn(`Document summary for ${docType} is missing weaknesses array, adding empty array`);
      summary.weaknesses = [];
    }
    
    if (!Array.isArray(summary.recommendations)) {
      console.warn(`Document summary for ${docType} is missing recommendations array, adding empty array`);
      summary.recommendations = [];
    }
    
    // Try to parse from summary text if needed and arrays are empty
    if (hasSummary && 
        summary.strengths.length === 0 && 
        summary.weaknesses.length === 0 && 
        summary.recommendations.length === 0) {
      console.log(`Attempting to parse from summary text for ${docType}`);
      const parsed = parseSummary(summary.summary);
      
      // Update the document summary with parsed arrays
      if (parsed.strengths.length > 0 || parsed.weaknesses.length > 0 || parsed.recommendations.length > 0) {
        console.log(`Successfully parsed arrays for ${docType}`, parsed);
        summary.strengths = parsed.strengths;
        summary.weaknesses = parsed.weaknesses;
        summary.recommendations = parsed.recommendations;
      }
    }
  });
  
  return isValid;
}

// Loading Screen Component
function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/90 border border-slate-700/50 rounded-xl p-8 max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-600 border-t-primary-400 animate-spin mb-6"></div>
          <h3 className="text-xl font-semibold text-white mb-2">Processing Documents</h3>
          <p className="text-slate-300 text-sm">Please wait while we analyze your application documents...</p>
        </div>
      </div>
    </div>
  );
}

export default function DocumentReview() {
  const router = useRouter();
  const { userId, processed } = router.query;
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState<ParsedSummary>({
    strengths: [],
    weaknesses: [],
    recommendations: [],
    hasAttemptedReparse: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fieldStats, setFieldStats] = useState<FieldStats | null>(null);
  const [showLawyerForm, setShowLawyerForm] = useState(false);
  const [address, setAddress] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [matchedLawyer, setMatchedLawyer] = useState<any>(null);
  const [isMatchingLawyer, setIsMatchingLawyer] = useState(false);
  const [filledPdfUrl, setFilledPdfUrl] = useState<string | null>(null);
  const [apiResponseData, setApiResponseData] = useState<any>(null);
  const [canProceed, setCanProceed] = useState(false);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    phone: '',
    address: '',
    extraInfo: ''
  });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'strength-analysis': false,
    'document-summaries': false,
    'next-steps': false
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [priorityAreas, setPriorityAreas] = useState<PriorityArea[]>([
    { key: 'evidence', label: 'Evidence Collection', value: 3 },
    { key: 'documentation', label: 'Documentation', value: 2 },
    { key: 'expertise', label: 'Expertise Demonstration', value: 4 }
  ]);
  const [documentSummaries, setDocumentSummaries] = useState<DocumentSummaries>({});
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  
  // Default mock stats to use when no data is available
  const defaultStats: FieldStats = {
    total_fields: 45,
    user_info_filled: 20,
    percent_filled: 44.44,
    N_A_per: 4,
    N_A_r: 5,
    N_A_rl: 3,
    N_A_ar: 4,
    N_A_p: 5,
    N_A_ss: 4,
    N_A_pm: 2,
    na_extraordinary: 5,
    na_recognition: 4,
    na_publications: 5,
    na_leadership: 3,
    na_contributions: 4,
    na_salary: 4,
    na_success: 3
  };
  
  // Parse API response data from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && processed) {
      try {
        // Retrieve data from localStorage
        const apiResponseStr = localStorage.getItem('apiResponseData');
        const documentSummariesStr = localStorage.getItem('documentSummaries');
        
        if (!apiResponseStr) {
          console.warn("No API response data found in localStorage");
          return;
        }
        
        const parsedData = JSON.parse(apiResponseStr);
        console.log("Raw parsed API response data:", parsedData);
        
        // Ensure document_summaries exists
        if (!parsedData.document_summaries) {
          console.warn("API response missing document_summaries, creating empty object");
          parsedData.document_summaries = {};
        }
        
        // Ensure each document summary has the necessary structure
        if (typeof parsedData.document_summaries === 'object') {
          Object.keys(parsedData.document_summaries).forEach(docType => {
            const summary = parsedData.document_summaries[docType];
            console.log(`Document summary for ${docType}:`, summary);
            
            // If summary is missing or not an object, initialize it
            if (!summary || typeof summary !== 'object') {
              console.warn(`Invalid summary for ${docType}, creating empty object`);
              parsedData.document_summaries[docType] = {
                summary: '',
                strengths: [],
                weaknesses: [],
                recommendations: []
              };
              return; // Skip the rest for this docType
            }
            
            // Ensure we have the core summary text
            if (typeof summary.summary !== 'string') {
              console.warn(`Missing summary text for ${docType}`);
              summary.summary = '';
            }
            
            // Check and initialize arrays if needed
            if (!Array.isArray(summary.strengths)) {
              console.warn(`Missing strengths array for ${docType}`);
              summary.strengths = [];
            }
            
            if (!Array.isArray(summary.weaknesses)) {
              console.warn(`Missing weaknesses array for ${docType}`);
              summary.weaknesses = [];
            }
            
            if (!Array.isArray(summary.recommendations)) {
              console.warn(`Missing recommendations array for ${docType}`);
              summary.recommendations = [];
            }
            
            // If arrays are empty but we have a summary text, try to parse it
            if (summary.summary && 
                summary.strengths.length === 0 && 
                summary.weaknesses.length === 0 && 
                summary.recommendations.length === 0) {
              console.log(`Attempting to parse summary for ${docType}`);
              const parsed = parseSummary(summary.summary);
              if (parsed.strengths.length > 0 || parsed.weaknesses.length > 0 || parsed.recommendations.length > 0) {
                console.log(`Successfully parsed arrays for ${docType}`, parsed);
                summary.strengths = parsed.strengths;
                summary.weaknesses = parsed.weaknesses;
                summary.recommendations = parsed.recommendations;
              }
            }
            
            // Log the final arrays to verify they have content
            console.log(`${docType} final strengths:`, summary.strengths);
            console.log(`${docType} final weaknesses:`, summary.weaknesses);
            console.log(`${docType} final recommendations:`, summary.recommendations);
          });
        }
        
        // Validate the enhanced data
        const isValid = validateApiResponseData(parsedData);
        console.log("API response data validation result:", isValid);
        
        // Set the data even if not entirely valid (we've added fallbacks where needed)
        setApiResponseData(parsedData);
        console.log("Final API Response Data:", parsedData);
        
        // Set field stats from API response
        if (parsedData.field_stats) {
          console.log("Setting fieldStats from API response:", parsedData.field_stats);
          setFieldStats(parsedData.field_stats);
        }
        
        // Set document summaries directly from API response or from dedicated localStorage item
        if (documentSummariesStr) {
          try {
            const summaries = JSON.parse(documentSummariesStr);
            setDocumentSummaries(summaries);
      } catch (error) {
            console.error("Error parsing document summaries from localStorage:", error);
            
            // Fallback to the API response
            if (parsedData.document_summaries) {
              const summaries: DocumentSummaries = {};
              Object.entries(parsedData.document_summaries).forEach(([docType, summary]: [string, any]) => {
                summaries[docType] = {
                  pages: summary.pages || 0,
                  summary: summary.summary || '',
                  strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
                  weaknesses: Array.isArray(summary.weaknesses) ? summary.weaknesses : [],
                  recommendations: Array.isArray(summary.recommendations) ? summary.recommendations : []
                };
              });
              setDocumentSummaries(summaries);
            }
          }
        } else if (parsedData.document_summaries) {
          const summaries: DocumentSummaries = {};
          Object.entries(parsedData.document_summaries).forEach(([docType, summary]: [string, any]) => {
            summaries[docType] = {
              pages: summary.pages || 0,
              summary: summary.summary || '',
              strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
              weaknesses: Array.isArray(summary.weaknesses) ? summary.weaknesses : [],
              recommendations: Array.isArray(summary.recommendations) ? summary.recommendations : []
            };
          });
          setDocumentSummaries(summaries);
        }
      } catch (error) {
        console.error("Error parsing API response from localStorage:", error);
      }
    }
  }, [processed]);
  
  // Initialize Google Places Autocomplete
  const initializeAutocomplete = () => {
    if (typeof window !== 'undefined' && window.google && addressInputRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'formatted_address'],
      });

      if (autocompleteRef.current) {
        autocompleteRef.current.addListener('place_changed', () => {
          if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (place.formatted_address) {
              setAddress(place.formatted_address || '');
            }
          }
        });
      }

      // Add the custom styles for Google Places Autocomplete
      const styleElement = document.createElement('style');
      styleElement.textContent = `
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
      document.head.appendChild(styleElement);
    }
  };

  // Load Google Maps script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.initializeGooglePlaces = initializeAutocomplete;
        window.initializeGooglePlaces();
      };
      document.head.appendChild(script);
    } else if (typeof window !== 'undefined' && window.google) {
      initializeAutocomplete();
    }
    
    return () => {
      // Clean up if needed
    };
  }, []);
  
  // Fetch document data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No authenticated user found');
        }
        
        // Get documents from storage
        const { data: files, error: listError } = await supabase.storage
          .from('documents')
          .list(`${user.id}`);
          
        if (listError) {
          throw listError;
        }
        
        // Set the local O1 form path
        console.log("Setting local O1 form path...");
        setFilledPdfUrl('/data/o1-form-template-cleaned-filled.pdf');
        
        // Process files
        const docs: DocumentInfo[] = [];
        for (const file of files) {
          // Skip the filled O1 form in the document list
          if (file.name === 'filled-o1-form.pdf' || file.name === 'o1-form-template-cleaned-filled.pdf') continue;
          
          const docType = file.name.split('.')[0];
          const { data: urlData, error: urlError } = await supabase.storage
          .from('documents')
            .createSignedUrl(`${user.id}/${file.name}`, 3600);
            
          if (urlError) {
            console.error(`Error getting URL for ${file.name}:`, urlError);
            continue;
          }
          
          const summary = documentSummaries[docType]?.summary || '';
          
          docs.push({
              fileName: file.name,
            fileUrl: urlData.signedUrl,
            uploadedAt: file.created_at,
            fileType: docType,
            summary
          });
        }
        
        setDocuments(docs);
        
        // Here is the critical part: Directly initialize a document and its summary
        // First check if we have API response data
        if (apiResponseData && apiResponseData.document_summaries) {
          console.log("Found API response data:", apiResponseData);
          
          // Find a document with content
          const apiDocTypes = Object.keys(apiResponseData.document_summaries);
          for (const docType of apiDocTypes) {
            const apiSummary = apiResponseData.document_summaries[docType];
            const hasContent = (
              Array.isArray(apiSummary.strengths) && apiSummary.strengths.length > 0 ||
              Array.isArray(apiSummary.weaknesses) && apiSummary.weaknesses.length > 0 ||
              Array.isArray(apiSummary.recommendations) && apiSummary.recommendations.length > 0
            );
            
            if (hasContent) {
              console.log(`Found API document with content: ${docType}`);
              
              // Set it as selected document
              setSelectedDoc(docType);
              
              // Directly initialize parsed summary
              const directSummary: ParsedSummary = {
                strengths: Array.isArray(apiSummary.strengths) ? [...apiSummary.strengths] : [],
                weaknesses: Array.isArray(apiSummary.weaknesses) ? [...apiSummary.weaknesses] : [],
                recommendations: Array.isArray(apiSummary.recommendations) ? [...apiSummary.recommendations] : [],
                hasAttemptedReparse: true
              };
              
              console.log("Setting parsed summary directly:", directSummary);
              setParsedSummary(directSummary);
              break; // Found one document, stop searching
            }
          }
        }
        // Fall back to default document selection if no API data
        else if (docs.length > 0) {
          setSelectedDoc(docs[0].fileType);
          if (docs[0].summary) {
            setParsedSummary(parseSummary(docs[0].summary));
          }
        }
        
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Error loading your documents. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, apiResponseData, documentSummaries]);

  // Update parsed summary when selected document changes
  useEffect(() => {
    if (selectedDoc && documentSummaries[selectedDoc]) {
      const summary = documentSummaries[selectedDoc];
      setParsedSummary({
        strengths: summary.strengths,
        weaknesses: summary.weaknesses,
        recommendations: summary.recommendations,
        hasAttemptedReparse: false
      });
    }
  }, [selectedDoc, documentSummaries]);

  const handleLawyerMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      alert('Please enter your address');
      return;
    }
    
    try {
      setIsMatchingLawyer(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // Use local API route to avoid CORS issues
      const apiUrl = '/api/match-lawyer';
      
      console.log("Making API request to server:", apiUrl);
      console.log("Environment:", process.env.NODE_ENV);
      console.log("API URL from env:", process.env.NEXT_PUBLIC_API_URL);
      
      // Get uploaded documents from Supabase
      const { data: userDocs, error: userDocsError } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (userDocsError) {
        throw new Error('Error fetching user documents: ' + userDocsError.message);
      }
      
      // Create uploaded_documents object
      const uploaded_documents = {
        resume: userDocs?.resume || false,
        publications: userDocs?.publications || false,
        awards: userDocs?.awards || false,
        recommendation: userDocs?.recommendation || false,
        press: userDocs?.press || false,
        salary: userDocs?.salary || false,
        judging: userDocs?.judging || false,
        membership: userDocs?.membership || false,
        contributions: userDocs?.contributions || false
      };
      
      // Make API call to Flask backend for lawyer matching
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          uploaded_documents: uploaded_documents,
          document_summaries: documentSummaries,
          additional_info: {
            address: address,
            additional_comments: additionalComments
          }
        }),
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
      
      const matchedLawyerData = await response.json();
      console.log("API response:", matchedLawyerData);
      
      // Store the matched lawyer data and form data in localStorage
      localStorage.setItem('lawyerMatch', JSON.stringify(matchedLawyerData));
      localStorage.setItem('lawyerFormData', JSON.stringify({
        address: address,
        additional_comments: additionalComments
      }));
      
      // Redirect to the lawyer-search page
      router.push('/lawyer-search');
    } catch (error) {
      console.error('Error matching lawyer:', error);
      alert('Error finding a matching lawyer. Please try again.');
    } finally {
      setIsMatchingLawyer(false);
    }
  };

  const renderLawyerForm = () => (
    <div className="lawyer-form-container">
      <h3 className="lawyer-form-title">Find Your Immigration Expert</h3>
      <p className="lawyer-form-description">
        Enter your address and any additional information to help us match you with the best immigration lawyer for your O-1 visa case.
      </p>
      
      <form onSubmit={handleLawyerMatch} className="lawyer-form">
        <div className="form-group">
          <label htmlFor="address" className="form-label">Your Address</label>
            <input
            ref={addressInputRef}
            type="text"
              id="address"
            className="form-input"
            placeholder="Enter your address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

        <div className="form-group">
            <label htmlFor="additionalComments" className="form-label">Additional Information</label>
            <textarea
              id="additionalComments"
            className="form-textarea"
            placeholder="Any specific requirements or preferences for your immigration lawyer"
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            rows={4}
          />
          </div>
        
            <button
              type="submit"
          className="submit-button"
          disabled={isMatchingLawyer}
            >
          {isMatchingLawyer ? 'Finding Your Match...' : 'Find My Immigration Lawyer'}
            </button>
      </form>
    </div>
  );

  const renderMatchedLawyer = () => (
    <div className="matched-lawyer-container">
      <h3 className="matched-lawyer-title">Your Matched Immigration Expert</h3>
      
      <div className="lawyer-card">
        <div className="lawyer-header">
          <h4 className="lawyer-name">{matchedLawyer.name}</h4>
          <div className="match-score">
            <span className="match-score-value">{Math.round(matchedLawyer.match_score * 100)}%</span>
            <span className="match-score-label">Match</span>
          </div>
        </div>
        
        <div className="lawyer-details">
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Firm:</span>
            <span className="lawyer-detail-value">{matchedLawyer.firm}</span>
          </div>
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Law School:</span>
            <span className="lawyer-detail-value">{matchedLawyer.law_school}</span>
          </div>
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Bar Admissions:</span>
            <span className="lawyer-detail-value">{matchedLawyer.bar_admissions}</span>
          </div>
          <div className="lawyer-detail">
            <span className="lawyer-detail-label">Address:</span>
            <span className="lawyer-detail-value">{matchedLawyer.address}</span>
          </div>
        </div>
        
        <div className="lawyer-description">
          <p>{matchedLawyer.description}</p>
        </div>
        
        <div className="lawyer-actions">
          <button className="contact-button">Contact This Lawyer</button>
          <button 
            className="find-another-button"
            onClick={() => setShowLawyerForm(true)}
          >
            Find Another Match
          </button>
        </div>
      </div>
    </div>
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderDocumentSummary = () => {
    if (!selectedDoc || !documentSummaries[selectedDoc]) {
      return (
        <div className="summary-section">
          <p className="text-slate-500 italic">No document selected or summary available.</p>
        </div>
      );
    }

    const summary = documentSummaries[selectedDoc];
    return (
      <div className="space-y-6">
        <div className="summary-section">
          <h4 className="summary-title summary-title-blue">Document Overview</h4>
          <p className="summary-text">{summary.summary}</p>
          <p className="text-sm text-slate-500 mt-2">Pages: {summary.pages}</p>
        </div>
        <SummarySection title="Strengths" items={summary.strengths} colorClass="green" />
        <SummarySection title="Weaknesses" items={summary.weaknesses} colorClass="red" />
        <SummarySection title="Recommendations" items={summary.recommendations} colorClass="blue" />
      </div>
    );
  };

  // Load personal info from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedPersonalInfo = localStorage.getItem('personalInfo');
        if (storedPersonalInfo) {
          const parsedInfo = JSON.parse(storedPersonalInfo);
          setPersonalInfo(parsedInfo);
        }
      } catch (error) {
        console.error("Error loading personal info from localStorage:", error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <title>O-1 Document Review | Prometheus AI</title>
        <style>{SharedStyles}</style>
      </Head>
  
      <BackgroundEffects />
      
      {isLoading && <LoadingScreen />}
  
      <div className="min-h-screen bg-transparent p-6">
        <div className="max-w-6xl mx-auto pt-12">
          <h1 className="text-3xl font-bold text-gradient-primary mb-8 text-center md:text-left">O-1 Visa Document Review</h1>
          
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden shadow-lg mb-6">
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex gap-3">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                activeTab === 'overview' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Overview
            </button>
              </div>
          </div>
        </div>
        
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* O-1 Petition Strength Analysis Section */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden shadow-lg transition-all duration-300 hover:shadow-primary-500/10">
              <div 
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-700/30 transition-colors duration-300"
                onClick={() => toggleSection('strength-analysis')}
              >
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  O-1 Petition Strength Analysis
                </h2>
                <svg 
                  className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedSections['strength-analysis'] ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {expandedSections['strength-analysis'] && (
                <div className="p-4 border-t border-slate-700/50 animate-fadeIn">
                  <StatsSection 
                    stats={fieldStats || {
                      total_fields: 0,
                      user_info_filled: 0,
                      percent_filled: 0,
                      N_A_per: 0,
                      N_A_r: 0,
                      N_A_rl: 0,
                      N_A_ar: 0,
                      N_A_p: 0,
                      N_A_ss: 0,
                      N_A_pm: 0,
                      na_extraordinary: 0,
                      na_recognition: 0,
                      na_publications: 0,
                      na_leadership: 0,
                      na_contributions: 0,
                      na_salary: 0,
                      na_success: 0
                    }} 
                    filledPdfUrl={filledPdfUrl} 
                    apiResponseData={apiResponseData} 
                      personalInfo={personalInfo}
                  />
                  <div className="stats-container bg-transparent border-none shadow-none">
                      <div className="next-steps-section bg-gradient-to-br from-slate-800/60 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-6 rounded-xl">
                        <h4 className="text-xl font-semibold text-white mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                          O-1 Petition Roadmap
                      </h4>
                        
                        <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/30 hover:border-primary-500/30 transition-colors duration-300">
                          <div className="space-y-4">
                            {[
                              { label: 'Initial Qualification Analysis', completed: true, description: 'AI review of your qualifications against O-1 visa criteria' },
                              { label: 'Strengthen Evidence', active: true, description: 'Upload supporting documents to bolster your extraordinary ability case' },
                              { label: 'Immigration Expert Review', active: false, description: 'Professional legal review of your application package' },
                              { label: 'USCIS Submission', active: false, description: 'Filing your completed O-1 petition with USCIS' }
                            ].map((step, index) => (
                              <div key={index} className="flex items-start gap-4 p-3 bg-slate-700/20 rounded-lg hover:bg-slate-700/30 transition-all duration-300">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                  step.completed ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-400/30' : 
                                  step.active ? 'bg-primary-500/20 text-primary-400 ring-2 ring-primary-400/30' : 
                                  'bg-slate-700/30 text-slate-400 ring-2 ring-slate-500/20'
                                }`}>
                                  {step.completed ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                                  ) : (
                                    <span className="text-sm font-semibold">{index + 1}</span>
                                  )}
                                </div>
                                <div className="flex-grow">
                                  <h5 className={`font-medium mb-1 ${
                                    step.completed ? 'text-emerald-400' :
                                    step.active ? 'text-primary-300' : 'text-slate-300'
                                  }`}>{step.label}</h5>
                                  <p className="text-xs text-slate-400">{step.description}</p>
                                  
                                  {step.active && (
                                    <div className="mt-2 py-2 px-3 bg-primary-500/10 border border-primary-500/20 rounded text-xs text-primary-300">
                                      <span className="font-medium">Current focus:</span> Upload your supporting documents to strengthen your O-1 petition
                                </div>
                                  )}
                                  
                                  {step.completed && (
                                    <div className="mt-2 flex items-center">
                                      <svg className="w-4 h-4 text-emerald-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                      <span className="text-xs text-emerald-400">Completed</span>
                              </div>
                                  )}
                            </div>
                              </div>
                            ))}
                            </div>

                          <div className="mt-6 pt-4 border-t border-slate-700/30">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p>Complete each step to maximize your chances of O-1 visa approval</p>
                              </div>
                            </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Document Summaries Section */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden shadow-lg transition-all duration-300 hover:shadow-primary-500/10">
              <div 
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-700/30 transition-colors duration-300"
                onClick={() => toggleSection('document-summaries')}
              >
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Document Summaries
                </h2>
                <svg 
                  className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedSections['document-summaries'] ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {expandedSections['document-summaries'] && (
                <div className="p-4 border-t border-slate-700/50 animate-fadeIn">
                  {Object.keys(documentSummaries).length > 0 ? (
                    <div className="relative">
                      {/* Navigation controls */}
                      <div className="flex justify-between items-center mb-4">
                        <button 
                          onClick={() => setCurrentDocIndex(prev => 
                            prev > 0 ? prev - 1 : Object.keys(documentSummaries).length - 1
                          )}
                          className="bg-slate-800/60 hover:bg-slate-700/60 text-white p-2 rounded-full transition-colors duration-300"
                          aria-label="Previous document"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div className="text-center">
                          <span className="text-primary-400 font-medium">
                            {currentDocIndex + 1} / {Object.keys(documentSummaries).length}
                          </span>
                        </div>
                        
                        <button 
                          onClick={() => setCurrentDocIndex(prev => 
                            prev < Object.keys(documentSummaries).length - 1 ? prev + 1 : 0
                          )}
                          className="bg-slate-800/60 hover:bg-slate-700/60 text-white p-2 rounded-full transition-colors duration-300"
                          aria-label="Next document"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Document display */}
                      {Object.entries(documentSummaries).length > currentDocIndex && (
                        <div className="bg-slate-800/40 p-6 rounded-lg border border-slate-700/30 hover:border-primary-500/30 transition-colors duration-300 group">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-medium text-white flex items-center">
                              <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {Object.keys(documentSummaries)[currentDocIndex].charAt(0).toUpperCase() + 
                               Object.keys(documentSummaries)[currentDocIndex].slice(1)}
                            </h3>
                            <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
                              {Object.values(documentSummaries)[currentDocIndex].pages} pages
                            </span>
                          </div>
                          
                          <div className="space-y-6">
                            {Object.values(documentSummaries)[currentDocIndex].strengths.length > 0 && (
                              <SummarySection 
                                title="Strengths" 
                                items={Object.values(documentSummaries)[currentDocIndex].strengths} 
                                colorClass="green" 
                              />
                            )}
                            
                            {Object.values(documentSummaries)[currentDocIndex].weaknesses.length > 0 && (
                              <SummarySection 
                                title="Areas for Improvement" 
                                items={Object.values(documentSummaries)[currentDocIndex].weaknesses} 
                                colorClass="red" 
                              />
                            )}
                            
                            {Object.values(documentSummaries)[currentDocIndex].recommendations.length > 0 && (
                              <SummarySection 
                                title="Recommendations" 
                                items={Object.values(documentSummaries)[currentDocIndex].recommendations} 
                                colorClass="blue" 
                              />
                            )}
                            
                            {/* If no summaries available */}
                            {!Object.values(documentSummaries)[currentDocIndex].strengths.length && 
                             !Object.values(documentSummaries)[currentDocIndex].weaknesses.length && 
                             !Object.values(documentSummaries)[currentDocIndex].recommendations.length && (
                              <div className="text-center py-8">
                                <svg className="w-12 h-12 mx-auto text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-slate-400">No detailed analysis available for this document.</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Document pagination indicators */}
                          <div className="flex justify-center mt-6 space-x-1">
                            {Object.keys(documentSummaries).map((_, index) => (
                              <button 
                                key={index}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                  index === currentDocIndex 
                                    ? 'bg-primary-400 w-4' 
                                    : 'bg-slate-600 hover:bg-slate-500'
                                }`}
                                onClick={() => setCurrentDocIndex(index)}
                                aria-label={`Go to document ${index + 1}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-800/40 rounded-lg border border-slate-700/30">
                      <svg className="w-12 h-12 mx-auto text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <h3 className="text-xl font-medium text-white mb-2">No Documents Found</h3>
                      <p className="text-slate-400 max-w-md mx-auto">
                        You haven't uploaded any documents yet or document analysis is not available.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Next Steps Section */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden shadow-lg transition-all duration-300 hover:shadow-primary-500/10">
              <div 
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-700/30 transition-colors duration-300"
                onClick={() => toggleSection('next-steps')}
              >
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Next Steps
                </h2>
                <svg 
                  className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedSections['next-steps'] ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {expandedSections['next-steps'] && (
                <div className="p-4 border-t border-slate-700/50 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/30 hover:border-primary-500/30 transition-colors duration-300 group">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Connect with an Immigration Expert
                      </h4>
                      <p className="text-slate-300 mb-4">Get personalized guidance from an experienced immigration attorney who specializes in O-1 visas.</p>
                      <button 
                          onClick={() => router.push('/lawyer-search')}
                        className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Find a Lawyer
                      </button>
                    </div>
                    
                    <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/30 hover:border-primary-500/30 transition-colors duration-300 group">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                          View Portfolio
                      </h4>
                        <p className="text-slate-300 mb-4">Showcase your achievements and expertise to potential employers and immigration officers.</p>
                      <button 
                          onClick={() => {/* Portfolio page navigation will be added later */}}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                          Go to Portfolio
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
          {showLawyerForm && !matchedLawyer && renderLawyerForm()}
          {matchedLawyer && renderMatchedLawyer()}
              </div>
      </div>
    </div>
  );
}