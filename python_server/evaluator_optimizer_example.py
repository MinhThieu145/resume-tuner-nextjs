# evaluator_optimizer_example.py
#
# This script demonstrates an evaluator-optimizer workflow using LangGraph and LangChain.
# The workflow generates a joke, evaluates it, and (if needed) loops to improve the joke based on feedback.
# Each step is explained in detail for clarity and learning.

import os
from dotenv import load_dotenv
from typing_extensions import TypedDict, Literal
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

# 1. Load environment variables and initialize the LLM
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

llm = ChatOpenAI(
    api_key=openai_api_key,
    model="gpt-3.5-turbo",
    temperature=0.0
)

# 2. Define a schema for structured evaluation feedback using Pydantic
#    This ensures the evaluator's output always has the same fields and types
class Feedback(BaseModel):
    grade: Literal["funny", "not funny"] = Field(
        description="Decide if the joke is funny or not."
    )
    feedback: str = Field(
        description="If the joke is not funny, provide feedback on how to improve it."
    )

# 3. Wrap the LLM to always return structured feedback as a Feedback object
#    This makes evaluation results predictable and easy to use in code
#    (like a TypeScript type for LLM output)
evaluator = llm.with_structured_output(Feedback)

# 4. Define the workflow state (data passed between steps)
#    This is like a shared memory for the workflow
class State(TypedDict):
    joke: str
    topic: str
    feedback: str
    funny_or_not: str

# 5. Node: Joke Generator
#    Generates a joke about the topic, optionally using feedback if present
def llm_call_generator(state: State):
    """LLM generates a joke, using feedback if available."""
    if state.get("feedback"):
        # If feedback exists, use it to improve the joke
        msg = llm.invoke(
            f"Write a joke about {state['topic']} but take into account the feedback: {state['feedback']}"
        )
    else:
        # Otherwise, just write a joke about the topic
        msg = llm.invoke(f"Write a joke about {state['topic']}")
    return {"joke": msg.content}

# 6. Node: Joke Evaluator
#    Grades the joke as "funny" or "not funny" and provides feedback if needed
def llm_call_evaluator(state: State):
    """LLM evaluates the joke and gives feedback."""
    grade = evaluator.invoke(f"Grade the joke {state['joke']}")
    return {"funny_or_not": grade.grade, "feedback": grade.feedback}

# 7. Conditional Edge: Route based on evaluation
#    If the joke is funny, accept and end. If not, loop back to generator with feedback
def route_joke(state: State):
    """Route to END if funny, or back to generator if not funny."""
    if state["funny_or_not"] == "funny":
        return "Accepted"
    elif state["funny_or_not"] == "not funny":
        return "Rejected + Feedback"

# 8. Build the workflow graph
#    This sets up the sequence and logic connecting each step
optimizer_builder = StateGraph(State)

# Add nodes (steps)
optimizer_builder.add_node("llm_call_generator", llm_call_generator)
optimizer_builder.add_node("llm_call_evaluator", llm_call_evaluator)

# Add edges (connections)
# Start at the generator
optimizer_builder.add_edge(START, "llm_call_generator")
# After generating, always evaluate
optimizer_builder.add_edge("llm_call_generator", "llm_call_evaluator")
# After evaluation, either finish (END) or loop back to generator with feedback
optimizer_builder.add_conditional_edges(
    "llm_call_evaluator",
    route_joke,
    {  # Name returned by route_joke : Name of next node to visit
        "Accepted": END,
        "Rejected + Feedback": "llm_call_generator",
    },
)

# 9. Compile the workflow (finalize for execution)
optimizer_workflow = optimizer_builder.compile()

# 10. Run the workflow with an example topic
if __name__ == "__main__":
    # Start with a topic (e.g., "Cats"). The workflow will generate, evaluate, and improve the joke as needed.
    state = optimizer_workflow.invoke({"topic": "Cats"})
    print("Final joke:")
    print(state["joke"])
    print("\nEvaluation:")
    print(state["funny_or_not"])
    if state["funny_or_not"] == "not funny":
        print("Feedback for improvement:")
        print(state["feedback"])
