# augmented_llm_example.py
#
# This script demonstrates the Augmented LLM pattern with structured 
# output and tool binding. We go through each step slowly, explaining 
# what each part means.

import os
from dotenv import load_dotenv  # load environment variables from a .env file
from pydantic import BaseModel, Field  # define schemas for structured output

from langchain_openai import ChatOpenAI  # the ChatOpenAI model class

# 1. Load environment variables and retrieve the OpenAI API key
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    # If the API key is missing, we cannot proceed
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# 2. Initialize the base LLM (ChatOpenAI)
#    - api_key: secret key for OpenAI
#    - model: GPT variant (e.g., gpt-3.5-turbo)
#    - temperature: randomness control (0.0 = deterministic)
llm = ChatOpenAI(
    api_key=openai_api_key,
    model="gpt-3.5-turbo",
    temperature=0.0
)

# 3. Define a Pydantic schema for structured output
#    Fields in this schema ensure the model returns data in this shape
class SearchQuery(BaseModel):
    search_query: str = Field(
        None, description="Query optimized for a web search"
    )
    justification: str = Field(
        None, description="Why this query is relevant to the user's request"
    )

# 4. Augment the LLM to produce structured output following our schema
#    `with_structured_output` wraps the model to enforce schema output
structured_llm = llm.with_structured_output(SearchQuery)

# 5. Invoke the augmented LLM with a human question
print("=== Structured Output Example ===")
question = "How does Calcium CT score relate to high cholesterol?"
response = structured_llm.invoke(question)
# Access the structured fields directly
print("search_query:", response.search_query)
print("justification:", response.justification)

# 6. Define a utility function (tool) that the LLM can call
#    Tools are standard Python functions matching a signature
#    The LLM can decide to call these instead of generating text

def multiply(a: int, b: int) -> int:
    """
    A simple tool that multiplies two integers and returns the result.
    """
    return a * b

# 7. Bind the tool(s) to the base LLM
#    `bind_tools` returns a wrapper that allows the model to call tools
llm_with_tools = llm.bind_tools([multiply])

# 8. Invoke the tool-augmented LLM with a prompt
print("\n=== Tool Binding Example ===")
tool_question = "What is 2 times 3?"
tool_result = llm_with_tools.invoke(tool_question)

# 9. Inspect the tool calls made by the LLM
#    `tool_calls` holds any tool invocation requests from the model
print("Tool calls:", tool_result.tool_calls)
