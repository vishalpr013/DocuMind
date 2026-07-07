import { useState, useEffect, useRef } from 'react'
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  Send, 
  Database, 
  Bot, 
  User, 
  Sparkles, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  AlertCircle,
  Menu,
  X
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function App() {
  const [documents, setDocuments] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [apiConnected, setApiConnected] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [visibleSources, setVisibleSources] = useState({}) // maps message index to boolean
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Check API Connection and Load Documents
  useEffect(() => {
    const checkConnectionAndLoad = async () => {
      try {
        const healthRes = await fetch(`${API_BASE}/health`)
        if (healthRes.ok) {
          setApiConnected(true)
          fetchDocuments()
        } else {
          setApiConnected(false)
        }
      } catch (err) {
        setApiConnected(false)
        console.error("API connection failed", err)
      }
    }

    checkConnectionAndLoad()
    // Poll connection status every 10 seconds
    const interval = setInterval(checkConnectionAndLoad, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (err) {
      console.error("Failed to fetch documents", err)
    }
  }

  // File Upload Handlers
  const handleFileUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        await fetchDocuments()
        // Automatically select the uploaded document
        setSelectedDoc(data)
        setSidebarOpen(false)
        // Add a system welcome message
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: `Successfully uploaded and processed "${file.name}". You can now chat and ask questions about its content!`,
            system: true
          }
        ])
      } else {
        const errorData = await res.json()
        alert(`Upload failed: ${errorData.detail || 'Unknown error'}`)
      }
    } catch (err) {
      console.error("Upload error", err)
      alert("An error occurred while uploading. Please ensure your backend server is running.")
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => {
    setDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  // Delete Document
  const handleDeleteDocument = async (e, id, name) => {
    e.stopPropagation() // Prevent selecting the doc card
    if (!confirm(`Are you sure you want to delete "${name}"? This will erase all its vector knowledge.`)) {
      return
    }

    try {
      const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        if (selectedDoc?.id === id) {
          setSelectedDoc(null)
        }
        await fetchDocuments()
      } else {
        alert("Failed to delete document.")
      }
    } catch (err) {
      console.error("Delete error", err)
    }
  }

  // Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const userMessage = { sender: 'user', text: inputValue }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.text,
          document_id: selectedDoc ? selectedDoc.id : null,
          top_k: 5
        })
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: data.answer,
            sources: data.sources
          }
        ])
      } else {
        const errorData = await res.json()
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: `Error: ${errorData.detail || 'Could not fetch response from server.'}`,
            error: true
          }
        ])
      }
    } catch (err) {
      console.error("Chat error", err)
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: "Failed to connect to the backend server. Please make sure the API is active.",
          error: true
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const toggleSources = (index) => {
    setVisibleSources(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  // Format creation timestamp
  const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex w-screen h-screen bg-brand-bg overflow-hidden font-sans text-gray-100">
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden animate-[fadeIn_0.2s_ease]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Section */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-brand-sidebar border-r border-white/10 flex flex-col h-full transition-transform duration-300 transform md:translate-x-0 md:static md:flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2 rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
              <Sparkles size={22} color="#ffffff" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">DocuMind</h2>
          </div>
          <button 
            className="md:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Upload Container */}
        <div className="p-5 border-b border-white/10">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => handleFileUpload(e.target.files[0])}
            accept=".pdf" 
            style={{ display: 'none' }} 
          />
          {uploading ? (
            <div className="border-2 border-dashed border-white/15 rounded-2xl p-5 text-center bg-white/[0.02] flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-3 border-violet-500/20 border-top-violet-500 rounded-full animate-spin"></div>
              <span className="text-xs text-gray-400">Analyzing PDF chunks...</span>
            </div>
          ) : (
            <div 
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 bg-white/[0.02] flex flex-col items-center gap-2 hover:border-indigo-500 hover:bg-indigo-500/[0.05] ${dragging ? 'border-violet-500 bg-violet-500/[0.1]' : 'border-white/15'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={28} className="text-indigo-400 mb-1" />
              <p className="text-sm text-gray-200 font-medium">Upload new PDF</p>
              <span className="text-xs text-gray-500">Drag & drop files here</span>
            </div>
          )}
        </div>

        {/* Document Items List */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Knowledge Bases</h4>
          <button 
            className={`flex items-center justify-between p-3 px-4 rounded-xl bg-white/[0.03] border cursor-pointer transition-all duration-200 text-gray-200 font-medium hover:bg-indigo-500/10 hover:border-indigo-500/40 ${selectedDoc === null ? 'bg-indigo-500/10 border-indigo-500/40 text-white' : 'border-white/10'}`}
            onClick={() => {
              setSelectedDoc(null)
              setSidebarOpen(false)
            }}
          >
            <div className="flex items-center gap-2.5">
              <Database size={16} />
              <span>All Documents</span>
            </div>
            <span className="text-[11px] text-gray-500">{documents.length} files</span>
          </button>

          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className={`flex items-center justify-between p-3 px-3.5 rounded-xl bg-brand-card border cursor-pointer transition-all duration-200 hover:bg-brand-card-hover hover:-translate-y-[1px] ${selectedDoc?.id === doc.id ? 'border-violet-500/50 bg-violet-500/[0.08] shadow-[0_4px_12px_rgba(139,92,246,0.05)]' : 'border-white/10'}`}
                onClick={() => {
                  setSelectedDoc(doc)
                  setSidebarOpen(false)
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText size={16} className="text-indigo-300 flex-shrink-0" />
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-200 truncate block" title={doc.filename}>{doc.filename}</span>
                    <span className="text-[11px] text-gray-500">{doc.pages} pages • {formatTime(doc.created_at)}</span>
                  </div>
                </div>
                <button 
                  className="bg-transparent border-none text-gray-500 cursor-pointer p-1 rounded-md transition-all duration-200 flex items-center justify-center hover:text-red-500 hover:bg-red-500/10"
                  onClick={(e) => handleDeleteDocument(e, doc.id, doc.filename)}
                  title="Remove document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <footer className="p-4 px-6 border-t border-white/10 flex items-center justify-between bg-black/15">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className={`w-2 h-2 rounded-full animate-pulse-dot`} style={{ backgroundColor: apiConnected ? '#10b981' : '#ef4444' }}></div>
            <span>Backend: {apiConnected ? 'Connected' : 'Offline'}</span>
          </div>
        </footer>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col h-full bg-brand-bg relative min-w-0">
        <header className="h-[73px] px-4 sm:px-6 border-b border-white/10 flex items-center justify-between bg-brand-sidebar/50 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              className="md:hidden flex items-center justify-center text-gray-400 hover:text-white p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all cursor-pointer mr-1 flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <Database size={18} className="text-violet-500 flex-shrink-0" />
            <h3 className="text-base font-semibold text-gray-100 flex-shrink-0">Chatting with</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs" title={selectedDoc ? selectedDoc.filename : 'All Knowledge Bases'}>
              {selectedDoc ? selectedDoc.filename : 'All Knowledge Bases'}
            </span>
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 p-4 sm:p-10 max-w-xl mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-[0_10px_30px_rgba(99,102,241,0.3)]">
                <Bot size={40} color="#ffffff" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-indigo-400 to-pink-500 bg-clip-text text-transparent m-0">DocuMind</h1>
              <p className="text-base text-gray-400 leading-relaxed">
                Upload your research papers, documentations, or PDF guides. Ask questions and get instant, context-aware answers backed by inline citations.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-4">
                <div className="bg-brand-card border border-white/10 p-5 rounded-2xl text-left flex flex-col gap-2">
                  <BookOpen size={20} className="text-violet-500" />
                  <h4 className="text-sm font-semibold text-gray-100">Source Grounding</h4>
                  <p className="text-xs text-gray-500 leading-normal">Answers are generated using facts retrieved directly from your specific PDF pages.</p>
                </div>
                <div className="bg-brand-card border border-white/10 p-5 rounded-2xl text-left flex flex-col gap-2">
                  <Clock size={20} className="text-pink-500" />
                  <h4 className="text-sm font-semibold text-gray-100">Gemini 2.5 Flash</h4>
                  <p className="text-xs text-gray-500 leading-normal">Blazing fast document reasoning and summaries powered by Google's free-tier model API.</p>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex flex-col gap-2 max-w-[90%] sm:max-w-[80%] animate-[fadeIn_0.3s_ease] ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}>
                <div className={`p-4 px-5 rounded-2xl text-[15px] leading-relaxed ${msg.sender === 'user' ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-none shadow-[0_4px_15px_rgba(99,102,241,0.2)]' : 'bg-brand-card text-gray-100 rounded-bl-none border border-white/10'} ${msg.system ? 'font-style: italic bg-white/[0.03] text-indigo-300 border border-dashed border-white/10' : ''} ${msg.error ? 'border-l-4 border-red-500 bg-red-500/[0.05]' : ''}`}>
                  {msg.error && <AlertCircle size={16} className="inline mr-1.5 align-middle text-red-500" />}
                  {msg.text}
                </div>

                {/* Grounded Source References */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-1">
                    <button className="bg-transparent border-none text-indigo-400 text-xs font-semibold cursor-pointer flex items-center gap-1.5 p-1.5 px-3 rounded-lg transition-all duration-200 hover:bg-indigo-500/10 hover:text-indigo-300" onClick={() => toggleSources(index)}>
                      <BookOpen size={13} />
                      <span>{visibleSources[index] ? 'Hide' : 'Show'} grounded sources ({msg.sources.length})</span>
                      {visibleSources[index] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {visibleSources[index] && (
                      <div className="flex flex-col gap-2.5 mt-2 p-3 bg-black/20 rounded-xl border border-white/10">
                        {msg.sources.map((src, sIdx) => (
                          <div key={sIdx} className="flex flex-col gap-1.5 p-2.5 bg-white/[0.02] rounded-lg border-l-3 border-violet-500">
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-[11px] font-semibold text-gray-400">
                              <span className="truncate" title={src.filename}>Source [{sIdx + 1}]: {src.filename}</span>
                              <span className="flex-shrink-0">Pages: {src.page_start} - {src.page_end}</span>
                            </div>
                            <div className="text-xs text-gray-500 italic leading-relaxed whitespace-pre-wrap">"{src.content}"</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* AI Loader */}
          {loading && (
            <div className="flex flex-col gap-2 max-w-[90%] sm:max-w-[80%] self-start">
              <div className="flex items-center gap-3 p-4 px-5 rounded-2xl text-[15px] leading-relaxed bg-brand-card text-gray-100 rounded-bl-none border border-white/10">
                <Bot size={18} className="text-violet-500" />
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 sm:p-6 bg-brand-bg/85 border-t border-white/10 backdrop-blur-md">
          <form className="relative flex items-center bg-brand-card border border-white/10 rounded-2xl p-1.5 px-3 transition-all duration-200 shadow-lg focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.15)]" onSubmit={handleSendMessage}>
            <input 
              className="flex-1 bg-transparent border-none text-gray-100 p-3 py-2 text-sm outline-none placeholder-gray-500"
              type="text" 
              placeholder={!apiConnected ? "Connecting to backend API..." : selectedDoc ? `Ask a question about "${selectedDoc.filename}"...` : "Ask a question about all documents..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading || !apiConnected}
            />
            <button 
              type="submit" 
              className="bg-gradient-to-br from-indigo-500 to-violet-600 border-none text-white w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] disabled:bg-white/5 disabled:text-gray-500 disabled:cursor-not-allowed"
              disabled={!inputValue.trim() || loading || !apiConnected}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default App
