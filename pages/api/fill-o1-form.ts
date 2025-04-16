import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to clean field names
function cleanFieldName(name: string): string {
  // Remove surrounding parentheses if present
  name = name.trim().replace(/^\((.*)\)$/, '$1');
  
  // Replace specific escape sequences
  name = name.replace(/\\137/g, '_');
  name = name.replace(/\\133[0-3]/g, '');
  
  // Remove any remaining non-alphanumeric characters
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

// Helper function to update progress in database
async function updateProgress(userId: string, status: string, progress: number) {
  await supabase
    .from('user_documents')
    .update({ processing_status: status, progress })
    .eq('user_id', userId);
}

// Function to read form fields from text files
async function readFormFields() {
  const separatedPagesDir = path.join(process.cwd(), 'separated_pages');
  const formFields: { [key: string]: string } = {};
  
  // Read all text files in the directory
  const files = fs.readdirSync(separatedPagesDir)
    .filter(file => file.endsWith('.txt'))
    .sort((a, b) => {
      const numA = parseInt(a.split('.')[0]);
      const numB = parseInt(b.split('.')[0]);
      return numA - numB;
    });

  for (const file of files) {
    const content = fs.readFileSync(path.join(separatedPagesDir, file), 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':').map(s => s.trim());
        if (key && value) {
          formFields[key] = value;
        }
      }
    }
  }
  
  return formFields;
}

// Function to generate form field values using OpenAI
async function generateFormFieldValues(documentSummaries: any, formFields: any) {
  const prompt = `You have been given a text file containing a form and a dictionary containing keys and possible options. You have also been given information about a user. Output the same dictionary but filled with the responses for an application for the user. It is very important that in the outputed dictionary, the keys are EXACTLY the same as the original keys. For select either yes or no, make sure to only check one of the boxes. Make sure written responses are clear, and detailed making a strong argument. For fields without enough information, fill N/A and specify the type: N/A_per = needs personal info, N/A_r = resume info needed, N/A_rl = recommendation letter info needed, N/A_p = publication info needed, N/A_ss = salary/success info needed, N/A_pm = professional membership info needed. Only fill out fields that can be entirely filled out with the user info provided, do not infer anything. Only output the dictionary. Don't include the word python or \`\`\`

Form Fields:
${JSON.stringify(formFields, null, 2)}

User Information:
${JSON.stringify(documentSummaries, null, 2)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert in O-1 visa applications. Extract and format information from document summaries to fill form fields."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
  });

  const content = response.choices[0].message.content || '{}';
  return JSON.parse(content);
}

// Main handler function
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId, documentSummaries } = req.body;

    if (!userId || !documentSummaries) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Update progress status
    await updateProgress(userId, 'preparing_pdf_fill', 70);

    // Read form fields from text files
    const formFields = await readFormFields();

    // Generate form field values using OpenAI
    const fieldValues = await generateFormFieldValues(documentSummaries, formFields);

    // Initialize field statistics
    const fieldStats = {
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
    };

    // Load the PDF template
    const templatePath = path.join(process.cwd(), 'public', 'o1-form-template.pdf');
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Fill form fields and update statistics
    for (const [fieldName, value] of Object.entries(fieldValues)) {
      const cleanedName = cleanFieldName(fieldName);
      try {
        // Try to get the field, handling both text fields and buttons
        let field: PDFTextField | PDFCheckBox | PDFRadioGroup | null = form.getTextField(cleanedName);
        if (!field) {
          field = form.getCheckBox(cleanedName);
        }
        if (!field) {
          field = form.getRadioGroup(cleanedName);
        }

        if (field) {
          const valueStr = String(value);
          
          // Handle different field types
          if (field instanceof PDFCheckBox) {
            // For checkboxes, check if the value is truthy
            if (['true', 'yes', 'y', '1'].includes(valueStr.toLowerCase())) {
              field.check();
            } else {
              field.uncheck();
            }
          } else if (field instanceof PDFRadioGroup) {
            // For radio buttons, set the selected option
            field.select(valueStr);
          } else if (field instanceof PDFTextField) {
            // For text fields
            field.setText(valueStr);
          }

          fieldStats.total_fields++;
          
          if (valueStr.startsWith('N/A')) {
            // Update N/A statistics
            if (valueStr.includes('N/A_per')) fieldStats.N_A_per++;
            if (valueStr.includes('N/A_r')) fieldStats.N_A_r++;
            if (valueStr.includes('N/A_rl')) fieldStats.N_A_rl++;
            if (valueStr.includes('N/A_ar')) fieldStats.N_A_ar++;
            if (valueStr.includes('N/A_p')) fieldStats.N_A_p++;
            if (valueStr.includes('N/A_ss')) fieldStats.N_A_ss++;
            if (valueStr.includes('N/A_pm')) fieldStats.N_A_pm++;
          } else {
            fieldStats.user_info_filled++;
            
            // Update specific field statistics
            if (cleanedName.includes('extraordinary')) fieldStats.na_extraordinary++;
            if (cleanedName.includes('recognition')) fieldStats.na_recognition++;
            if (cleanedName.includes('publications')) fieldStats.na_publications++;
            if (cleanedName.includes('leadership')) fieldStats.na_leadership++;
            if (cleanedName.includes('contributions')) fieldStats.na_contributions++;
            if (cleanedName.includes('salary')) fieldStats.na_salary++;
            if (cleanedName.includes('success')) fieldStats.na_success++;
          }
        }
      } catch (error) {
        console.error(`Error filling field ${cleanedName}:`, error);
      }
    }

    // Calculate completion percentage
    fieldStats.percent_filled = (fieldStats.user_info_filled / fieldStats.total_fields) * 100;

    // Save the filled PDF
    const filledPdfBytes = await pdfDoc.save();
    const filledPdfPath = path.join(process.cwd(), 'public', 'o1-form-template-cleaned-filled.pdf');
    fs.writeFileSync(filledPdfPath, filledPdfBytes);

    // Upload the filled PDF to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`${userId}/filled-o1-form.pdf`, filledPdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Error uploading filled PDF: ${uploadError.message}`);
    }

    // Get the public URL of the uploaded PDF
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(`${userId}/filled-o1-form.pdf`);

    // Update progress status
    await updateProgress(userId, 'completed', 100);

    return res.status(200).json({
      filledPdfUrl: publicUrl,
      fieldStats
    });

  } catch (error) {
    console.error('Error filling O1 form:', error);
    return res.status(500).json({ 
      message: 'Error filling O1 form',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 