

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, ChevronRight } from 'lucide-react';
import { signaling } from '../services/socket';
import { ChatMessage } from '../types';

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  peerNames?: Map<string, string>;
  myUserName?: string;
  onNewMessage?: (senderName: string, text: string) => void;
}

const Chat: React.FC<ChatProps> = ({ isOpen, onClose, roomId, userId, peerNames, myUserName, onNewMessage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for incoming messages
    signaling.on('chat-message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId !== userId) {
        const senderName = peerNames?.get(msg.senderId) || 'Someone';
        onNewMessage?.(senderName, msg.text);
      }
    });

    return () => {
      signaling.off('chat-message');
    };
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: userId,
      text: newMessage,
      timestamp: Date.now(),
    };

    // Add locally
    setMessages((prev) => [...prev, message]);
    
    // Send to server
    signaling.emit('chat-message', { roomId, message });
    
    setNewMessage('');
  };

  const getSenderName = (id: string) => {
      if (id === userId) return myUserName || 'You';
      return peerNames?.get(id) || `Peer ${id.slice(0, 2)}`;
  };

  return (
    <div 
      className={`absolute top-20 bottom-24 right-6 w-[360px] max-w-[calc(100vw-48px)] z-40 flex flex-col 
        bg-zinc-950/90 backdrop-blur-2xl border border-zinc-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] 
        transform transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) origin-right
        ${isOpen ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-[20px] opacity-0 scale-95 pointer-events-none'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5 rounded-t-3xl">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
                <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
                <h3 className="font-bold text-white text-sm">Room Chat</h3>
                <p className="text-[10px] text-zinc-400 font-mono">End-to-end encrypted</p>
            </div>
        </div>
        <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
        >
          <X className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 overscroll-contain pr-4 select-text">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                    <MessageSquare className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500">No messages yet.<br/>Start the conversation!</p>
            </div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.senderId === userId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
              <div className="flex items-end gap-2 max-w-[90%]">
                  {!isMe && (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center text-[9px] text-zinc-400 font-bold overflow-hidden" title={getSenderName(msg.senderId)}>
                          {getSenderName(msg.senderId).slice(0, 1)}
                      </div>
                  )}
                  <div className="flex flex-col">
                    {!isMe && <span className="text-[10px] text-zinc-500 ml-1 mb-0.5">{getSenderName(msg.senderId)}</span>}
                    <div 
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isMe 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/50 rounded-bl-none'
                        }`}
                    >
                        {msg.text}
                    </div>
                  </div>
              </div>
              <span className={`text-[10px] text-zinc-500 mt-1.5 ${isMe ? 'mr-1' : 'ml-9'}`}>
                 {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-zinc-900/30 rounded-b-3xl">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-black/40 border border-zinc-800/50 hover:border-zinc-700 focus:border-blue-500/50 rounded-2xl pl-5 pr-12 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all shadow-inner"
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="absolute right-2 p-2 bg-blue-600 rounded-xl text-white hover:bg-blue-500 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95"
          >
            {newMessage.trim() ? <Send className="w-4 h-4" /> : <ChevronRight className="w-4 h-4"/>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
