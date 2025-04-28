import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Define the JSON schema for structured output
const resumeSchema = {
  type: "object",
  properties: {
    experiences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          position: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          location: { type: "string" },
          bulletPoints: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["company", "position", "bulletPoints"]
      }
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          date: { type: "string" },
          technologies: {
            type: "array",
            items: { type: "string" }
          },
          description: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["name", "description"]
      }
    },
    skills: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["experiences"]
};

/**
 * Extract resume information from text and convert to structured JSON
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables." },
        { status: 500 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Parse request body
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "A text field is required in the request body" },
        { status: 400 }
      );
    }

    // Call OpenAI API with structured output
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert resume parser. Extract work experiences, projects, and skills from the provided resume text. 
          Follow these guidelines:
          - For each experience, extract company name, position, dates, location, and bullet points
          - For each project, extract name, date, technologies used, and description points
          - Extract a comprehensive list of technical and soft skills
          - Maintain the original phrasing of bullet points where possible
          - If a field is clearly missing from the text, use empty strings or empty arrays
          - Make reasonable inferences about missing information but don't fabricate specific details
          
          Format your response following this JSON schema:
          ${JSON.stringify(resumeSchema, null, 2)}`
        },
        {
          role: "user", 
          content: text
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    // Parse the content string to JSON object and return the parsed resume data
    const content = response.choices[0].message.content || '{}';
    const parsedContent = JSON.parse(content);
    return NextResponse.json({
      data: parsedContent,
      usage: response.usage
    });
  } catch (error: any) {
    console.error("Error in resume-text-extract API:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to extract resume information",
        details: error.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler to check if the API is running and provide usage info
 */
export async function GET() {
  return NextResponse.json({
    status: "online",
    endpoint: "resume-text-extract",
    usage: "POST request with { text: 'your resume text here' }",
    description: "Extracts structured information from resume text using OpenAI"
  });
}
