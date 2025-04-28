"use client";
import { useState, useEffect } from "react";

interface Resume {
  id: string;
  company: string;
  resume_name: string;
  user_id: string;
  updated_at: string;
  payload: any;
}

interface DirectoryItem {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: DirectoryItem[];
  expanded?: boolean;
  resumeId?: string; // Used to identify the resume when a file is clicked
  updatedAt?: string; // Add date information
}

export default function Directory() {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch resumes and organize them into a directory structure
  const fetchResumes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use a fixed user ID for now - in a real app, this would come from authentication
      const userId = 'cfe1f319-6047-405d-a39c-1e3db973da9b';
      
      const response = await fetch(`/api/resume-save?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }
      
      const data = await response.json();
      const resumes: Resume[] = data.resumes || [];
      
      // Group resumes by company
      const companiesMap: Record<string, DirectoryItem> = {};
      
      // Create directory structure
      const directoryItems: DirectoryItem[] = [];
      
      resumes.forEach(resume => {
        const companyName = resume.company || 'Uncategorized';
        
        // If this company doesn't exist in our map yet, create it
        if (!companiesMap[companyName]) {
          const newCompany: DirectoryItem = {
            id: `company-${companyName}`,
            name: companyName,
            type: 'folder',
            expanded: true,
            children: []
          };
          companiesMap[companyName] = newCompany;
          directoryItems.push(newCompany);
        }
        
        // Add this resume as a child of its company
        if (companiesMap[companyName].children) {
          companiesMap[companyName].children.push({
            id: `resume-${resume.id}`,
            name: resume.resume_name || 'Unnamed Resume',
            type: 'file',
            resumeId: resume.id,
            updatedAt: resume.updated_at // Store the updated_at date
          });
        }
      });
      
      setItems(directoryItems);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching resumes');
      console.error('Error fetching resumes:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {    
    fetchResumes();
  }, []);

  const toggleExpand = (id: string) => {
    setItems((currentItems) => {
      const updateExpanded = (items: DirectoryItem[]): DirectoryItem[] => {
        return items.map((item) => {
          if (item.id === id) {
            return { ...item, expanded: !item.expanded };
          }
          if (item.children) {
            return { ...item, children: updateExpanded(item.children) };
          }
          return item;
        });
      };
      return updateExpanded(currentItems);
    });
  };

  const handleResumeClick = (resumeId: string) => {
    // Use localStorage to communicate with ResumeUploader component
    localStorage.setItem('selectedResumeId', resumeId);
    // Dispatch a custom event that ResumeUploader will listen for
    window.dispatchEvent(new CustomEvent('resumeSelected', { detail: { resumeId } }));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format as "MMM DD" (e.g. "Jan 15")
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderItem = (item: DirectoryItem, depth = 0) => {
    const paddingLeft = `${depth * 1.25}rem`;

    return (
      <div key={item.id}>
        <div
          className={`py-1 px-2 flex items-center hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-md cursor-pointer`}
          style={{ paddingLeft }}
          onClick={() => {
            if (item.type === "folder") {
              toggleExpand(item.id);
            } else if (item.type === "file" && item.resumeId) {
              handleResumeClick(item.resumeId);
            }
          }}
        >
          {item.type === "folder" && (
            <span className="mr-1.5 text-xs text-gray-600 dark:text-gray-400">
              {item.expanded ? "▼" : "►"}
            </span>
          )}
          {item.type === "file" && (
            <span className="mr-1.5 text-xs text-blue-500 dark:text-blue-400">📄</span>
          )}
          <span className="text-sm truncate">{item.name}</span>
          {item.type === "file" && item.updatedAt && (
            <span className="ml-2 text-xs text-gray-400">{formatDate(item.updatedAt)}</span>
          )}
        </div>
        {item.expanded && item.children && (
          <div>
            {item.children.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-[#e5e5e5] dark:border-[#232323] flex justify-between items-center">
        <h2 className="text-lg font-medium tracking-tight text-black dark:text-white">Resumes</h2>
        <button
          className="text-sm hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-md p-1"
          onClick={() => fetchResumes()}
          title="Refresh"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-400">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center p-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-4 h-4 mr-2 border-2 border-gray-300 border-t-black dark:border-zinc-700 dark:border-t-white rounded-full animate-spin"></div>
            Loading resumes...
          </div>
        ) : error ? (
          <div className="p-2 text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No resumes found. Create one to get started.
          </div>
        ) : (
          items.map((item) => renderItem(item))
        )}
      </div>
    </div>
  );
}