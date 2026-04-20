/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Menu, 
  Sun, 
  Moon, 
  Send, 
  Mic, 
  StopCircle, 
  Trash2, 
  Settings, 
  HelpCircle,
  Code,
  MessageSquare,
  X,
  Camera,
  Image as ImageIcon,
  Search,
  History,
  ThumbsUp,
  ThumbsDown,
  FileCode,
  FileText,
  Paperclip,
  Globe,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Share
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type BotMode = 'normal' | 'programming';

interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 string
  file?: {
    name: string;
    content: string;
    type: string;
  };
  searchQueries?: string[];
  feedback?: 'up' | 'down';
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('iris_theme');
    return saved ? saved === 'dark' : true;
  });
  const [botMode, setBotMode] = useState<BotMode>(() => {
    const saved = localStorage.getItem('iris_bot_mode');
    return (saved as BotMode) || 'normal';
  });
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string, content: string, type: string } | null>(null);
  
  const [normalMessages, setNormalMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('iris_messages_normal');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [programmingMessages, setProgrammingMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('iris_messages_programming');
    return saved ? JSON.parse(saved) : [];
  });

  const messages = botMode === 'normal' ? normalMessages : programmingMessages;
  const setMessages = botMode === 'normal' ? setNormalMessages : setProgrammingMessages;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [sidebarView, setSidebarView] = useState<'history' | 'settings'>('history');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSearchingWiki, setIsSearchingWiki] = useState<number | null>(null);
  const [wikiResults, setWikiResults] = useState<Record<number, { title: string, extract: string, url: string }>>({});
  const [voiceLang, setVoiceLang] = useState(() => {
    const saved = localStorage.getItem('iris_voice_lang');
    return saved || 'es-ES';
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'es-ES';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  useEffect(() => {
    localStorage.setItem('iris_messages_normal', JSON.stringify(normalMessages));
  }, [normalMessages]);

  useEffect(() => {
    localStorage.setItem('iris_messages_programming', JSON.stringify(programmingMessages));
  }, [programmingMessages]);

  useEffect(() => {
    localStorage.setItem('iris_theme', isDarkMode ? 'dark' : 'light');
    document.body.classList.toggle('light_mode', !isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('iris_bot_mode', botMode);
  }, [botMode]);

  useEffect(() => {
    localStorage.setItem('iris_voice_lang', voiceLang);
    if (recognitionRef.current) {
      recognitionRef.current.lang = voiceLang;
    }
  }, [voiceLang]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setSelectedFile(null); // Clear file if image is selected
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setSelectedFile({
          name: file.name,
          content: content,
          type: file.type || 'text/plain'
        });
        setSelectedImage(null); // Clear image if file is selected
      };
      reader.readAsText(file);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage && !selectedFile) || isGenerating) return;

    const userMessage: Message = { 
      role: 'user', 
      text: input || (selectedImage ? "[Imagen enviada]" : selectedFile ? `[Archivo: ${selectedFile.name}]` : ""), 
      image: selectedImage || undefined,
      file: selectedFile || undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setSelectedFile(null);
    setIsGenerating(true);

    try {
      const systemInstruction = botMode === 'normal' 
        ? "Eres IrisAI, un asistente virtual inteligente, amable y servicial. Tus respuestas deben ser extensas, detalladas y completas. Proporciona explicaciones profundas, ejemplos cuando sea útil y asegúrate de cubrir todos los aspectos de la consulta del usuario en español. No te limites a respuestas cortas; expande tus explicaciones para ser lo más útil posible. Utiliza negritas para resaltar conceptos clave."
        : "Eres IrisAI Programación, un experto de élite en desarrollo de software. Proporciona respuestas técnicas exhaustivas, código limpio y explicaciones detalladas de cada parte del código. No escatimes en detalles técnicos; el usuario prefiere explicaciones largas y completas que cubran casos de borde, optimización y mejores prácticas. Si el usuario sube archivos de código, analízalos profundamente y proporciona una revisión detallada.";

      const contents = [...messages, userMessage].map(m => {
        let textContent = m.text;
        if (m.file) {
          textContent += `\n\n--- CONTENIDO DEL ARCHIVO (${m.file.name}) ---\n${m.file.content}\n--- FIN DEL ARCHIVO ---`;
        }
        
        const parts: any[] = [{ text: textContent }];
        if (m.image) {
          const [mimeType, base64Data] = m.image.split(';base64,');
          parts.push({
            inlineData: {
              mimeType: mimeType.split(':')[1],
              data: base64Data
            }
          });
        }
        return {
          role: m.role,
          parts
        };
      });

      const proxyResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, systemInstruction })
      });

      if (!proxyResponse.ok) {
        const errorData = await proxyResponse.json();
        throw new Error(errorData.error || "Error en el servidor");
      }

      const data = await proxyResponse.json();
      const botText = data.text || "Lo siento, no pude generar una respuesta.";
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: botText
      }]);
    } catch (error: any) {
      console.error("Error generating content:", error);
      let errorMessage = "Hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.";
      
      if (error?.message?.includes("API_KEY_INVALID")) {
        errorMessage = "La clave API proporcionada no es válida. Por favor, verifica tu configuración.";
      } else if (error?.message?.includes("quota") || error?.message?.includes("429")) {
        errorMessage = `Límite de cuota agotado (Google). Error original: ${error.message}`;
      } else if (error?.message) {
        errorMessage = `Error técnico: ${error.message}`;
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    if (botMode === 'normal') {
      localStorage.removeItem('iris_messages_normal');
    } else {
      localStorage.removeItem('iris_messages_programming');
    }
    setShowClearConfirm(false);
  };

  const handleFeedback = (index: number, type: 'up' | 'down') => {
    setMessages(prev => prev.map((msg, i) => {
      if (i === index) {
        return { ...msg, feedback: msg.feedback === type ? undefined : type };
      }
      return msg;
    }));
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const shareConversation = async () => {
    const conversationText = messages.map(m => {
      const role = m.role === 'user' ? 'Usuario' : 'IrisAI';
      return `${role}: ${m.text}`;
    }).join('\n\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Conversación con IrisAI',
          text: conversationText,
        });
      } else {
        await navigator.clipboard.writeText(conversationText);
        setIsSharing(true);
        setTimeout(() => setIsSharing(null as any), 2000);
        alert('Conversación copiada al portapapeles');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const searchWikipedia = async (index: number, query: string) => {
    setIsSearchingWiki(index);
    try {
      // Use a proxy-less approach for Wikipedia API (it supports CORS)
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.query.search.length > 0) {
        const pageId = searchData.query.search[0].pageid;
        const detailUrl = `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts|info&exintro&explaintext&inprop=url&pageids=${pageId}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        const page = detailData.query.pages[pageId];
        
        setWikiResults(prev => ({
          ...prev,
          [index]: {
            title: page.title,
            extract: page.extract,
            url: page.fullurl
          }
        }));
      }
    } catch (error) {
      console.error("Error searching Wikipedia:", error);
    } finally {
      setIsSearchingWiki(null);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isSidebarOpen ? 'sidebar-open' : ''} ${isPresenting ? 'presentation-mode' : ''}`}>
      {/* Navbar */}
      {!isPresenting && (
        <nav className="navbar">
          <div className="navbar__left">
            <button 
              className="navbar__button" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Menú"
            >
              <Menu size={24} />
            </button>
          </div>

          <div className="navbar__center">
            <div className="bot-selector">
              <button 
                className={`bot-option ${botMode === 'normal' ? 'active' : ''}`}
                onClick={() => setBotMode('normal')}
              >
                <MessageSquare size={16} className="bot-option__icon" />
                <span className="bot-option__name">IrisAI Normal</span>
              </button>
              <button 
                className={`bot-option ${botMode === 'programming' ? 'active' : ''}`}
                onClick={() => setBotMode('programming')}
              >
                <Code size={16} className="bot-option__icon" />
                <span className="bot-option__name">IrisAI Programación</span>
              </button>
            </div>
          </div>

          <div className="navbar__right">
            <button 
              className="navbar__button" 
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Cambiar tema"
            >
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </nav>
      )}

      {isPresenting && (
        <button 
          className="fixed top-6 right-6 z-[3000] bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-2xl transition-all flex items-center gap-2 font-bold"
          onClick={() => setIsPresenting(false)}
          title="Salir de modo presentación"
        >
          <Minimize2 size={20} />
          <span className="hidden md:inline">Salir</span>
        </button>
      )}

      {/* Sidebar */}
      <aside className={`sidebar flex flex-col ${isSidebarOpen ? 'left-0' : '-left-[260px]'}`}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <img 
              src="/src/icon.png" 
              alt="IrisAI Logo" 
              className="w-8 h-8 rounded-lg object-cover border border-white/10"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              IrisAI
            </h2>
          </div>
          <button className="navbar__button" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {sidebarView === 'history' ? (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase font-bold opacity-40 px-2 mb-1">Conversaciones</p>
              
              <button 
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${botMode === 'normal' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'hover:bg-[var(--secondary-hover-color)]'}`} 
                onClick={() => { setBotMode('normal'); setIsSidebarOpen(false); }}
              >
                <div className={`p-2 rounded-lg ${botMode === 'normal' ? 'bg-blue-500' : 'bg-gray-700'}`}>
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate">Chat Normal</p>
                  <p className="text-[10px] opacity-50 truncate">{normalMessages.length} mensajes</p>
                </div>
              </button>

              <button 
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${botMode === 'programming' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 'hover:bg-[var(--secondary-hover-color)]'}`} 
                onClick={() => { setBotMode('programming'); setIsSidebarOpen(false); }}
              >
                <div className={`p-2 rounded-lg ${botMode === 'programming' ? 'bg-purple-500' : 'bg-gray-700'}`}>
                  <Code size={16} className="text-white" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate">Programación</p>
                  <p className="text-[10px] opacity-50 truncate">{programmingMessages.length} mensajes</p>
                </div>
              </button>

              <div className="mt-4 border-t border-white/5 pt-4">
                <p className="text-[10px] uppercase font-bold opacity-40 px-2 mb-1">Herramientas</p>
                <button className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--secondary-hover-color)] transition-colors text-left w-full" onClick={() => { setShowSearchHistory(true); setIsSidebarOpen(false); }}>
                  <History size={18} className="opacity-70" />
                  <span className="text-sm">Historial de Búsquedas</span>
                </button>
                <button className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--secondary-hover-color)] transition-colors text-left w-full" onClick={() => { setIsPresenting(true); setIsSidebarOpen(false); }}>
                  <Maximize2 size={18} className="opacity-70" />
                  <span className="text-sm">Modo Presentación</span>
                </button>
                <button className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--secondary-hover-color)] transition-colors text-left w-full" onClick={shareConversation}>
                  <Share size={18} className="opacity-70" />
                  <span className="text-sm">Compartir</span>
                </button>
                <button 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--secondary-hover-color)] transition-colors text-left text-red-400 w-full"
                  onClick={() => { setShowClearConfirm(true); setIsSidebarOpen(false); }}
                >
                  <Trash2 size={18} />
                  <span className="text-sm">Vaciar Chat</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-[10px] uppercase font-bold opacity-40 px-2">Funciones de IrisAI</p>
              <div className="space-y-3 px-2">
                {[
                  { icon: <MessageSquare className="text-blue-400" />, title: "Chat Inteligente", desc: "Motor Gemini de última generación para respuestas detalladas." },
                  { icon: <Code className="text-purple-400" />, title: "Modo Programación", desc: "Analista de código experto con soporte para múltiples lenguajes." },
                  { icon: <Camera className="text-green-400" />, title: "Análisis de Imágenes", desc: "Sube fotos para que Iris las reconozca y analice." },
                  { icon: <Paperclip className="text-orange-400" />, title: "Soporte de Documentos", desc: "Análisis profundo de archivos de texto y código." },
                  { icon: <Mic className="text-red-400" />, title: "Comandos de Voz", desc: "Háblale a Iris y ella transcribirá tus palabras." },
                  { icon: <Globe className="text-cyan-400" />, title: "Búsqueda Wikipedia", desc: "Verificación de datos en tiempo real con Wikipedia." },
                  { icon: <Maximize2 className="text-yellow-400" />, title: "Modo Presentación", desc: "Interfaz limpia y gigante para presentaciones." },
                  { icon: <Settings className="text-gray-400" />, title: "Multidioma", desc: "Configura el idioma de voz preferido." },
                ].map((f, i) => (
                  <div key={i} className="flex gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
                    <div className="mt-1">{f.icon}</div>
                    <div>
                      <p className="text-xs font-bold">{f.title}</p>
                      <p className="text-[10px] opacity-50 leading-tight">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-white/5 pt-4 flex gap-2">
          <button 
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${sidebarView === 'history' ? 'bg-blue-500/20 text-blue-400' : 'opacity-40 hover:opacity-100'}`}
            onClick={() => setSidebarView('history')}
          >
            <History size={20} />
            <span className="text-[9px] font-bold uppercase">Chats</span>
          </button>
          <button 
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${sidebarView === 'settings' ? 'bg-blue-500/20 text-blue-400' : 'opacity-40 hover:opacity-100'}`}
            onClick={() => setSidebarView('settings')}
          >
            <Settings size={20} />
            <span className="text-[9px] font-bold uppercase">Funciones</span>
          </button>
          <button 
            className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl opacity-40 hover:opacity-100 transition-all"
            onClick={() => { setShowSettings(true); setIsSidebarOpen(false); }}
          >
            <HelpCircle size={20} />
            <span className="text-[9px] font-bold uppercase">Ajustes</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {messages.length === 0 ? (
          <div className="header">
            <motion.div 
              className="header__title flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <img 
                src="/src/icon.png" 
                alt="IrisAI Logo" 
                className="w-24 h-24 rounded-3xl mb-6 shadow-2xl border border-white/10 object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <h1>{botMode === 'normal' ? 'IrisAI' : 'IrisAI Programación'}</h1>
              <h2>{botMode === 'normal' ? '¿En qué puedo ayudarte hoy?' : '¿Qué vamos a programar hoy?'}</h2>
            </motion.div>
          </div>
        ) : (
          <div className="chats">
            {messages.map((msg, index) => (
              <motion.div 
                key={index} 
                className={`message ${msg.role === 'user' ? 'message--outgoing' : 'message--incoming'}`}
                initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="message__text">
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="Uploaded" 
                      className="max-w-full h-auto rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(msg.image, '_blank')}
                    />
                  )}
                  {msg.file && (
                    <div className="bg-[var(--secondary-hover-color)] p-3 rounded-lg mb-2 flex items-center gap-3 border border-blue-500/30">
                      <FileCode size={24} className="text-blue-400" />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate">{msg.file.name}</p>
                        <p className="text-[10px] opacity-50 uppercase">{msg.file.type || 'Documento'}</p>
                      </div>
                    </div>
                  )}
                  {msg.role === 'model' ? (
                    <div className="markdown-body">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                      {msg.searchQueries && msg.searchQueries.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[var(--secondary-hover-color)]">
                          <p className="text-xs font-bold flex items-center gap-1 mb-2 opacity-70">
                            <Search size={12} /> BÚSQUEDAS REALIZADAS:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.searchQueries.map((query, qIdx) => (
                              <a 
                                key={qIdx}
                                href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm bg-[var(--focus-color)] hover:bg-[var(--focus-hover-color)] px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                              >
                                {query}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {!isPresenting && (
                        <>
                          <div className="mt-3 pt-2 flex items-center gap-2 border-t border-[var(--secondary-hover-color)]">
                            <span className="text-[10px] uppercase font-bold opacity-40 mr-1">Acciones:</span>
                            <button 
                              onClick={() => handleFeedback(index, 'up')}
                              className={`p-1.5 rounded-md transition-all ${msg.feedback === 'up' ? 'bg-green-500/20 text-green-400' : 'hover:bg-[var(--secondary-hover-color)] opacity-40 hover:opacity-100'}`}
                              title="Útil"
                            >
                              <ThumbsUp size={14} />
                            </button>
                            <button 
                              onClick={() => handleFeedback(index, 'down')}
                              className={`p-1.5 rounded-md transition-all ${msg.feedback === 'down' ? 'bg-red-500/20 text-red-400' : 'hover:bg-[var(--secondary-hover-color)] opacity-40 hover:opacity-100'}`}
                              title="No útil"
                            >
                              <ThumbsDown size={14} />
                            </button>
                            <button 
                              onClick={() => copyToClipboard(msg.text, index)}
                              className={`p-1.5 rounded-md transition-all hover:bg-[var(--secondary-hover-color)] ${copiedIndex === index ? 'text-green-400' : 'opacity-40 hover:opacity-100'}`}
                              title="Copiar mensaje"
                            >
                              {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>

                          {!wikiResults[index] && (
                            <button 
                              onClick={() => searchWikipedia(index, messages[index-1]?.text || msg.text)}
                              disabled={isSearchingWiki === index}
                              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-xs font-bold mt-6 pt-4 border-t border-white/5 transition-colors group w-full"
                            >
                              {isSearchingWiki === index ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Globe size={14} className="group-hover:rotate-12 transition-transform" />
                              )}
                              <span>BUSCAR EN LÍNEA (WIKIPEDIA)</span>
                            </button>
                          )}
                        </>
                      )}

                      {wikiResults[index] && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mt-6 text-sm"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-blue-400 flex items-center gap-2">
                              <Globe size={16} /> {wikiResults[index].title}
                            </h4>
                            <a 
                              href={wikiResults[index].url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                          <p className="text-[var(--text-secondary-color)] leading-relaxed mb-2">
                            {wikiResults[index].extract}
                          </p>
                          <a 
                            href={wikiResults[index].url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-blue-400/60 hover:text-blue-400 underline"
                          >
                            Fuente: Wikipedia
                          </a>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div>{msg.text}</div>
                      {!isPresenting && (
                        <div className="flex justify-end pt-1 border-t border-white/10 mt-1">
                          <button 
                            onClick={() => copyToClipboard(msg.text, index)}
                            className={`p-1 rounded-md transition-all hover:bg-white/10 ${copiedIndex === index ? 'text-green-400' : 'opacity-40 hover:opacity-100'}`}
                            title="Copiar mensaje"
                          >
                            {copiedIndex === index ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {isGenerating && (
              <div className="message message--incoming">
                <div className="message__text italic opacity-50">
                  IrisAI está pensando...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {/* Prompt */}
      {!isPresenting && (
        <section className="prompt">
          <form className="prompt__form" onSubmit={handleSend}>
            {selectedImage && (
              <div className="mb-2 relative inline-block">
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="h-20 w-auto rounded-lg border border-[var(--secondary-hover-color)]" 
                />
                <button 
                  type="button"
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                  onClick={() => setSelectedImage(null)}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {selectedFile && (
              <div className="mb-2 relative inline-block">
                <div className="h-20 w-40 flex flex-col items-center justify-center bg-[var(--secondary-color)] rounded-lg border border-blue-500/50 p-2">
                  <FileCode size={24} className="text-blue-400 mb-1" />
                  <p className="text-[10px] font-bold truncate w-full text-center">{selectedFile.name}</p>
                </div>
                <button 
                  type="button"
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                  onClick={() => setSelectedFile(null)}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="prompt__input-wrapper">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                id="image-upload"
                onChange={handleImageChange}
              />
              <input 
                type="file" 
                accept=".js,.ts,.tsx,.html,.css,.py,.java,.c,.cpp,.txt,.json,.md" 
                className="hidden" 
                id="file-upload"
                onChange={handleFileChange}
              />
              <button 
                type="button" 
                className="prompt__form-button" 
                title="Subir imagen"
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <Camera size={18} />
              </button>
              <button 
                type="button" 
                className="prompt__form-button" 
                title="Subir documento"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Paperclip size={18} />
              </button>
              <input 
                type="text" 
                placeholder="Escribe tu pregunta..." 
                className="prompt__form-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isGenerating}
              />
              <button 
                type="button" 
                className={`prompt__form-button ${isRecording ? 'text-red-500 animate-pulse' : ''}`} 
                title={isRecording ? "Detener grabación" : "Voz"}
                onClick={toggleRecording}
              >
                {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
              </button>
              <button 
                type="submit" 
                className={`prompt__form-button prompt__form-button--send ${!input.trim() || isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!input.trim() || isGenerating}
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-center text-[10px] text-[var(--placeholder-color)] mt-2">
              IrisAI puede cometer errores. Considera verificar la información importante.
            </p>
          </form>
        </section>
      )}

      {/* Search History Modal */}
      <AnimatePresence>
        {showSearchHistory && (
          <motion.div 
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-[var(--primary-color)] border border-[var(--secondary-hover-color)] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="p-4 border-b border-[var(--secondary-hover-color)] flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-[var(--text-color)]">
                  <History size={20} /> Historial de Búsquedas
                </h3>
                <button onClick={() => setShowSearchHistory(false)} className="p-1 hover:bg-[var(--secondary-hover-color)] rounded-full text-[var(--text-color)]">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {messages.some(m => m.searchQueries && m.searchQueries.length > 0) ? (
                  <div className="space-y-4">
                    {messages.filter(m => m.searchQueries && m.searchQueries.length > 0).map((m, idx) => (
                      <div key={idx} className="bg-[var(--secondary-color)] p-3 rounded-xl border border-[var(--secondary-hover-color)]">
                        <p className="text-xs opacity-50 mb-2 italic text-[var(--text-color)]">Contexto: "{m.text.substring(0, 60)}..."</p>
                        <div className="flex flex-wrap gap-2">
                          {m.searchQueries?.map((query, qIdx) => (
                            <a 
                              key={qIdx}
                              href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm bg-[var(--focus-color)] hover:bg-[var(--focus-hover-color)] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-[var(--text-color)]"
                            >
                              <Search size={14} /> {query}
                            </a>
                          ))}
                        </div>
                      </div>
                    )).reverse()}
                  </div>
                ) : (
                  <div className="text-center py-12 opacity-50 text-[var(--text-color)]">
                    <Search size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No se han realizado búsquedas aún.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear History Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-[var(--primary-color)] border border-[var(--secondary-hover-color)] w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <Trash2 size={48} className="mx-auto mb-4 text-red-500" />
              <h3 className="text-xl font-bold mb-2 text-[var(--text-color)]">¿Vaciar historial?</h3>
              <p className="text-[var(--text-secondary-color)] mb-6">
                Esta acción borrará todos los mensajes de esta conversación. No se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 p-3 rounded-xl bg-[var(--secondary-color)] hover:bg-[var(--secondary-hover-color)] transition-colors text-[var(--text-color)]"
                >
                  Cancelar
                </button>
                <button 
                  onClick={clearHistory}
                  className="flex-1 p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                >
                  Vaciar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-[var(--primary-color)] border border-[var(--secondary-hover-color)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="p-4 border-b border-[var(--secondary-hover-color)] flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-[var(--text-color)]">
                  <HelpCircle size={20} /> Ayuda y Soporte
                </h3>
                <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-[var(--secondary-hover-color)] rounded-full text-[var(--text-color)]">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[var(--text-color)]">
                <section>
                  <h4 className="font-bold text-blue-400 mb-2">¿Qué es IrisAI?</h4>
                  <p className="text-sm text-[var(--text-secondary-color)]">
                    IrisAI es tu asistente personal inteligente. Puedes alternar entre el modo **Normal** para charlas generales y el modo **Programación** para ayuda técnica.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-blue-400 mb-2">Funciones Principales</h4>
                  <ul className="text-sm text-[var(--text-secondary-color)] space-y-2 list-disc pl-4">
                    <li>**Búsqueda en Línea:** IrisAI consulta Google para darte información actualizada.</li>
                    <li>**Análisis de Imágenes:** Sube fotos para que la IA las analice.</li>
                    <li>**Subida de Documentos:** Comparte archivos de código (JS, HTML, CSS, etc.) para recibir ayuda técnica precisa.</li>
                    <li>**Entrada de Voz:** Dicta tus preguntas usando el micrófono.</li>
                    <li>**Persistencia:** Tu historial se guarda automáticamente en tu navegador.</li>
                  </ul>
                </section>
                <section>
                  <h4 className="font-bold text-blue-400 mb-2">Contacto</h4>
                  <p className="text-sm text-[var(--text-secondary-color)]">
                    Si tienes problemas, puedes contactarnos en: <br/>
                    <a href="mailto:benitezadrian978@gmail.com" className="text-blue-400 hover:underline">benitezadrian978@gmail.com</a>
                  </p>
                </section>
              </div>
              <div className="p-4 bg-[var(--secondary-color)] text-center">
                <button 
                  onClick={() => setShowHelp(false)}
                  className="px-6 py-2 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-[var(--primary-color)] border border-[var(--secondary-hover-color)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="p-4 border-b border-[var(--secondary-hover-color)] flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-[var(--text-color)]">
                  <Settings size={20} /> Preferencias
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-[var(--secondary-hover-color)] rounded-full text-[var(--text-color)]">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6 text-[var(--text-color)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">Modo Oscuro</p>
                    <p className="text-xs opacity-50">Cambia la apariencia de la interfaz</p>
                  </div>
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-blue-500' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isDarkMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="font-bold">Modo del Bot</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setBotMode('normal')}
                      className={`p-2 rounded-lg border transition-all text-sm ${botMode === 'normal' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-[var(--secondary-hover-color)] opacity-50'}`}
                    >
                      Normal
                    </button>
                    <button 
                      onClick={() => setBotMode('programming')}
                      className={`p-2 rounded-lg border transition-all text-sm ${botMode === 'programming' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-[var(--secondary-hover-color)] opacity-50'}`}
                    >
                      Programación
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold">Idioma de Voz</p>
                  <select 
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--secondary-color)] border border-[var(--secondary-hover-color)] text-sm outline-none focus:border-blue-500"
                  >
                    <option value="es-ES">Español (España)</option>
                    <option value="es-MX">Español (México)</option>
                    <option value="en-US">Inglés (EE.UU.)</option>
                    <option value="pt-BR">Portugués (Brasil)</option>
                  </select>
                </div>
              </div>
              <div className="p-4 bg-[var(--secondary-color)] text-center">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-2 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[999] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
