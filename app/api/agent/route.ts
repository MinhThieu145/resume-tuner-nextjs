import { NextRequest, NextResponse } from "next/server";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import dotenv from 'dotenv';
// Import directly from the utils folder
import { optimizeResumeBullets, BulletPointState } from "../../utils/resume-optimizer";

// Load environment variables if needed in a server context
if (process.env.NODE_ENV !== 'production') {
  // Load .env.local in development (in production, these should be set in the environment)
  // Note: Next.js automatically loads .env.local, so this is just for clarity
  dotenv.config({ path: '.env.local' });
}

// Resume bullet point tool implementation
const optimizeResume = tool(async ({ job }: { job: string }) => {
  console.log(`Optimizing resume bullet points for: ${job}`);
  
  try {
    // Call the optimizer function directly
    const result: BulletPointState = await optimizeResumeBullets(job);
    
    // Format the result in a readable way
    const bulletPoints = result.bullet_points.map((bp: string, i: number) => 
      `${i+1}. ${bp} ${result.grades[i] === 'pass' ? '✅' : '❌'}`
    ).join('\n\n');
    
    return `Here are optimized resume bullet points for the ${job} role:\n\n${bulletPoints}`;
  } catch (error) {
    console.error('Error calling resume optimizer:', error);
    return `Error optimizing resume: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}, {
  name: "optimize_resume",
  description: "Generate optimized resume bullet points for a specific job role.",
  schema: z.object({
    job: z.string().describe("The job role to generate bullet points for (e.g., 'Full Stack Developer', 'Data Scientist', etc.)")
  })
});

// Create a memory saver for persistence across requests
const checkpointer = new MemorySaver();

// Create the agent with the LLM and tools
const agent = createReactAgent({
  llm: new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-2024-08-06",
    temperature: 0.2
  }),
  tools: [optimizeResume],
  checkpointer
});

// POST endpoint to send messages to the agent
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { message, thread_id = "default" } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Invoke the agent with the user's message
    const result = await agent.invoke(
      {
        messages: [{
          role: 'user',
          content: message
        }]
      },
      {
        configurable: {
          thread_id: thread_id
        }
      }
    );

    // Extract the agent's response
    const agentMessage = result.messages[result.messages.length - 1];
    
    // Return the response
    return NextResponse.json({
      content: agentMessage.content,
      thread_id: thread_id
    });
  } catch (error) {
    console.error('Error processing agent request:', error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if the agent is running
export async function GET() {
  return NextResponse.json({
    status: "online",
    agent: "LangGraph React Agent",
    tools: ["optimize_resume"]
  });
}
