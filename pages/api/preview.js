import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const filePath = path.join('./tmp', 'o1-form-template-cleaned-filled.pdf');

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found in /tmp');
  }

  try {
    // Read the file into a buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Set headers to serve as an inline PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');

    // Send the PDF
    res.send(fileBuffer);
  } catch (err) {
    console.error('Error reading PDF:', err);
    res.status(500).send('Failed to read PDF file');
  }
}
