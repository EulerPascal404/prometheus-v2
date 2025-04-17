#!/usr/bin/env python
# -*- coding: utf-8 -*-

import base64
import json
import os
import sys
from importlib import import_module
from werkzeug.datastructures import Headers
from werkzeug.wrappers import Response

# Convert Vercel serverless request to WSGI format
def to_wsgi_environment(event):
    method = event.get('method', 'GET')
    body = event.get('body', '')
    path = event.get('path', '/')
    headers = event.get('headers', {})
    query = event.get('query', {})
    
    # Construct query string
    query_string = '&'.join([f"{k}={v}" for k, v in query.items()])
    
    environ = {
        'REQUEST_METHOD': method,
        'PATH_INFO': path,
        'QUERY_STRING': query_string,
        'CONTENT_LENGTH': str(len(body) if body else 0),
        'SERVER_NAME': 'vercel',
        'SERVER_PORT': '443',
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'https',
        'wsgi.input': io.BytesIO(body.encode('utf-8') if isinstance(body, str) else body),
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': False,
        'wsgi.run_once': False,
    }
    
    # Add headers
    for key, value in headers.items():
        key = key.upper().replace('-', '_')
        if key not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
            key = f'HTTP_{key}'
        environ[key] = value
    
    return environ

# Convert WSGI response to Vercel serverless response format
def from_wsgi_response(response):
    status_code = int(response.status.split(' ')[0])
    headers = dict(response.headers)
    body = b''.join(response.data).decode('utf-8')
    
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': body
    }

# Main handler function
def handler(event, context):
    from index import app as flask_app
    
    wsgi_environ = to_wsgi_environment(event)
    response = Response.from_app(flask_app, wsgi_environ)
    
    return from_wsgi_response(response)

# Missing import
import io 