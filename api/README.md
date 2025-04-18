# Python Development Server

This is a development server for handling API requests at `http://127.0.0.1:8000`. It routes requests to the appropriate Python API handlers as configured in your Next.js application.

## Setup

1. Make sure you have Python installed (Python 3.7+ recommended)
2. Install required dependencies:

```bash
cd api
pip install -r requirements.txt
pip install -r server_requirements.txt
```

## Running the Server

To start the development server:

```bash
cd api
python server.py
```

The server will start on http://127.0.0.1:8000 and will handle all API routes defined in your Next.js configuration:

- `/api/test`
- `/api/validate-documents`
- `/api/document-status/:user`
- `/api/match-lawyer`
- Any other `/api/*` paths

## How It Works

The server works by:

1. Receiving HTTP requests at http://127.0.0.1:8000
2. Determining which Python handler file should handle the request based on the URL path
3. Importing the appropriate handler module
4. Creating an instance of the handler class and forwarding the request

## Development Notes

- Make sure your `.env` file contains all necessary environment variables for API functionality
- Each API handler file must have a `handler` class that extends `BaseHTTPRequestHandler`
- The server automatically handles CORS headers for cross-origin requests
- All API requests should go through your Next.js application, which will proxy them to this server during development
