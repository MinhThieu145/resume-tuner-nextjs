import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { Graph, StateGraph } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

// ============================================================
// PART 1: DEFINE THE STATE SCHEMA
// ============================================================

// This defines what our state object looks like
// Similar to Python's "state_schema = {"messages": []}" 
const stateSchema = z.object({
  // An array of messages in the conversation
  messages: z.array(z.any())
});

// Define the type based on our schema
type State = z.infer<typeof stateSchema>;

// ============================================================
// PART 2: INITIALIZE THE MODEL
// ============================================================

// Create the language model
const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
  temperature: 0, // More deterministic outputs
});

// ============================================================
// PART 3: DEFINE THE MODEL NODE
// ============================================================

// This is our "model" node function
// It takes the current state, calls the LLM, and updates the state
async function modelNode(state: State): Promise<Partial<State>> {
  // Get the messages from the current state
  const { messages } = state;
  
  // Call the model with the current messages
  const response = await model.invoke(messages);
  
  // Return the updated messages array with the new response
  return {
    messages: [...messages, response]
  };
}

// ============================================================
// PART 4: BUILD THE GRAPH
// ============================================================

// Create a new state graph with our schema
const builder = new StateGraph<State>({
  channels: {
    messages: z.array(z.any())
  }
});

// Add the model node to the graph
builder.addNode("model", modelNode);

// Set the entry point - the graph will start at the model node
builder.setEntryPoint("model");

// Step 5: Compile the graph into an executor
// This turns your graph into a runnable agent function.
const executor = graph.compile();

// Step 6: Define the API route for POST requests
export async function POST(req: NextRequest) {
  // Parse the incoming JSON body (should have a 'messages' array)
  const { messages } = await req.json();

  // Convert the messages to LangChain's message format
  const lcMessages = messages.map((msg: any) =>
    msg.role === "user"
      ? new HumanMessage(msg.content)
      : new AIMessage(msg.content)
  );

  // Run the graph agent with the messages
  const result = await executor.invoke({ messages: lcMessages });

  // The last message in the array is the AI's reply
  const aiMessage = result.messages[result.messages.length - 1];

  // Return the AI's response as JSON
  return NextResponse.json({ content: aiMessage.content });
}
