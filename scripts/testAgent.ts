import {createReactAgent} from "@langchain/langgraph/prebuilt";
import {ChatOpenAI} from "@langchain/openai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// import memory from langgraph
import { MemorySaver } from "@langchain/langgraph";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(rootDir, '.env.local') });

// import tools from langchain 
import {tool} from "@langchain/core/tools";

// import zod library
import {z} from "zod";
import { threadId } from "worker_threads";



// implement a search tool
const searchWeather = tool(async ({location}: {location: string}) => {

    console.log(`Searching for weather in ${location}`);
    return `The search for weather in ${location} is currently unavailable. Please try again later.`
}, {
    name: "weather_search", // do not have spaces in the name
    description: "Get the current weather.",
    schema: z.object({
        location: z.string().describe("The location to search for weather")
    })
})


// implement the memory saver
const checkpointer = new MemorySaver();


// create agent
const agent = createReactAgent({
    llm: new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: "gpt-4o-2024-08-06",
        temperature: 0.2
    }),
    tools: [searchWeather],
    checkpointer
});

// Main function to run the agent
async function runAgent() {
    try {
        // run agent
        const result = await agent.invoke(
            {
            messages: [{
                role: 'user',
                content: 'Hello, how are you? What is the weather like in New York?'
                }]
            },
            
            // pass the thread ID (for the memory saving stuff) to the agent
            {
                configurable: {
                    thread_id: "test"
                }
            }
        );

        console.log(result.messages[result.messages.length - 1].content);

        // a follow up question
        const followUpResult = await agent.invoke(
            {
                messages: [{
                    role: 'user',
                    content: 'What is the city we just searched for weather in? Do we get the result'
                }]
            },

            // pass the thread ID (for the memory saving stuff) to the agent
            {
                configurable: {
                    thread_id: "test"
                }
            }
        );

        console.log(followUpResult.messages[followUpResult.messages.length - 1].content);

    } catch (error) {
        console.error('Error running agent:', error);
    }
}

// Execute the function
runAgent();
