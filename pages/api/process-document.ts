import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { textContent, docType } = req.body;

    if (!textContent || !docType) {
      return res.status(400).json({ error: 'Missing required fields: textContent or docType' });
    }

    // Construct the prompt based on document type
    let prompt = '';
    switch (docType) {
      case 'cv':
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

    prompt += `\n\nDocument content:\n${textContent}`;

    // Call OpenAI API
    console.log(`Sending request to OpenAI API for document type: ${docType}`);
    console.log('Prompt:', prompt);
    
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

    console.log('OpenAI API Response:', {
      id: completion.id,
      model: completion.model,
      usage: completion.usage,
      choices: completion.choices.map(choice => ({
        role: choice.message.role,
        content: choice.message.content?.substring(0, 100) + '...',
        finish_reason: choice.finish_reason
      }))
    });

    if (!completion.choices || completion.choices.length === 0) {
      console.error('No content returned from OpenAI API');
      return res.status(500).json({ error: 'No content returned from OpenAI API' });
    }

    const analysis = completion.choices[0].message.content;
    if (!analysis) {
      console.error('Empty content returned from OpenAI API');
      return res.status(500).json({ error: 'Empty content returned from OpenAI API' });
    }

    // Format the analysis to ensure consistent structure
    const formattedAnalysis = `
### Strengths
${extractSection(analysis, 'Strengths').map(item => `- ${item}`).join('\n')}

### Weaknesses
${extractSection(analysis, 'Weaknesses').map(item => `- ${item}`).join('\n')}

### Recommendations
${extractSection(analysis, 'Recommendations').map(item => `- ${item}`).join('\n')}
    `.trim();

    // Parse the formatted analysis
    const sections = {
      strengths: extractSection(formattedAnalysis, 'Strengths'),
      weaknesses: extractSection(formattedAnalysis, 'Weaknesses'),
      recommendations: extractSection(formattedAnalysis, 'Recommendations')
    };

    console.log('Formatted analysis:', formattedAnalysis);
    console.log('Parsed sections:', sections);

    return res.status(200).json({ 
      analysis: formattedAnalysis, 
      sections 
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return res.status(500).json({ error: 'Failed to process document' });
  }
}

// Helper function to extract a section from the analysis
function extractSection(analysis: string, sectionName: string): string[] {
  try {
    const lines = analysis.split('\n');
    const items: string[] = [];
    let inSection = false;
    
    // Normalize section name for comparison
    const normalizedSectionName = sectionName.toLowerCase().replace(':', '').trim();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for section start with hashtags
      if (line.startsWith('###')) {
        const sectionText = line.replace('###', '').trim().toLowerCase();
        if (sectionText.includes(normalizedSectionName)) {
          inSection = true;
        } else if (inSection) {
          // If we're already in a section and encounter a new section header, break
          break;
        }
        continue;
      }
      
      // Check for section start with colons
      if (line.toLowerCase().includes(normalizedSectionName + ':')) {
        inSection = true;
        continue;
      }
      
      // Check for next section start
      if (inSection && (
        line.toLowerCase().includes('strengths:') ||
        line.toLowerCase().includes('weaknesses:') ||
        line.toLowerCase().includes('recommendations:') ||
        line.startsWith('###')
      )) {
        // Only break if it's a different section
        const nextSection = line.toLowerCase().replace('###', '').replace(':', '').trim();
        if (!nextSection.includes(normalizedSectionName)) {
          break;
        }
      }
      
      // Add items that start with bullet points or numbers
      if (inSection && line && (
        line.startsWith('-') ||
        line.startsWith('•') ||
        line.startsWith('*') ||
        /^\d+\./.test(line)
      )) {
        const cleanedLine = line
          .replace(/^[-•*]\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .trim();
          
        if (cleanedLine) {
          items.push(cleanedLine);
        }
      }
    }
    
    return items;
  } catch (error) {
    console.error(`Error extracting section ${sectionName}:`, error);
    return [];
  }
} 