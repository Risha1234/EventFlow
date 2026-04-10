import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader, Zap } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
  source?: 'openai' | 'ollama' | 'none';
}

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AICopilot({ isOpen, onClose }: AICopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      text: "Hi! I'm your Event Copilot. Ask me anything about your events and I'll provide actionable insights! 🚀",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  const quickSuggestions = [
    'How is my event performing?',
    'Which event has highest demand?',
    'What should I improve?',
    'Show me registration trends'
  ];

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    setError('');
    setInputValue('');

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: text })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();

      // Add AI message with source information
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: data.answer,
        timestamp: new Date(),
        source: data.source || 'openai'
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('AI API error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );

      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sliding Panel */}
      <div
        className={`
          fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-zinc-950 border-l border-white/10 
          z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-gradient-to-r from-primary-600/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Zap className="text-white fill-white" size={16} />
            </div>
            <h2 className="text-lg font-bold text-white">Event Copilot</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-xs lg:max-w-md">
                <div
                  className={`
                    px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-br-none'
                        : 'bg-white/5 border border-white/10 text-zinc-200 rounded-bl-none'
                    }
                  `}
                >
                  {message.text}
                </div>
                
                {/* AI Source Badge */}
                {message.role === 'ai' && message.source === 'ollama' && (
                  <div className="mt-1 flex justify-start">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      ⚡ Powered by Local AI
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl rounded-bl-none">
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <Loader size={16} className="animate-spin" />
                  <span>AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions */}
        {messages.length <= 1 && !loading && (
          <div className="px-6 py-4 border-t border-white/5 space-y-2 bg-zinc-900/50">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Quick Questions</p>
            <div className="grid grid-cols-2 gap-2">
              {quickSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  className="text-xs px-3 py-2 rounded-lg border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 transition-all line-clamp-2"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-red-950/20 border-t border-red-900/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-center gap-3 p-4 border-t border-white/5 bg-zinc-900/50 backdrop-blur">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleSendMessage(inputValue);
              }
            }}
            placeholder="Ask about your events..."
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-600/50 focus:border-primary-600/50 disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || loading}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
