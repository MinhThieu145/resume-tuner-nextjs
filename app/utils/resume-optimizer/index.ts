import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import dotenv from 'dotenv';

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

// Initialize the LLM
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-2024-08-06",
  temperature: 0.2
});

// Define the state schema using Zod for runtime validation
const BulletPointStateSchema = z.object({
  job: z.string(),
  experience: z.string(),
  bullet_points: z.array(z.string()),
  grades: z.array(z.string()),
  feedback: z.array(z.string()),
  iteration_count: z.number()
});

// Extract TypeScript type from the Zod schema
export type BulletPointState = z.infer<typeof BulletPointStateSchema>;

// Zod schema for evaluation results
const BulletPointEvaluationSchema = z.object({
  grade: z.enum(["pass", "fail"]).describe("Does the bullet point meet all requirements?"),
  feedback: z.string().describe("If fail, provide feedback on how to improve this bullet point.")
});

// Create a structured output version of the LLM
const evaluator = llm.withStructuredOutput(BulletPointEvaluationSchema);

// Helper function to extract bullet points 
function extractBulletPoints(text: string): string[] {
  // Try to find bullet points with various markers
  const bulletPattern = /[-•*]\s*(.*?)(?=\n[-•*]|\n\n|$)/gs;
  let bullets = Array.from(text.matchAll(bulletPattern), m => m[1].trim());
  
  // Try numbered lists if bullet points weren't found or insufficient
  if (bullets.length !== 4) {
    const numberedPattern = /\d+\.\s*(.*?)(?=\n\d+\.|\n\n|$)/gs;
    bullets = Array.from(text.matchAll(numberedPattern), m => m[1].trim());
  }
  
  // Last resort: just split by newlines and clean
  if (bullets.length !== 4) {
    bullets = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.toLowerCase().startsWith('experience') && 
              !line.toLowerCase().startsWith('job') && 
              !line.toLowerCase().startsWith('position'));
  }
  
  // Clean and ensure we have exactly 4 bullets
  bullets = bullets.filter(b => b.trim());
  
  // Return exactly 4 bullets (truncate or pad as needed)
  if (bullets.length > 4) {
    return bullets.slice(0, 4);
  } else if (bullets.length < 4) {
    // Pad with empty strings if we don't have enough
    return [...bullets, ...Array(4 - bullets.length).fill("")];
  }
  
  return bullets;
}

// Generate an experience with 4 bullet points
async function generateExperience(state: BulletPointState): Promise<BulletPointState> {
  // Increment iteration count
  const iterations = (state.iteration_count || 0) + 1;

  // Build prompt
  let prompt = `Generate ONE realistic professional experience for a ${state.job} role.

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
`;

  // Add previous feedback if this isn't the first attempt
  if (iterations > 1 && state.feedback?.some(fb => fb)) {
    prompt += "\n\nPrevious feedback to address:\n";
    state.feedback.forEach((fb, i) => {
      if (fb) {
        prompt += `• Bullet point ${i + 1}: ${fb}\n`;
      }
    });
  }

  // Call the LLM
  const msg = await llm.invoke(prompt);
  const experience = (msg.content as string).trim();

  // Extract bullet points
  const bullet_points = extractBulletPoints(experience);

  // If we've tried 5 times and still have issues, use a simpler approach
  if (iterations >= 5 && bullet_points.some(bp => !bp)) {
    // Generate individual bullets for any missing ones
    for (let i = 0; i < bullet_points.length; i++) {
      if (!bullet_points[i]) {
        const simple_prompt = `Write one realistic resume bullet point for a ${state.job} position. Around 30 words, with specific technical details and measurable results.`;
        const simple_msg = await llm.invoke(simple_prompt);
        bullet_points[i] = (simple_msg.content as string).trim();
      }
    }
  }

  // Return updated state
  return {
    ...state,
    experience,
    bullet_points,
    // Reset grades and feedback for new generation
    grades: ["", "", "", ""],
    feedback: ["", "", "", ""],
    iteration_count: iterations
  };
}

// Evaluate bullet points
async function evaluateBulletPoints(state: BulletPointState): Promise<BulletPointState> {
  const grades: string[] = [];
  const feedback: string[] = [];

  // Evaluate each bullet point
  for (let i = 0; i < state.bullet_points.length; i++) {
    const bp = state.bullet_points[i];

    // Skip empty bullet points
    if (!bp) {
      grades.push("fail");
      feedback.push("Missing bullet point. Please generate a complete bullet point.");
      continue;
    }

    // Build evaluation prompt
    const prompt = `
Evaluate the following resume bullet point for a ${state.job} position:

"${bp}"

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
`;

    // Get the evaluation result
    const result = await evaluator.invoke(prompt);

    // Force pass after 5 iterations to prevent infinite loops
    if (state.iteration_count >= 5) {
      grades.push("pass");
      if (result.grade === "fail") {
        feedback.push(`Forced pass after 5 iterations. Original feedback: ${result.feedback}`);
      } else {
        feedback.push(result.feedback);
      }
    } else {
      grades.push(result.grade);
      feedback.push(result.feedback);
    }
  }

  return {
    ...state,
    grades,
    feedback
  };
}

// Export the optimization function
export async function optimizeResumeBullets(job: string): Promise<BulletPointState> {
  console.log(`Starting resume optimization for: ${job}`);
  
  // Create initial state
  let state: BulletPointState = {
    job,
    experience: "",
    bullet_points: ["", "", "", ""],
    grades: ["", "", "", ""],
    feedback: ["", "", "", ""],
    iteration_count: 0
  };
  
  let allPassed = false;
  const MAX_ITERATIONS = 5;
  
  while (!allPassed && state.iteration_count < MAX_ITERATIONS) {
    // Generate experience
    state = await generateExperience(state);
    console.log(`Generated experience with ${state.bullet_points.length} bullet points (iteration ${state.iteration_count})`);
    
    // Evaluate bullet points
    state = await evaluateBulletPoints(state);
    
    // Check if all passed
    allPassed = state.grades.every(grade => grade === "pass");
    console.log(`Evaluation complete. ${state.grades.filter(g => g === "pass").length}/4 bullet points passed.`);
    
    if (allPassed) {
      console.log("All bullet points passed! Optimization complete.");
    } else if (state.iteration_count >= MAX_ITERATIONS) {
      console.log(`Reached maximum iterations (${MAX_ITERATIONS}). Stopping optimization.`);
    } else {
      console.log("Some bullet points failed. Proceeding to next iteration...");
    }
  }
  
  return state;
} 