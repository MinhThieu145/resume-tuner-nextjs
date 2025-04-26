import Chat from "./components/Chat";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-white dark:bg-black flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-6xl h-[80vh] bg-white dark:bg-black border border-[#e5e5e5] dark:border-[#232323] rounded-xl shadow-xl flex overflow-hidden">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col p-8 border-r border-[#e5e5e5] dark:border-[#232323] bg-white dark:bg-black min-w-[340px] max-w-[500px]">
          <div className="text-2xl font-bold mb-6 tracking-tight text-black dark:text-white font-sans">GPT Agent</div>
          <Chat />
        </div>
        {/* Right: Empty for now */}
        <div className="flex-1 bg-white dark:bg-black flex items-center justify-center">
          {/* Reserved for future content */}
        </div>
      </div>
    </div>
  );
}

