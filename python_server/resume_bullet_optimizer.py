# resume_bullet_optimizer.py
#
# This script uses a strict evaluator-optimizer workflow to generate and refine resume bullet points
# for a given job. It uses LangGraph and LangChain with detailed, beginner-friendly explanations.

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
    model="gpt-4o-2024-08-06",
    temperature=0.2
)

# 2. Define the strict evaluator schema for bullet points
class BulletPointEvaluation(BaseModel):
    grade: Literal["pass", "fail"] = Field(description="Does the bullet point meet all requirements?")
    feedback: str = Field(description="If fail, provide feedback on how to improve this bullet point.")

# 3. Wrap the LLM to always return structured evaluation for each bullet point
evaluator = llm.with_structured_output(BulletPointEvaluation)

# 4. Define the workflow state
class State(TypedDict):
    job: str
    experience: str
    bullet_points: list[str]
    grades: list[str]
    feedback: list[str]
    iteration_count: int  # Track how many times we've tried to improve

# Helper function to extract bullet points from text
def extract_bullet_points(text):
    """
    Extract exactly 4 bullet points from text using regex and fallback methods.
    Returns a list of clean bullet point strings.
    """
    import re
    
    # Try to find bullet points with various markers (-, •, *, etc.)
    bullet_pattern = re.compile(r'[-•*]\s*(.*?)(?=\n[-•*]|\n\n|$)', re.DOTALL)
    bullets = bullet_pattern.findall(text)
    
    # Try numbered lists if bullet points weren't found or insufficient
    if len(bullets) != 4:
        numbered_pattern = re.compile(r'\d+\.\s*(.*?)(?=\n\d+\.|\n\n|$)', re.DOTALL)
        bullets = numbered_pattern.findall(text)
    
    # Last resort: just split by newlines and clean
    if len(bullets) != 4:
        bullets = [line.strip() for line in text.split('\n') 
                  if line.strip() and not line.strip().lower().startswith(('experience', 'job', 'position'))]
    
    # Clean and ensure we have exactly 4 bullets
    bullets = [b.strip() for b in bullets if b.strip()]
    
    # Return exactly 4 bullets (truncate or pad as needed)
    if len(bullets) > 4:
        return bullets[:4]
    elif len(bullets) < 4:
        # Pad with empty strings if we don't have enough
        return bullets + ["" for _ in range(4 - len(bullets))]
    
    return bullets

# 5. Node: Generate an experience with 4 bullet points
def generate_experience(state: State):
    """
    LLM generates one realistic work experience for the given job, with 4 bullet points.
    Each bullet point should be about 30 words, sound human, highlight technical skills, and be recruiter-friendly.
    Uses feedback from previous iterations if available.
    """
    # Track iteration count
    iterations = state.get("iteration_count", 0) + 1
    
    # Build a more sophisticated prompt
    prompt = f"""Generate ONE realistic professional experience for a {state['job']} role.

Requirements:
1. Must have EXACTLY 4 bullet points
2. Each bullet point should be 25-35 words
3. START each bullet point with a SPECIFIC, POWERFUL ACTION VERB (e.g., 'Implemented', 'Engineered', 'Developed', 'Designed', 'Constructed')
4. Be SPECIFIC and DETAILED about what exactly was done - include technical implementation details
5. If you mention metrics or improvements, you may include context for how they were achieved, but it is not required to explain how they were measured unless it adds clarity
6. Include specific technologies, language versions, and technical methodologies
7. NEVER use buzzwords like 'leverage', 'synergy', 'optimize', or other vague business jargon
8. Focus on TECHNICAL work and CONCRETE achievements
9. Use specific numbers and percentages with context, but do not always add 'as measured by' or 'as verified by'
10. Write in a natural, human voice that a real engineer would use in their resume

Format each bullet point as: "ACTION VERB + specific technical task + specific implementation details + measurable outcome"

EXAMPLES OF BAD BULLET POINTS TO AVOID:
❌ "Leveraged modern frameworks to optimize performance and enhance user experience"
❌ "Spearheaded the redesign of a platform using React and Node.js, boosting speed by 40%"
❌ "Utilized advanced technologies to create innovative solutions"

EXAMPLES OF GOOD BULLET POINTS:
✅ "Rebuilt authentication service using JWT tokens and Express middleware, reducing server response time from 1.2s to 300ms"
✅ "Implemented Redis caching layer for product catalog API endpoints, decreasing database load by 73% during peak traffic periods"
"""
    
    # Add previous feedback if this isn't the first attempt
    if iterations > 1 and any(fb for fb in state.get("feedback", []) if fb):
        prompt += "\n\nPrevious feedback to address:\n"
        for i, fb in enumerate(state.get("feedback", [])):
            if fb:
                prompt += f"• Bullet point {i+1}: {fb}\n"
    
    msg = llm.invoke(prompt)
    experience = msg.content.strip()
    
    # Extract bullet points using our robust helper function
    bullet_points = extract_bullet_points(experience)
    
    # If we've tried 5 times and still having issues, use a simpler approach for the missing ones
    if iterations >= 5 and "" in bullet_points:
        # Generate individual bullets for any missing ones
        for i, bp in enumerate(bullet_points):
            if not bp:
                simple_prompt = f"Write one realistic resume bullet point for a {state['job']} position. Around 30 words, with specific technical details and measurable results."
                simple_msg = llm.invoke(simple_prompt)
                bullet_points[i] = simple_msg.content.strip()
    
    return {
        "experience": experience,
        "bullet_points": bullet_points,
        # Reset grades and feedback for new generation
        "grades": ["" for _ in range(4)],
        "feedback": ["" for _ in range(4)],
        "iteration_count": iterations  # Track iterations
    }

# 6. Node: Strictly evaluate each bullet point
def evaluate_bullet_points(state: State):
    """
    Evaluates each bullet point for realism, length, and human-like language. Strict: all must pass.
    Enhanced evaluation criteria for high-quality resume content.
    """
    grades = []
    feedback = []
    for i, bp in enumerate(state["bullet_points"]):
        # Skip empty bullet points (shouldn't happen, but just in case)
        if not bp:
            grades.append("fail")
            feedback.append("Missing bullet point. Please generate a complete bullet point.")
            continue
            
        prompt = f"""
Evaluate the following resume bullet point for a {state['job']} position:

"{bp}"

Evaluate based on these STRICT criteria:

1. REALISTIC & ACCURACY: Is the accomplishment technically plausible and realistic for a professional in this role? Are the tools, frameworks, and metrics industry-standard and believable? Would a senior engineer or hiring manager find this bullet point credible and achievable? 
   - FAIL if the bullet point describes an unrealistic outcome (e.g., "reduced page load time by 90%" for a modern app), uses tools in an implausible way, or claims something not possible for the job level.
   - PASS only if the accomplishment is achievable and the technologies are used as expected in the industry.

2. SPECIFICITY: Does it describe EXACTLY what was done with specific implementation details? Does it avoid vague generalizations?
   - FAIL if it uses generic descriptions without technical specifics
   - PASS only if it explains precisely what technologies were used and how

3. METRICS CONTEXT: For any metrics or improvements mentioned, does it use numbers and percentages with context? It is NOT required to explain how they were measured unless it adds clarity.
   - FAIL if it mentions percentages or numbers with no context at all (e.g., "improved speed by 40%" with no mention of what was improved)
   - PASS if the metric is clear and relevant, but do not require 'as measured by' or 'as verified by' unless it adds value

4. BUZZWORD FREE: Is it completely free from vague business jargon and buzzwords?
   - FAIL if it contains any of these words: leverage, utilize, optimize, synergy, streamline, facilitate, robust, paradigm, empower
   - PASS only if it uses concrete, specific language

5. STRONG ACTION VERB: Does it start with a specific, powerful action verb?
   - FAIL if it doesn't start with a strong technical action verb
   - PASS only if it begins with a verb that clearly describes a technical action

6. TECHNICAL DETAIL: Does it include specific technologies, versions, or methodologies?
   - FAIL if technologies are mentioned without implementation details
   - PASS only if it describes how the technologies were applied

7. LENGTH: Is it between 25-35 words?
   - FAIL if significantly shorter or longer

If the bullet point passes ALL criteria, grade it as "pass".
If it fails ANY criteria, grade it as "fail" and provide specific, actionable feedback focused on the weakest areas. BE STRICT IN YOUR EVALUATION.

EXAMPLES OF FAILING BULLET POINTS:
❌ "Developed a responsive web application using React 17 and TypeScript, integrating with a Node.js backend via RESTful APIs, resulting in a 90% faster page load time for end-users." - not realistic, metric is not plausible
❌ "Leveraged React to improve website performance" - too vague, uses buzzword, no specifics
❌ "Spearheaded the redesign of an e-commerce platform using React and Node.js, boosting page load speed by 40%" - metric is unclear, not specific enough

EXAMPLES OF PASSING BULLET POINTS:
✅ "Rebuilt authentication microservice using JWT tokens and bcrypt hashing, reducing server response time from 1.2s to 300ms"
✅ "Implemented Redis caching strategy for product catalog API, cutting database load by 73% during Black Friday traffic spike"
"""
        
        # Get the result and check if we're at max iterations
        result = evaluator.invoke(prompt)
        
        # Force pass after 5 iterations to prevent infinite loops
        if state.get("iteration_count", 0) >= 5:
            # Still keep the feedback, but force pass grade
            grades.append("pass")
            # If it actually failed, keep the feedback
            if result.grade == "fail":
                feedback.append(f"Forced pass after 5 iterations. Original feedback: {result.feedback}")
            else:
                feedback.append(result.feedback)
        else:
            # Normal behavior for iterations < 5
            grades.append(result.grade)
            feedback.append(result.feedback)
            
    return {"grades": grades, "feedback": feedback}

# 7. Conditional routing: only pass if ALL bullet points pass
def route_bullet_points(state: State):
    # Log the current iteration's results
    current_iteration = state.get("iteration_count", 0)
    
    print(f"\n{'-'*40}\nITERATION {current_iteration} RESULTS\n{'-'*40}")
    print("\nCurrent Bullet Points:")
    for i, bp in enumerate(state["bullet_points"]):
        grade_symbol = "✅" if state["grades"][i] == "pass" else "❌"
        print(f"{grade_symbol} {i+1}. {bp}")
        print(f"   Word count: {len(bp.split())} words")
        if state["grades"][i] == "fail":
            print(f"   Feedback: {state['feedback'][i]}")
    
    # Determine if we need another iteration
    all_passed = all(g == "pass" for g in state["grades"])
    if all_passed:
        print(f"\n✨ All bullet points passed! Optimization complete.")
        return "Accepted"
    else:
        failed_count = sum(1 for g in state["grades"] if g == "fail")
        print(f"\n🔄 {failed_count} bullet point(s) need improvement. Proceeding to next iteration...")
        return "Rejected + Feedback"

# 8. Build the workflow graph
optimizer_builder = StateGraph(State)

# Create a tracking node to capture iteration history
def track_iteration(state: State):
    """Capture the current state for logging purposes."""
    capture_iteration(state)
    return {}

# Add nodes (steps)
optimizer_builder.add_node("generate_experience", generate_experience)
optimizer_builder.add_node("evaluate_bullet_points", evaluate_bullet_points)
optimizer_builder.add_node("track_iteration", track_iteration)  # Add tracking node
optimizer_builder.add_edge(START, "generate_experience")
optimizer_builder.add_edge("generate_experience", "track_iteration")  # Add tracking edge
optimizer_builder.add_edge("track_iteration", "evaluate_bullet_points")  # Update edge
optimizer_builder.add_conditional_edges(
    "evaluate_bullet_points",
    route_bullet_points,
    {"Accepted": END, "Rejected + Feedback": "generate_experience"}
)

# 9. Compile the workflow
graph = optimizer_builder.compile()

# Store history of all iterations for logging
iteration_history = []

# Helper function to capture each iteration's state
def capture_iteration(state):
    """Add the current state to iteration history for later analysis"""
    iteration_history.append({
        "iteration": state.get("iteration_count", 0),
        "bullet_points": state["bullet_points"].copy(),
        "grades": state["grades"].copy(),
        "feedback": state["feedback"].copy()
    })

# 10. Run the workflow with an example job
def print_result(state):
    print("\n" + "="*80)
    print("FINAL OPTIMIZED EXPERIENCE\n" + "="*80)
    
    print("\nComplete Experience:")
    print(state["experience"])
    
    print("\nBullet Points:")
    for i, bp in enumerate(state["bullet_points"]):
        grade_icon = "✅" if state["grades"][i] == "pass" else "❌"
        print(f"{grade_icon} {i+1}. {bp}")
    
    print("\nEvaluation Details:")
    for i, (g, fb) in enumerate(zip(state["grades"], state["feedback"])):
        print(f"Bullet {i+1}: {g.upper()}")
        if fb:
            print(f"   Feedback: {fb}")
    
    # Add word count for each bullet point to help user
    print("\nWord Count Analysis:")
    for i, bp in enumerate(state["bullet_points"]):
        word_count = len(bp.split())
        status = "✅ Good length" if 25 <= word_count <= 35 else "⚠️ Length not ideal"
        print(f"Bullet {i+1}: {word_count} words - {status}")
    
    # Show progress summary across all iterations if we have history
    if len(iteration_history) > 1:
        print("\n" + "="*80)
        print("OPTIMIZATION JOURNEY\n" + "="*80)
        print(f"Total Iterations: {len(iteration_history)}\n")
        
        # Calculate improvement metrics
        initial_pass_count = sum(1 for g in iteration_history[0]["grades"] if g == "pass")
        final_pass_count = sum(1 for g in iteration_history[-1]["grades"] if g == "pass")
        
        print(f"Initial Pass Rate: {initial_pass_count}/4 bullet points ({initial_pass_count*25}%)")
        print(f"Final Pass Rate: {final_pass_count}/4 bullet points ({final_pass_count*25}%)")
        
        # Show evolution of each bullet point
        print("\nBullet Point Evolution:")
        for bullet_num in range(4):
            print(f"\nBullet #{bullet_num+1} Evolution:")
            for idx, iter_data in enumerate(iteration_history):
                # Skip iterations where this bullet wasn't changed
                if idx > 0 and iter_data["bullet_points"][bullet_num] == iteration_history[idx-1]["bullet_points"][bullet_num]:
                    continue
                    
                iter_num = iter_data["iteration"]
                bullet = iter_data["bullet_points"][bullet_num]
                grade = iter_data["grades"][bullet_num] if iter_data["grades"][bullet_num] else "N/A"
                word_count = len(bullet.split())
                
                grade_icon = "✅" if grade == "pass" else "❌" if grade == "fail" else "🔄"
                print(f"  Iteration {iter_num}: {grade_icon} [{word_count} words]")
                print(f"  {bullet}")
                
                if grade == "fail" and iter_data["feedback"][bullet_num]:
                    print(f"  Feedback: {iter_data['feedback'][bullet_num]}")
                print()

if __name__ == "__main__":
    # Clear any previous history
    iteration_history.clear()
    
    print("\n" + "="*80)
    print("RESUME BULLET POINT OPTIMIZER")
    print("="*80)
    
    # You can change the job string below to test other jobs
    job = "Front End Software Engineer with proficiency in backend technologies and TCP/HTTP protocol"
    print(f"\nOptimizing bullet points for: {job}\n")
    
    initial_state = {
        "job": job, 
        "experience": "", 
        "bullet_points": ["" for _ in range(4)], 
        "grades": ["" for _ in range(4)], 
        "feedback": ["" for _ in range(4)],
        "iteration_count": 0  # Start with iteration 0
    }
    
    print("Starting optimization process...")
    final_state = graph.invoke(initial_state)
    print_result(final_state)
    print(f"\nOptimization completed in {final_state['iteration_count']} iterations.")
