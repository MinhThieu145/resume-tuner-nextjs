import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// LlamaParse API configuration
const API_CONFIG = {
  // We'll try both the v1 endpoint and the legacy endpoint
  ENDPOINTS: {
    V1: 'https://api.cloud.llamaindex.ai/api/v1/parsing/upload',
    LEGACY: 'https://api.cloud.llamaindex.ai/api/parsing/upload'
  },
  MAX_RETRIES: 60, // Maximum number of retries (3 minutes with 3-second intervals)
  POLLING_INTERVAL: 3000 // 3 seconds between polling
};

// Supported result types
type ResultType = 'markdown' | 'text' | 'json';

// Function to save file to temporary location
async function saveFileToDisk(formData: FormData): Promise<{ filePath: string, fileName: string, fileType: string }> {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file uploaded');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Create a temporary file path
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `${uuidv4()}-${file.name}`);
  
  // Write the file to disk
  fs.writeFileSync(filePath, buffer);
  
  return {
    filePath,
    fileName: file.name,
    fileType: file.type || 'application/pdf'
  };
}

export async function POST(request: NextRequest) {
  let filePath: string | null = null;
  
  try {
    // Get the query parameters
    const url = new URL(request.url);
    const resultType = (url.searchParams.get('resultType') || 'markdown') as ResultType;
    
    // Validate result type
    if (!['markdown', 'text', 'json'].includes(resultType)) {
      return NextResponse.json(
        { error: 'Invalid result type. Supported types are: markdown, text, json' },
        { status: 400 }
      );
    }

    // Get the API key from environment variables
    console.log('Environment variables check:');
    console.log('LLAMA_CLOUD_API_KEY:', process.env.LLAMA_CLOUD_API_KEY ? `${process.env.LLAMA_CLOUD_API_KEY.substring(0, 6)}...` : 'Not found');
    console.log('LLAMA_API_KEY:', process.env.LLAMA_API_KEY ? `${process.env.LLAMA_API_KEY.substring(0, 6)}...` : 'Not found');
    
    const apiKey = process.env.LLAMA_CLOUD_API_KEY || process.env.LLAMA_API_KEY;
    console.log('API Key being used:', apiKey ? `${apiKey.substring(0, 6)}...` : 'No API key found');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LlamaParse API key not configured. Please set LLAMA_CLOUD_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    // Parse the FormData from the request
    const formData = await request.formData();
    
    // Check if file is included
    if (!formData.has('file')) {
      return NextResponse.json(
        { error: 'No file provided. Please upload a file with the key "file"' },
        { status: 400 }
      );
    }

    const fileInfo = await saveFileToDisk(formData);
    filePath = fileInfo.filePath;

    // Prepare the form data for LlamaParse API
    const apiFormData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer], { type: fileInfo.fileType });
    apiFormData.append('file', fileBlob, fileInfo.fileName);

    // Call LlamaParse API to parse the PDF
    console.log('Making API request to LlamaParse with:');
    console.log('- API Endpoint: https://api.cloud.llamaindex.ai/api/parsing/upload');
    console.log('- Authorization header structure:', `Bearer ${apiKey.substring(0, 6)}...`);
    console.log('- File name:', fileInfo.fileName);
    
    let response;
    try {
      response = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: apiFormData
      });

      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', JSON.stringify(Object.fromEntries([...response.headers.entries()])));

      if (!response.ok) {
        const errorData = await response.text();
        console.error('LlamaParse upload error details:', errorData);
        throw new Error(`Failed to upload file to LlamaParse: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError) {
      console.error('Fetch operation error:', fetchError);
      throw fetchError;
    }

    // Parse the response
    const uploadResult = await response.json();
    console.log('Upload result:', JSON.stringify(uploadResult));
    
    // LlamaParse API response may have the job ID in either 'job_id' or 'id' field
    const jobId = uploadResult.job_id || uploadResult.id;
    
    if (!jobId) {
      console.error('LlamaParse response does not contain job ID:', uploadResult);
      throw new Error('No job ID returned from LlamaParse');
    }

    console.log(`LlamaParse job created with ID: ${jobId}`);

    // Poll for job completion
    let jobResult;
    let isComplete = false;
    let retryCount = 0;
    const maxRetries = API_CONFIG.MAX_RETRIES;
    const timeoutSeconds = Math.floor((API_CONFIG.POLLING_INTERVAL * maxRetries) / 1000);
    
    console.log(`Starting polling with ${maxRetries} retries (${timeoutSeconds} seconds timeout)`);
    
    while (!isComplete && retryCount < maxRetries) {
      // Wait between polling attempts
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.POLLING_INTERVAL));
      retryCount++;
      
      // Use the same API endpoint version that worked during upload
      console.log(`Checking job status for ID: ${jobId}`);
      const statusEndpoint = `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`;
      console.log(`Status endpoint: ${statusEndpoint}`);
      
      const statusResponse = await fetch(
        statusEndpoint,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
        }
      );
      
      console.log('Status response:', statusResponse.status, statusResponse.statusText);
      
      if (!statusResponse.ok) {
        const errorData = await statusResponse.text();
        console.error(`Failed to check job status: ${statusResponse.status} ${statusResponse.statusText}`);
        console.error('Status error details:', errorData);
        throw new Error('Failed to check job status');
      }
      
      const statusResult = await statusResponse.json();
      console.log(`Job status [${retryCount}/${maxRetries}]:`, statusResult.status);
      console.log('Status result full details:', JSON.stringify(statusResult));
      
      // Check for either 'completed' or 'COMPLETED' (adapting to possible API variations)
      const statusValue = statusResult.status?.toLowerCase?.();
      if (statusValue === 'completed') {
        isComplete = true;
        
        // Get the result in the requested format
        const resultUrl = `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/${resultType}`;
        console.log(`Fetching results from: ${resultUrl}`);
        
        const resultResponse = await fetch(
          resultUrl,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            },
          }
        );
        
        console.log('Result response status:', resultResponse.status, resultResponse.statusText);
        
        if (!resultResponse.ok) {
          const errorData = await resultResponse.text();
          console.error(`Failed to get parsing results: ${resultResponse.status} ${resultResponse.statusText}`);
          console.error('Result error details:', errorData);
          throw new Error('Failed to get parsing results');
        }
        
        try {
          jobResult = await resultResponse.json();
          console.log('Result retrieved successfully:', typeof jobResult);
        } catch (e) {
          console.error('Error parsing result JSON:', e);
          throw new Error('Failed to parse result JSON');
        }
      } else if (statusValue === 'failed' || statusResult.error) {
        throw new Error(`Parsing job failed: ${statusResult.error || 'Unknown error'}`);
      }
      // If status is still 'processing', continue polling
    }

    if (!isComplete) {
      const timeoutSeconds = Math.floor((API_CONFIG.POLLING_INTERVAL * API_CONFIG.MAX_RETRIES) / 1000);
      throw new Error(`PDF parsing timed out after ${timeoutSeconds} seconds`);
    }

    return NextResponse.json({ result: jobResult });
  } catch (error) {
    console.error('PDF parsing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    // Clean up - remove temporary file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Temporary file removed: ${filePath}`);
      } catch (e) {
        console.error('Error removing temporary file:', e);
      }
    }
  }
} 