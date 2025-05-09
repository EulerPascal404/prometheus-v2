import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../config/supabase';
import { SharedStyles, LoadingSpinner } from './SharedStyles';
import { documentDataCache, documentPreviewCache, templateCache, fetchWithCache } from '../lib/cache';

interface Field {
  name: string;
  value: string;
  prediction?: string;
  confidence?: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  fields: Field[];
}

interface FormEditorProps {
  templateId?: string;
  documentId?: string;
  readOnly?: boolean;
  onSave?: (fields: Record<string, string>) => void;
}

export default function FormEditor({ templateId, documentId, readOnly = false, onSave }: FormEditorProps) {
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch template and fields - optimized with useCallback
  const fetchTemplateData = useCallback(async () => {
    if (!templateId) {
      setError("No template specified");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get authentication token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      
      const token = sessionData.session?.access_token;

      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      // Fetch template details with caching
      const templateData = await fetchWithCache(
        `template_${templateId}`,
        async () => {
          const response = await fetch(`/api/templates/${templateId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
              errorData?.detail || 
              `Failed to fetch template (${response.status}): ${response.statusText}`
            );
          }

          return response.json();
        },
        templateCache
      );
      
      setTemplate(templateData);

      // Fetch template fields with caching
      const fieldsData = await fetchWithCache(
        `template_fields_${templateId}`,
        async () => {
          const fieldsResponse = await fetch(`/api/templates/${templateId}/fields`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!fieldsResponse.ok) {
            const errorData = await fieldsResponse.json().catch(() => null);
            throw new Error(
              errorData?.detail || 
              `Failed to fetch template fields (${fieldsResponse.status}): ${fieldsResponse.statusText}`
            );
          }

          return fieldsResponse.json();
        },
        templateCache
      );
      
      // If we have a document ID, fetch the document's field values with caching
      if (documentId) {
        const documentData = await fetchWithCache(
          `document_${documentId}`,
          async () => {
            const documentResponse = await fetch(`/api/documents/${documentId}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (!documentResponse.ok) {
              const errorData = await documentResponse.json().catch(() => null);
              throw new Error(
                errorData?.detail || 
                `Failed to fetch document (${documentResponse.status}): ${documentResponse.statusText}`
              );
            }

            return documentResponse.json();
          },
          documentDataCache
        );
        
        // Merge document field values with template fields
        const mergedFields = fieldsData.map((field: Field) => ({
          ...field,
          value: documentData.field_values?.[field.name] || field.value || ''
        }));
        
        setFields(mergedFields);
        
        // Set preview URL from cache if available
        const cachedPreviewUrl = documentPreviewCache.get(`preview_${documentId}`);
        if (cachedPreviewUrl) {
          setPreviewUrl(cachedPreviewUrl);
        } else if (documentData.output_url) {
          setPreviewUrl(documentData.output_url);
          documentPreviewCache.set(`preview_${documentId}`, documentData.output_url);
        }
      } else {
        setFields(fieldsData);
      }
    } catch (err) {
      console.error("Error fetching template data:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [templateId, documentId]);

  // Fetch data on component mount or when dependencies change
  useEffect(() => {
    fetchTemplateData();
  }, [fetchTemplateData]);

  // Handle field value changes with validation
  const handleFieldChange = useCallback((index: number, value: string) => {
    if (readOnly) return;
    
    // Basic validation - remove error if field is filled
    const fieldName = fields[index].name;
    if (value.trim() && validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
    }
    
    setFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  }, [fields, readOnly, validationErrors]);

  // Validate form fields
  const validateFields = useCallback(() => {
    const errors: Record<string, string> = {};
    
    // Check for required fields (consider all fields as required for simplicity)
    fields.forEach((field, index) => {
      if (!field.value.trim()) {
        errors[field.name] = 'This field is required';
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [fields]);

  // Handle form submission with validation
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    // Validate form
    if (!validateFields()) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Get authentication token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      
      const token = sessionData.session?.access_token;

      if (!token) {
        setError("Authentication required");
        setSaving(false);
        return;
      }

      // Create field values object
      const fieldValues = fields.reduce((acc, field) => {
        acc[field.name] = field.value;
        return acc;
      }, {} as Record<string, string>);

      // If onSave callback is provided, use it
      if (onSave) {
        onSave(fieldValues);
        setSaving(false);
        return;
      }

      // Show preview loading state
      setPreviewLoading(true);

      // Submit to the API
      const response = await fetch('/api/documents/fill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          template_name: template?.name,
          field_values: fieldValues,
          autopredict: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.detail || 
          `Failed to save document (${response.status}): ${response.statusText}`
        );
      }

      const result = await response.json();
      
      // Update preview URL and cache it
      setPreviewUrl(result.output_url);
      if (result.output_url) {
        documentPreviewCache.set(`preview_${result.document_id}`, result.output_url);
      }
      
      // Store the document data in cache
      documentDataCache.set(`document_${result.document_id}`, result);
      
      // Store the document ID in state or redirect
      if (result.document_id && !documentId) {
        router.push(`/documents/${result.document_id}`);
      }
    } catch (err) {
      console.error("Error saving document:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setSaving(false);
      setPreviewLoading(false);
    }
  }, [fields, readOnly, template, documentId, router, onSave, validateFields]);

  // Handle auto-predict button click with error handling
  const handleAutoPredict = useCallback(async () => {
    if (readOnly) return;
    
    setLoading(true);
    setError(null);

    try {
      // Get authentication token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      
      const token = sessionData.session?.access_token;

      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      // Get field names that need prediction (empty values)
      const emptyFieldNames = fields
        .filter(field => !field.value)
        .map(field => field.name);

      if (emptyFieldNames.length === 0) {
        setLoading(false);
        return;
      }

      // Call predict-fields API
      const response = await fetch('/api/predict-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          field_names: emptyFieldNames
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.detail || 
          `Failed to predict field values (${response.status}): ${response.statusText}`
        );
      }

      const predictions = await response.json();
      
      // Update fields with predictions
      setFields(prev => prev.map(field => {
        if (emptyFieldNames.includes(field.name) && predictions[field.name]) {
          return {
            ...field,
            value: predictions[field.name].value,
            prediction: predictions[field.name].value,
            confidence: predictions[field.name].confidence
          };
        }
        return field;
      }));

      // Clear validation errors for fields that now have values
      setValidationErrors(prev => {
        const updated = { ...prev };
        emptyFieldNames.forEach(name => {
          if (predictions[name] && predictions[name].value) {
            delete updated[name];
          }
        });
        return updated;
      });
    } catch (err) {
      console.error("Error auto-predicting fields:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [fields, readOnly]);

  // Memoize the field list to prevent unnecessary re-renders
  const fieldElements = useMemo(() => {
    return fields.map((field, index) => (
      <div key={field.name} className="mb-4">
        <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
          {field.name}
          {field.prediction && (
            <span className="ml-2 text-xs text-blue-500">
              (Auto-predicted with {Math.round((field.confidence || 0) * 100)}% confidence)
            </span>
          )}
        </label>
        <div className="mt-1">
          <input
            type="text"
            name={field.name}
            id={field.name}
            value={field.value || ''}
            onChange={(e) => handleFieldChange(index, e.target.value)}
            disabled={readOnly}
            className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
              validationErrors[field.name] ? 'border-red-500' : ''
            } ${readOnly ? 'bg-gray-100' : ''}`}
          />
          {validationErrors[field.name] && (
            <p className="mt-1 text-xs text-red-500">{validationErrors[field.name]}</p>
          )}
        </div>
      </div>
    ));
  }, [fields, handleFieldChange, readOnly, validationErrors]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size={10} />
        <p className="mt-4 text-gray-500">Loading form...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading form</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
              <button 
                onClick={fetchTemplateData} 
                className="mt-2 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {documentId ? 'Edit Document' : 'Create New Document'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {fieldElements}
          
          {!readOnly && (
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size={4} color="white" />
                    <span className="ml-2">Saving...</span>
                  </>
                ) : (
                  'Save Document'
                )}
              </button>
              
              <button
                type="button"
                onClick={handleAutoPredict}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size={4} />
                    <span className="ml-2">Processing...</span>
                  </>
                ) : (
                  'Auto-predict Empty Fields'
                )}
              </button>
            </div>
          )}
        </form>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Document Preview</h3>
        
        {previewLoading ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg h-96">
            <LoadingSpinner size={10} />
            <p className="mt-4 text-gray-500">Generating preview...</p>
          </div>
        ) : previewUrl ? (
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <iframe 
              src={previewUrl} 
              className="w-full h-96"
              title="Document Preview"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg h-96">
            <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-500">
              {readOnly ? 'No preview available' : 'Save the document to see a preview'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 