"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  // 🔥 changed to multiple files
  const [files, setFiles] = useState<File[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files)); // 🔥 multiple
      setLogs([]); 
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files)); // 🔥 multiple
      setLogs([]);
    }
  };

  const startProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setUploadProgress(10);
    setLogs(["🚀 Uploading file to secure environment..."]);

    try {
      // 1. Upload Files
      const formData = new FormData();

      // 🔥 multiple append
      files.forEach((f) => {
        formData.append("files", f);
      });

      const uploadRes = await fetch("/api/upload-file", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("File upload failed.");
      
      const { rootPath } = await uploadRes.json(); // 🔥 change

      setUploadProgress(100);
      setLogs((prev) => [...prev, "✅ Upload complete. Path secured.", ""]);

      // 2. Start Processing Stream
      const response = await fetch(`/api/stream-logs?filePath=${encodeURIComponent(rootPath)}`);
      if (!response.body) throw new Error("ReadableStream not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n");
        setLogs((prev) => [...prev, ...lines]);
      }

    } catch (error: any) {
      console.error(error);
      setLogs((prev) => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-cyan-500/30">
      
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20" />
            <h1 className="text-xl font-bold tracking-tight text-white">
              Secure<span className="text-indigo-400">Processor</span>
            </h1>
          </div>
          <div className="text-xs font-mono text-neutral-500">v2.0-standalone</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        
        {/* Intro */}
        <section className="space-y-4 text-center max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Analyze. Compress. Encrypt.
          </h2>
          <p className="text-neutral-400 text-lg">
            Advanced local malware detection combined with military-grade encryption.
            <br/>No external transfers. Pure security.
          </p>
        </section>

        {/* Drag & Drop Area */}
        <section className="max-w-3xl mx-auto">
          <div 
            className={`
              relative group rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center
              ${isDragActive 
                ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]" 
                : "border-neutral-800 bg-neutral-900/30 hover:border-neutral-700"
              }
              ${isProcessing ? "opacity-50 pointer-events-none" : "cursor-pointer"}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <input 
              id="fileInput" 
              type="file"
              multiple // 🔥 important
              className="hidden" 
              onChange={handleFileChange} 
              disabled={isProcessing}
            />
            
            <div className="space-y-4 pointer-events-none">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center transition-colors ${isDragActive ? "bg-indigo-500/20 text-indigo-400" : "bg-neutral-800 text-neutral-500"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {files.length > 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  )}
                </svg>
              </div>
              
              <div>
                {files.length > 0 ? (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <p className="text-xl font-bold text-white">
                      {files.length === 1 ? files[0].name : `${files.length} files selected`}
                    </p>
                    <p className="text-sm text-neutral-400">
                      {(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB ready for processing
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium text-neutral-200">
                      Drag & drop your file here, or click to select
                    </p>
                    <p className="text-sm text-neutral-500 mt-2">
                       Supports EXE, PDF, ZIP, and other binaries
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className={`absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 rounded-2xl pointer-events-none transition-opacity ${isDragActive ? "opacity-100" : "opacity-0"}`} />
          </div>

          {/* Action Button */}
          <div className="mt-8 flex justify-center">
             <button
                onClick={(e) => { e.stopPropagation(); startProcess(); }}
                disabled={isProcessing || files.length === 0}
                className={`
                  h-14 px-10 rounded-full font-bold text-sm tracking-wide transition-all shadow-xl flex items-center gap-3
                  ${isProcessing || files.length === 0
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-105 active:scale-95"
                  }
                `}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-indigo-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>PROCESSING...</span>
                  </>
                ) : (
                  <span>START SECURE PROTOCOL</span>
                )}
              </button>
          </div>
        </section>

        {/* Live Logs */}
        <section className="space-y-4 max-w-3xl mx-auto">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isProcessing ? "bg-green-500 animate-pulse" : "bg-neutral-600"}`}></span>
              System Output
            </h3>
            {uploadProgress > 0 && uploadProgress < 100 && (
               <span className="text-xs font-mono text-indigo-400">Uploading: {uploadProgress}%</span>
            )}
          </div>
          
          <div className="relative rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-inner h-[400px] flex flex-col font-mono text-sm">
            <div className="absolute top-0 left-0 right-0 h-8 bg-neutral-900/80 backdrop-blur border-b border-neutral-800 flex items-center px-4 gap-2 z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-700"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-12 space-y-1 scrollbar-hide">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-800 select-none">
                  <p>Ready to engage terminal...</p>
                </div>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className={`${
                    line.includes("ERROR") || line.includes("MALWARE") || line.includes("failed") 
                      ? "text-red-400" 
                      : line.includes("SUCCESS") || line.includes("Passed") || line.includes("Complete")
                      ? "text-green-400"
                      : line.includes("WARNING") 
                      ? "text-yellow-400"
                      : "text-neutral-400"
                  } break-words`}>
                    <span className="text-neutral-800 mr-3 select-none text-[10px]">
                      {(i + 1).toString().padStart(3, '0')}
                    </span>
                    {line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
