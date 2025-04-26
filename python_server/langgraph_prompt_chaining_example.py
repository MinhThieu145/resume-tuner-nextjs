# langgraph_prompt_chaining_example.py
#
# This script demonstrates prompt chaining using LangGraph.
# It builds a workflow of LLM calls (nodes) with conditional logic (edges).
# Each node processes the state and passes results to the next node.

import os
from dotenv import load_dotenv
from typing_extensions import TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

# 1. Load environment variable for OpenAI key
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

# 3. Define the graph state (like a schema for the workflow)
class State(TypedDict):
    topic: str
    joke: str
    improved_joke: str
    final_joke: str

# 4. Define workflow nodes (each a function that takes and returns part of state)
def generate_joke(state: State):
    """First LLM call to generate initial joke"""
    msg = llm.invoke(f"Write a short joke about {state['topic']}")
    return {"joke": msg.content}

def improve_joke(state: State):
    """Second LLM call to improve the joke"""
    msg = llm.invoke(f"Make this joke funnier by adding wordplay: {state['joke']}")
    return {"improved_joke": msg.content}

def polish_joke(state: State):
    """Third LLM call for final polish"""
    msg = llm.invoke(f"Add a surprising twist to this joke: {state['improved_joke']}")
    return {"final_joke": msg.content}

# 5. Conditional edge: only continue if the joke has a punchline
def check_punchline(state: State):
    """Gate function to check if the joke has a punchline"""
    if "?" in state["joke"] or "!" in state["joke"]:
        return "Pass"
    return "Fail"

# 6. Build the workflow graph
# This section sets up the sequence and logic of how each node (step) connects.
# Think of this as drawing a flowchart for your AI workflow.

# Create a new workflow graph, specifying the state schema (what data flows through the graph)
workflow = StateGraph(State)

# Add nodes to the graph.
# Each node is a step in the workflow, represented by a function.
workflow.add_node("generate_joke", generate_joke)   # Step 1: Generate an initial joke
workflow.add_node("improve_joke", improve_joke)     # Step 2: Make the joke funnier
workflow.add_node("polish_joke", polish_joke)       # Step 3: Add a twist to the joke

# Add edges to define the order and logic of execution.
# Edges connect nodes and determine how data flows from one step to the next.

# Start the workflow at the 'generate_joke' node
workflow.add_edge(START, "generate_joke")

# After generating a joke, check if it passes the punchline gate.
# If 'check_punchline' returns 'Pass', continue to 'improve_joke'.
# If 'Fail', end the workflow early (no improvement or polish).
workflow.add_conditional_edges(
    "generate_joke",          # From this node
    check_punchline,          # Use this function to decide
    {"Pass": "improve_joke", # If Pass, go to improve_joke
     "Fail": END}            # If Fail, stop the workflow
)

# After improving the joke, always go to the polish_joke step
workflow.add_edge("improve_joke", "polish_joke")

# After polishing the joke, end the workflow
workflow.add_edge("polish_joke", END)

# 7. Compile the workflow
# This step finalizes the graph and prepares it for execution.
# After compiling, you can call 'chain.invoke(...)' to run the workflow.
chain = workflow.compile()


# show workflow
from IPython.display import Image, display


# 8. Run the workflow with an example topic
if __name__ == "__main__":
    state = chain.invoke({"topic": "cats"})
    print("Initial joke:")
    print(state.get("joke", ""))
    print("\n--- --- ---\n")
    if "improved_joke" in state:
        print("Improved joke:")
        print(state.get("improved_joke", ""))
        print("\n--- --- ---\n")
        print("Final joke:")
        print(state.get("final_joke", ""))
    else:
        print("Joke failed quality gate - no punchline detected!")
