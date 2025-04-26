import { NextRequest, NextResponse } from "next/server";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import dotenv from 'dotenv';

// Load environment variables if needed in a server context
if (process.env.NODE_ENV !== 'production') {
  // Load .env.local in development (in production, these should be set in the environment)
  // Note: Next.js automatically loads .env.local, so this is just for clarity
  dotenv.config({ path: '.env.local' });
}

// Weather search tool implementation
const searchWeather = tool(async ({ location }: { location: string }) => {
  console.log(`Searching for weather in ${location}`);
  // In a real app, you would call a weather API here
  return `The search for weather in ${location} is currently unavailable. Please try again later.`;
}, {
  name: "weather_search",
  description: "Get the current weather.",
  schema: z.object({
    location: z.string().describe("The location to search for weather")
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
  tools: [searchWeather],
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
    tools: ["weather_search"]
  });
}
