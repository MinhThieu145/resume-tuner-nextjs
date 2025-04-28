import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../supabase-client";
import { supabaseAdmin } from "../../supabase-admin-client";
import { v4 as uuidv4 } from "uuid";

// Use admin client in development mode to bypass RLS for testing
const getClient = () => {
  return process.env.NODE_ENV === 'development' ? supabaseAdmin : supabase;
};

/**
 * Represents the request body for saving a resume
 */
interface SaveResumeRequest {
  // The resume data in JSON format
  payload: any;
  // The user ID who owns this resume (for reference only, user table no longer exists)
  userId: string;
  // Optional resume ID for updates (if not provided, creates new resume)
  resumeId?: string;
  // Company name associated with this resume
  company?: string;
  // Name of the resume for identification
  resume_name?: string;
}

/**
 * POST handler for saving resume data to Supabase
 * Creates a new resume or updates an existing one
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: SaveResumeRequest = await request.json();
    const { payload, userId, resumeId } = body;

    // Validate required fields
    if (!payload) {
      return NextResponse.json(
        { error: "Resume payload is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    console.log(`Processing resume for userId reference: ${userId}`);

    // If resumeId is provided, this is an update operation
    if (resumeId) {
      // Get the current resume to create a version record
      const client = getClient();
      const { data: currentResume, error: getResumeError } = await client
        .from("resumes")
        .select("payload, id")
        .eq("id", resumeId)
        .eq("user_id", userId)
        .single();

      if (getResumeError) {
        return NextResponse.json(
          { error: "Error fetching existing resume", details: getResumeError.message },
          { status: 500 }
        );
      }

      if (!currentResume) {
        return NextResponse.json(
          { error: "Resume not found or you don't have permission to update it" },
          { status: 404 }
        );
      }

      // Get the current version number
      const { data: versionData, error: versionError } = await supabase
        .from("resume_versions")
        .select("version_no")
        .eq("resume_id", resumeId)
        .order("version_no", { ascending: false })
        .limit(1);

      if (versionError) {
        return NextResponse.json(
          { error: "Error fetching version data", details: versionError.message },
          { status: 500 }
        );
      }

      const nextVersionNo = versionData && versionData.length > 0 ? versionData[0].version_no + 1 : 1;

      // Create a version record of the current state before updating
      const { error: createVersionError } = await supabase
        .from("resume_versions")
        .insert({
          version_id: uuidv4(),
          resume_id: resumeId,
          version_no: nextVersionNo,
          payload: currentResume.payload,
          created_at: new Date().toISOString(),
          user_id: userId  // Using Supabase's native user management
        });

      if (createVersionError) {
        return NextResponse.json(
          { error: "Error creating version record", details: createVersionError.message },
          { status: 500 }
        );
      }

      // Update the resume with new data
      const { data: updatedResume, error: updateError } = await supabase
        .from("resumes")
        .update({
          payload: payload,
          updated_at: new Date().toISOString(),
          ...(body.company && { company: body.company }),
          ...(body.resume_name && { resume_name: body.resume_name }),
        })
        .eq("id", resumeId)
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: "Error updating resume", details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Resume updated successfully",
        resumeId: resumeId,
        versionNo: nextVersionNo,
        data: updatedResume,
      });
    } else {
      // This is a create operation - insert a new resume
      const newResumeId = uuidv4();
      
      const client = getClient();
      const { data: newResume, error: createError } = await client
        .from("resumes")
        .insert({
          id: newResumeId,
          user_id: userId,
          payload: payload,
          updated_at: new Date().toISOString(),
          company: body.company || 'Company',
          resume_name: body.resume_name || 'Resume',
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: "Error creating resume", details: createError.message },
          { status: 500 }
        );
      }

      // Create the first version record
      const { error: createVersionError } = await client
        .from("resume_versions")
        .insert({
          version_id: uuidv4(),
          resume_id: newResumeId,
          version_no: 1,
          payload: payload,
          created_at: new Date().toISOString(),
          user_id: userId  // Using Supabase's native user management
        });

      if (createVersionError) {
        // If version creation fails, we should still return success for the resume
        // but include a warning about the version record
        return NextResponse.json({
          message: "Resume created successfully, but version tracking failed",
          resumeId: newResumeId,
          warning: createVersionError.message,
          data: newResume,
        });
      }

      return NextResponse.json({
        message: "Resume created successfully",
        resumeId: newResumeId,
        versionNo: 1,
        data: newResume,
      });
    }
  } catch (error: any) {
    console.error("Error in resume-save API:", error);
    
    return NextResponse.json(
      {
        error: "Failed to save resume",
        details: error.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for retrieving a specific resume or all resumes for a user
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const resumeId = url.searchParams.get("resumeId");
    
    const client = getClient();
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // If resumeId is provided, get that specific resume
    if (resumeId) {
      const { data: resume, error } = await client
        .from("resumes")
        .select("*")
        .eq("id", resumeId)
        .eq("user_id", userId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Error fetching resume", details: error.message },
          { status: 500 }
        );
      }

      if (!resume) {
        return NextResponse.json(
          { error: "Resume not found or you don't have permission to view it" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        resume
      });
    } else {
      // Otherwise, get all resumes for the user
      const { data: resumes, error } = await client
        .from("resumes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { error: "Error fetching resumes", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        resumes
      });
    }
  } catch (error: any) {
    console.error("Error in resume-save GET API:", error);
    
    return NextResponse.json(
      {
        error: "Failed to retrieve resume data",
        details: error.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
