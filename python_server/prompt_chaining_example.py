# prompt_chaining_example.py
#
# This script demonstrates Prompt Chaining: linking multiple prompts or LLM calls
# together, where the output of one step becomes the input to the next.
# This is a common pattern for building more complex workflows with LLMs.

import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# 1. Load environment variables and get the OpenAI API key
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# 2. Initialize the base LLM
llm = ChatOpenAI(
    api_key=openai_api_key,
    model="gpt-3.5-turbo",
    temperature=0.0
)

# 3. Define the first prompt: extract a topic from a question
first_prompt = """
Given the following question, extract the main topic in 3 words or less.
Question: {question}
Topic:
"""

# 4. Define the second prompt: generate a search query from a topic
second_prompt = """
You are a helpful assistant. Given the following topic, write a web search query that would help answer a user's question on this topic.
Topic: {topic}
Search Query:
"""

# 5. Prompt Chaining logic
#    Step 1: Ask the LLM to extract the topic
#    Step 2: Use the topic as input to generate a search query

def prompt_chain(question: str) -> dict:
    # Step 1: Extract topic
    step1_filled = first_prompt.format(question=question)
    topic = llm.invoke(step1_filled).content.strip()
    print(f"Step 1 - Extracted Topic: {topic}")

    # Step 2: Generate search query
    step2_filled = second_prompt.format(topic=topic)
    search_query = llm.invoke(step2_filled).content.strip()
    print(f"Step 2 - Search Query: {search_query}")

    return {
        "topic": topic,
        "search_query": search_query
    }

if __name__ == "__main__":
    # Example question
    user_question = "How does Calcium CT score relate to high cholesterol?"
    result = prompt_chain(user_question)
    print("\nFinal Output:")
    print(result)
