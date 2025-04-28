"use client";
import { useState, useRef, useEffect } from "react";
import { FiSave, FiUpload, FiFileText } from "react-icons/fi";

export default function ResumeUploader() {
  // Helper function to format parsed resume JSON as readable text
  const formatResumeText = (resume: any): string => {
    if (!resume) return '';
    
    let formattedText = '';
    
    // Name and contact information would go here if available
    formattedText += '# WORK EXPERIENCE\n\n';
    
    if (resume.experiences && resume.experiences.length > 0) {
      resume.experiences.forEach((exp: any) => {
        formattedText += `${exp.company} - ${exp.location || ''}\n`;
        formattedText += `${exp.position}\n`;
        formattedText += `${exp.startDate || ''} - ${exp.endDate || 'Present'}\n\n`;
        
        if (exp.bulletPoints && exp.bulletPoints.length > 0) {
          exp.bulletPoints.forEach((bullet: string) => {
            formattedText += `• ${bullet}\n`;
          });
        }
        
        formattedText += '\n';
      });
    }
    
    formattedText += '# PROJECTS\n\n';
    
    if (resume.projects && resume.projects.length > 0) {
      resume.projects.forEach((project: any) => {
        formattedText += `${project.name}${project.date ? ` (${project.date})` : ''}\n`;
        
        if (project.technologies && project.technologies.length > 0) {
          formattedText += `Technologies: ${project.technologies.join(', ')}\n\n`;
        }
        
        if (project.description && project.description.length > 0) {
          project.description.forEach((desc: string) => {
            formattedText += `• ${desc}\n`;
          });
        }
        
        formattedText += '\n';
      });
    }
    
    formattedText += '# SKILLS\n\n';
    
    if (resume.skills && resume.skills.length > 0) {
      // Group skills into categories if they contain categories
      const skillGroups: {[key: string]: string[]} = {};
      
      resume.skills.forEach((skill: string) => {
        // Check if the skill contains a category prefix (like 'Data Science:' or 'Languages:')
        const match = skill.match(/^([^:]+):\s*(.+)$/);
        
        if (match) {
          const category = match[1].trim();
          const skillName = match[2].trim();
          
          if (!skillGroups[category]) {
            skillGroups[category] = [];
          }
          skillGroups[category].push(skillName);
        } else {
          // For skills without categories
          if (!skillGroups['Other']) {
            skillGroups['Other'] = [];
          }
          skillGroups['Other'].push(skill);
        }
      });
      
      // Check if we have any categorized skills
      const hasCategories = Object.keys(skillGroups).length > 1 || !skillGroups['Other'];
      
      if (hasCategories) {
        // If we have categories, display them
        Object.keys(skillGroups).forEach(category => {
          if (category !== 'Other') {
            formattedText += `${category}: ${skillGroups[category].join(', ')}\n`;
          }
        });
        
        // Add 'Other' at the end if it exists
        if (skillGroups['Other']) {
          formattedText += `\nOther: ${skillGroups['Other'].join(', ')}\n`;
        }
      } else {
        // If no categories, just list all skills
        formattedText += resume.skills.join(', ');
      }
    }
    
    return formattedText;
  };

  
  // State management
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsedContent, setParsedContent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"paste" | "upload" | "json">("upload");
  const [pastedText, setPastedText] = useState("");
  const [formattedText, setFormattedText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedResumeId, setSavedResumeId] = useState<string | null>(null);
  const [company, setCompany] = useState<string>('Company');
  const [resumeName, setResumeName] = useState<string>('Resume');
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingResumeName, setIsEditingResumeName] = useState(false);
  const [rawJsonDisplay, setRawJsonDisplay] = useState<string>('');
  const companyInputRef = useRef<HTMLInputElement>(null);
  const resumeNameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for resume selection events from Directory component
  useEffect(() => {
    const handleResumeSelected = (event: CustomEvent) => {
      const { resumeId } = event.detail;
      if (resumeId) {
        loadResumeById(resumeId);
      }
    };

    // Check if there's a resumeId in localStorage (for page refreshes)
    const storedResumeId = localStorage.getItem('selectedResumeId');
    if (storedResumeId) {
      loadResumeById(storedResumeId);
    }

    // Add event listener for resume selection
    window.addEventListener('resumeSelected', handleResumeSelected as EventListener);

    return () => {
      window.removeEventListener('resumeSelected', handleResumeSelected as EventListener);
    };
  }, []);

  const loadResumeById = async (resumeId: string) => {
    setError(null);
    setUploading(true);
    
    try {
      // Use a fixed user ID for now - in a real app, this would come from authentication
      const userId = 'cfe1f319-6047-405d-a39c-1e3db973da9b';
      
      const response = await fetch(`/api/resume-save?userId=${userId}&resumeId=${resumeId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch resume');
      }
      
      const data = await response.json();
      
      if (!data.resume) {
        throw new Error('Resume not found');
      }
      
      // Update state with fetched resume data
      const resume = data.resume;
      setParsedContent(resume.payload);
      setFormattedText(formatResumeText(resume.payload));
      setRawJsonDisplay(JSON.stringify(resume.payload, null, 2));
      setSavedResumeId(resume.id);
      setCompany(resume.company || 'Company');
      setResumeName(resume.resume_name || 'Resume');
      setActiveTab('json');
      
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading the resume');
      console.error('Resume loading error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
        setError('File size exceeds 10MB limit');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSave = () => {
    if (!parsedContent) return;
    
    // Create a blob and download link
    const jsonString = JSON.stringify(parsedContent, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume-parsed.json';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError(null);
    setSaveSuccess(false);
    setSavedResumeId(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/pdf-parser?resultType=json', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse PDF');
      }
      
      const data = await response.json();
      setParsedContent(data.result);
      // Set the initial formatted text
      setFormattedText(formatResumeText(data.result));
      // Set JSON display
      setRawJsonDisplay(JSON.stringify(data.result, null, 2));
    } catch (err: any) {
      setError(err.message || 'An error occurred during parsing');
      console.error('PDF parsing error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) {
      setError('Please paste some text first');
      return;
    }
    
    setUploading(true);
    setError(null);
    setSaveSuccess(false);
    setSavedResumeId(null);
    
    try {
      // Call the resume-text-extract API
      const response = await fetch('/api/resume-text-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: pastedText }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse resume text');
      }
      
      const result = await response.json();
      setParsedContent(result.data);
      // Set the initial formatted text
      setFormattedText(formatResumeText(result.data));
      // Set JSON display
      setRawJsonDisplay(JSON.stringify(result.data, null, 2));
    } catch (err: any) {
      setError(err.message || 'An error occurred during parsing');
      console.error('Text parsing error:', err);
    } finally {
      setUploading(false);
    }
  };

  const saveToDatabase = async () => {
    if (!parsedContent) {
      setError('No resume data to save');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Use a fixed user ID for now - in a real app, this would come from authentication
      const userId = 'cfe1f319-6047-405d-a39c-1e3db973da9b';
      
      const response = await fetch('/api/resume-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          payload: parsedContent,
          company,
          resume_name: resumeName,
          // If we have a resumeId, pass it to update the existing resume
          ...(savedResumeId && { resumeId: savedResumeId })
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save resume');
      }
      
      const result = await response.json();
      setSaveSuccess(true);
      setSavedResumeId(result.resumeId);
      
      // Auto-hide the success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the resume');
      console.error('Saving error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      {/* Header with light grey background */}
      <div className="px-3 py-1.5 flex justify-between items-center bg-gray-100 dark:bg-zinc-800 w-full border-b border-gray-200 dark:border-zinc-700">
        <h2 className="text-lg font-medium tracking-tight text-black dark:text-white">
          {isEditingCompany ? (
            <span className="inline-block">
              <input
                ref={companyInputRef}
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onBlur={() => setIsEditingCompany(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingCompany(false);
                  }
                }}
                className="px-1 py-0.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ width: `${Math.max(company.length, 5) + 2}ch` }}
                autoFocus
              />
            </span>
          ) : (
            <span 
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 px-1 py-0.5 rounded" 
              onClick={() => {
                setIsEditingCompany(true);
                setTimeout(() => companyInputRef.current?.focus(), 0);
              }}
            >
              {company}
            </span>
          )}
          <span className="mx-1 text-gray-400">/</span>
          {isEditingResumeName ? (
            <span className="inline-block">
              <input
                ref={resumeNameInputRef}
                type="text"
                value={resumeName}
                onChange={(e) => setResumeName(e.target.value)}
                onBlur={() => setIsEditingResumeName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingResumeName(false);
                  }
                }}
                className="px-1 py-0.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ width: `${Math.max(resumeName.length, 5) + 2}ch` }}
                autoFocus
              />
            </span>
          ) : (
            <span 
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 px-1 py-0.5 rounded"
              onClick={() => {
                setIsEditingResumeName(true);
                setTimeout(() => resumeNameInputRef.current?.focus(), 0);
              }}
            >
              {resumeName}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={handlePasteSubmit}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors ${!pastedText.trim() || activeTab !== 'paste' || uploading ? 'opacity-50' : ''}`}
          >
            <FiFileText className="w-3.5 h-3.5" />
            <span>Parse</span>
          </button>
          <button 
            onClick={handleSave}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors ${!parsedContent ? 'opacity-50' : ''}`}
          >
            <FiSave className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-zinc-700">
        <button 
          className={`px-3 py-1.5 text-sm font-medium ${activeTab === 'paste' 
            ? 'text-black dark:text-white border-b-2 border-black dark:border-white' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('paste')}
        >
          Paste Resume
        </button>
        <button 
          className={`px-3 py-1.5 text-sm font-medium ${activeTab === 'upload' 
            ? 'text-black dark:text-white border-b-2 border-black dark:border-white' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Resume
        </button>
        <button 
          className={`px-3 py-1.5 text-sm font-medium ${activeTab === 'json' 
            ? 'text-black dark:text-white border-b-2 border-black dark:border-white' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('json')}
          disabled={!parsedContent}
        >
          JSON View
        </button>
      </div>
      
      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-md text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        
        {saveSuccess && !error && (
          <div className="p-3 text-sm bg-green-50 border border-green-200 text-green-600 rounded-lg flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Resume {savedResumeId ? 'updated' : 'saved'} successfully!
          </div>
        )}
        
        {/* Paste Resume Tab */}
        {activeTab === 'paste' && !uploading && (
          <div className="h-full flex flex-col">
            <textarea 
              className="w-full h-full px-4 py-2 bg-white dark:bg-black text-black dark:text-white resize-none focus:outline-none"
              placeholder="Paste your resume text here..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </div>
        )}
        
        {/* Upload Resume Tab */}
        {activeTab === 'upload' && !uploading && !file && (
          <div className="p-4">
            <label 
              htmlFor="resume-upload"
              className="w-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-zinc-600 transition-colors p-5"
            >
              <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <p className="mb-1 text-sm font-medium">Click to upload your resume</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">PDF (MAX. 10MB)</p>
              <input 
                id="resume-upload" 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </label>
          </div>
        )}
        
        {activeTab === 'upload' && file && !parsedContent && !uploading && (
          <div className="p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-gray-200 dark:border-zinc-700 mb-3">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span className="font-medium text-sm truncate">{file.name}</span>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setFile(null)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-zinc-700 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="px-3 py-1.5 text-sm bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center gap-1.5"
              >
                <FiUpload className="w-4 h-4" />
                Parse Resume
              </button>
            </div>
          </div>
        )}
        
        {/* JSON View Tab */}
        {activeTab === 'json' && parsedContent && (
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center">
                <h3 className="text-sm font-medium text-black dark:text-white">Raw JSON Data</h3>
                {savedResumeId && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                    Saved
                  </span>
                )}
              </div>
              <button
                onClick={saveToDatabase}
                disabled={saving}
                className={`px-2 py-1 text-xs rounded flex items-center ${saving 
                  ? 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'}`}
              >
                {saving ? 'Saving...' : (savedResumeId ? 'Update' : 'Save')}
              </button>
            </div>
            <div className="overflow-auto flex-1 p-2">
              <pre className="text-xs whitespace-pre-wrap text-black dark:text-white bg-white dark:bg-black p-2">
                {rawJsonDisplay}
              </pre>
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {uploading && (
          <div className="w-full h-full flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-black dark:border-zinc-700 dark:border-t-white rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading resume data...</p>
          </div>
        )}
        
        {/* Parsed Result - show this only if we're not in JSON view tab */}
        {parsedContent && activeTab !== 'json' && (
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center">
                <h3 className="text-sm font-medium text-black dark:text-white">Parsed Resume</h3>
                {savedResumeId && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                    Saved
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={saveToDatabase}
                  disabled={saving}
                  className={`px-2 py-1 text-xs rounded flex items-center ${saving 
                    ? 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'}`}
                >
                  {saving ? (
                    <>
                      <div className="w-3 h-3 border-t-2 border-blue-200 border-solid rounded-full animate-spin mr-1"></div>
                      Saving...
                    </>
                  ) : savedResumeId ? 'Update' : 'Save to Database'}
                </button>
                <button
                  onClick={() => {
                    setParsedContent(null);
                    setFile(null);
                    setSavedResumeId(null);
                    setSaveSuccess(false);
                    // Don't clear the text, keep it available for re-editing
                    // Instead, move the formatted content back to pastedText
                    setPastedText(formattedText);
                    setFormattedText("");
                  }}
                  className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                >
                  Reset
                </button>
              </div>
            </div>
            <textarea
              className="w-full h-full px-4 py-2 bg-white dark:bg-black text-black dark:text-white resize-none focus:outline-none font-mono text-sm"
              value={formattedText}
              onChange={(e) => {
                setFormattedText(e.target.value);
                // We also update pastedText so that if the user resets and wants to parse again,
                // they'll have their edited content available
                setPastedText(e.target.value);
                // If the content is edited, reset the save success status
                if (saveSuccess) {
                  setSaveSuccess(false);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}