import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { filename } = req.query;
  
  // Define the path where your files are stored
  const filePath = path.join(process.cwd(), 'public', 'files', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Get file stats
  const stat = fs.statSync(filePath);
  
  // Set appropriate headers
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Type', getContentType(filename));
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
}

// Helper function to determine content type
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}