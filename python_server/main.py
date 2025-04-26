from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, TypedDict, Annotated
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

# Load environment variables from .env file
load_dotenv()

# Get OpenAI API key from environment
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# Initialize FastAPI app
app = FastAPI(title="LangGraph Chat API")

# Add CORS middleware to allow requests from your Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request and response models
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    thread_id: Optional[str] = None

class ChatResponse(BaseModel):
    content: str
    thread_id: str

# Initialize the language model
model = ChatOpenAI(
    api_key=openai_api_key,
    model="gpt-3.5-turbo",
    temperature=0
)

# Define a simple chat function that uses the model directly
# This is a simplified approach without using LangGraph
async def process_chat(messages, thread_id="default"):
    # Convert messages to LangChain format
    lc_messages = []
    for msg in messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))
    
    # Call the model with the messages
    response = model.invoke(lc_messages)
    
    # Return the AI's response
    return {
        "content": response.content,
        "thread_id": thread_id
    }

# Define the chat endpoint
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # Process the chat request
    result = await process_chat(request.messages, request.thread_id or "default")
    
    # Return response
    return ChatResponse(
        content=result["content"],
        thread_id=result["thread_id"]
    )

# Run with: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
