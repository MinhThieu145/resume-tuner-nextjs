import Chat from "./components/Chat";
import ResumeUploader from "./components/ResumeUploader";
import Directory from "./components/Directory";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-zinc-900 p-2 md:p-3">
      <div className="h-[calc(100vh-1.5rem)] w-full flex flex-col md:flex-row gap-2 md:gap-3">
        {/* Left side: Chat */}
        <div className="w-full md:w-5/12 h-full">
          <div className="h-full rounded-lg overflow-hidden border border-[#e5e5e5] dark:border-[#232323] shadow-sm bg-white dark:bg-black">
            <div className="h-full flex flex-col">
              <div className="p-2 border-b border-[#e5e5e5] dark:border-[#232323]">
                <h2 className="text-lg font-medium tracking-tight text-black dark:text-white">Chat</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <Chat />
              </div>
            </div>
          </div>
        </div>
        
        {/* Middle: Two containers */}
        <div className="w-full md:w-5/12 h-full flex flex-col gap-2 md:gap-3">
          {/* Top container - Resume */}
          <div className="h-1/2 rounded-lg border border-[#e5e5e5] dark:border-[#232323] shadow-sm bg-white dark:bg-black overflow-hidden">
            <ResumeUploader />
          </div>
          
          {/* Bottom container */}
          <div className="h-1/2 rounded-lg border border-[#e5e5e5] dark:border-[#232323] shadow-sm p-2 bg-white dark:bg-black">
            <h2 className="text-lg font-medium tracking-tight text-black dark:text-white">Container 2</h2>
            <div className="w-full h-[calc(100%-2rem)] flex items-center justify-center text-gray-400">
              Empty placeholder
            </div>
          </div>
        </div>

        {/* Right side: Directory */}
        <div className="w-full md:w-2/12 h-full">
          <div className="h-full rounded-lg overflow-hidden border border-[#e5e5e5] dark:border-[#232323] shadow-sm bg-white dark:bg-black">
            <Directory />
          </div>
        </div>
      </div>
    </div>
  );
}

