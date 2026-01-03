import { useState, useRef, useEffect } from 'react';
import { sendMessageToOpenRouter } from '../services/openRouterService';
import type { ChatMessage } from '../services/openRouterService';
import { speechService } from '../services/speechService';
import { speechRecognitionService } from '../services/speechRecognitionService';
import { systemService } from '../services/systemService';
import './ChatInterface.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isSystemAction?: boolean;
}

// Remove emojis from text for cleaner responses
const removeEmojis = (text: string): string => {
  return text
    // Remove emoji characters (comprehensive regex)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical Symbols
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows-C
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '') // Mahjong Tiles
    .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '') // Playing Cards
    .replace(/\s+/g, ' ')                    // Clean up extra spaces
    .trim();
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Good day. I am J.A.R.V.I.S., your personal AI assistant. I can answer questions, open applications, and assist with various tasks. How may I be of service?',
      timestamp: new Date(),
    },
  ]);
  // Ref to keep track of the last assistant message for subtitle
  const lastAssistantMessageRef = useRef<Message | null>(null);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [currentVoiceName, setCurrentVoiceName] = useState<string>('Loading...');
  const [voiceAgentActive, setVoiceAgentActive] = useState(false);
  const [voiceAgentState, setVoiceAgentState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [listenProgress, setListenProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voiceAgentRef = useRef<boolean>(false);
  const listenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBufferRef = useRef<string>('');
  const lastFinalTranscriptRef = useRef<string>('');
  const messagesRef = useRef<Message[]>(messages);

  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Update voice name display
  useEffect(() => {
    const updateVoiceName = () => {
      const voice = speechService.getCurrentVoice();
      if (voice) {
        // Shorten the name for display
        let name = voice.name
          .replace('Microsoft ', '')
          .replace('Google ', '')
          .replace(' Desktop', '')
          .replace(' Online', '')
          .replace(' (Natural)', '');
        setCurrentVoiceName(name);
      }
    };
    
    updateVoiceName();
    // Check again after voices load
    const timer = setTimeout(updateVoiceName, 1000);
    return () => clearTimeout(timer);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check server status on mount and periodically
  useEffect(() => {
    const checkServer = async () => {
      setServerStatus('checking');
      const online = await systemService.checkServerHealth();
      setServerStatus(online ? 'online' : 'offline');
    };

    checkServer();
    const interval = setInterval(checkServer, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Update speaking state
  useEffect(() => {
    const checkSpeaking = setInterval(() => {
      const speaking = speechService.isSpeaking();
      setIsSpeaking(speaking);
      if (!speaking) {
        setSpeakingMessageId(null);
      }
    }, 100);

    return () => clearInterval(checkSpeaking);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up voice agent resources
      if (listenTimerRef.current) {
        clearTimeout(listenTimerRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      speechRecognitionService.stop();
      speechService.stop();
    };
  }, []);


  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const handleSpeak = async (messageId: string, content: string) => {
    if (speakingMessageId === messageId) {
      speechService.stop();
      setSpeakingMessageId(null);
    } else {
      speechService.stop();
      setSpeakingMessageId(messageId);
      try {
        await speechService.speak(content);
      } catch (error) {
        console.error('Speech error:', error);
      }
      setSpeakingMessageId(null);
    }
  };

  const toggleAutoSpeak = () => {
    const newState = !autoSpeak;
    setAutoSpeak(newState);
    speechService.setAutoSpeak(newState);
  };

  const cycleVoice = () => {
    const newVoiceName = speechService.nextVoice();
    let displayName = newVoiceName
      .replace('Microsoft ', '')
      .replace('Google ', '')
      .replace(' Desktop', '')
      .replace(' Online', '')
      .replace(' (Natural)', '');
    setCurrentVoiceName(displayName);
    
    // Speak a sample to preview the voice
    speechService.speak('Voice changed. How does this sound?');
  };

  // Voice Agent Mode - Continuous conversation
  const startVoiceAgent = () => {
    if (!speechRecognitionService.isSupported()) {
      alert('Voice recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }
    
    setVoiceAgentActive(true);
    voiceAgentRef.current = true;
    setVoiceAgentState('speaking');
    
    // Greet the user
    const greeting = "Voice agent activated. I'm listening.";
    speechService.speak(greeting).then(() => {
      if (voiceAgentRef.current) {
        startVoiceAgentListening();
      }
    });
  };

  const stopVoiceAgent = () => {
    voiceAgentRef.current = false;
    setVoiceAgentActive(false);
    setVoiceAgentState('idle');
    setListenProgress(0);
    setInterimTranscript('');
    
    // Clear all timers
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    transcriptBufferRef.current = '';
    lastFinalTranscriptRef.current = '';
    speechRecognitionService.stop();
    speechService.stop();
  };

  const LISTEN_DURATION = 5000; // 5 seconds listening window

  const startVoiceAgentListening = () => {
    if (!voiceAgentRef.current) return;
    
    // Clear any existing timers first
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    setVoiceAgentState('listening');
    setListenProgress(0);
    setInterimTranscript('');
    transcriptBufferRef.current = '';
    lastFinalTranscriptRef.current = '';
    
    // Small delay to ensure speech synthesis is fully stopped
    setTimeout(() => {
      if (!voiceAgentRef.current) return;
      
      speechRecognitionService.start();

      // Progress animation
      const startTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        if (!voiceAgentRef.current) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          return;
        }
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / LISTEN_DURATION) * 100, 100);
        setListenProgress(progress);
        
        if (elapsed >= LISTEN_DURATION) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }
      }, 50);

      // Stop listening after duration and process
      listenTimerRef.current = setTimeout(() => {
        // Clear progress interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        if (voiceAgentRef.current) {
          speechRecognitionService.stop();
          setListenProgress(100);
          setInterimTranscript('');
          
          // Process accumulated transcript
          const transcript = transcriptBufferRef.current.trim();
          transcriptBufferRef.current = '';
          lastFinalTranscriptRef.current = '';
          
          if (transcript) {
            handleVoiceAgentResponse(transcript);
          } else {
            // No speech detected, restart listening
            setTimeout(() => {
              if (voiceAgentRef.current) {
                startVoiceAgentListening();
              }
            }, 300);
          }
        }
      }, LISTEN_DURATION);
    }, 100);
  };

  const handleVoiceAgentResponse = async (userText: string) => {
    if (!voiceAgentRef.current || !userText.trim()) {
      // If empty, restart listening
      if (voiceAgentRef.current) {
        startVoiceAgentListening();
      }
      return;
    }

    setVoiceAgentState('processing');

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Check for system command
      const appToOpen = systemService.parseOpenCommand(userText);
      
      let responseText: string;
      let isSystemAction = false;

      if (appToOpen) {
        const result = await systemService.openApplication(appToOpen);
        responseText = result.message;
        isSystemAction = true;
      } else {
        // Check for stop commands
        const lowerText = userText.toLowerCase();
        if (lowerText.includes('stop') || lowerText.includes('exit') || 
            lowerText.includes('goodbye') || lowerText.includes('bye') ||
            lowerText.includes('deactivate') || lowerText.includes('shut up')) {
          stopVoiceAgent();
          const farewell: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Voice agent deactivated. Goodbye.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, farewell]);
          speechService.speak('Voice agent deactivated. Goodbye.');
          return;
        }

        // Regular AI conversation
        const previousMessages: ChatMessage[] = messagesRef.current.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        const response = await sendMessageToOpenRouter(previousMessages, userText);
        responseText = removeEmojis(response);
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        isSystemAction,
      };
      lastAssistantMessageRef.current = assistantMessage;
      setMessages((prev) => [...prev, assistantMessage]);

      // Speak the response
      if (voiceAgentRef.current) {
        setVoiceAgentState('speaking');
        await speechService.speak(responseText);
        
        // After speaking, start listening again
        if (voiceAgentRef.current) {
          startVoiceAgentListening();
        }
      }
    } catch (error) {
      console.error('Voice agent error:', error);
      if (voiceAgentRef.current) {
        const errorMsg = 'I encountered an error. Please try again.';
        speechService.speak(errorMsg).then(() => {
          if (voiceAgentRef.current) {
            startVoiceAgentListening();
          }
        });
      }
    }
  };

  // Setup voice agent speech recognition - only once on mount
  useEffect(() => {
    if (!speechRecognitionService.isSupported()) return;

    speechRecognitionService.onResult((transcript, isFinal) => {
      if (voiceAgentRef.current) {
        // Accumulate transcript in buffer for voice agent
        if (isFinal) {
          // Only add if this is a new final transcript (not a duplicate)
          const trimmedTranscript = transcript.trim();
          if (trimmedTranscript && trimmedTranscript !== lastFinalTranscriptRef.current) {
            // Add space only if buffer already has content
            if (transcriptBufferRef.current.trim()) {
              transcriptBufferRef.current += ' ' + trimmedTranscript;
            } else {
              transcriptBufferRef.current = trimmedTranscript;
            }
            lastFinalTranscriptRef.current = trimmedTranscript;
            // Clear interim and show the final captured text
            setInterimTranscript(transcriptBufferRef.current.trim());
          }
        } else {
          // Show interim as visual feedback (current buffer + new interim)
          const currentBuffer = transcriptBufferRef.current.trim();
          setInterimTranscript(currentBuffer ? currentBuffer + ' ' + transcript : transcript);
        }
      } else {
        // Normal mode behavior
        if (isFinal) {
          setInput(prev => {
            const separator = prev.trim() ? ' ' : '';
            return prev.trim() + separator + transcript;
          });
          setInterimTranscript('');
        } else {
          setInterimTranscript(transcript);
        }
      }
    });

    speechRecognitionService.onStart(() => {
      setIsListening(true);
    });

    speechRecognitionService.onEnd(() => {
      setIsListening(false);
      // Don't clear interim here for voice agent - timer handles it
      if (!voiceAgentRef.current) {
        setInterimTranscript('');
      }
    });

    speechRecognitionService.onError((error) => {
      console.error('Speech recognition error:', error);
      setIsListening(false);
      setInterimTranscript('');
      
      if (voiceAgentRef.current) {
        // Clear timers
        if (listenTimerRef.current) {
          clearTimeout(listenTimerRef.current);
          listenTimerRef.current = null;
        }
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        // Restart listening after error
        setTimeout(() => {
          if (voiceAgentRef.current) {
            startVoiceAgentListening();
          }
        }, 500);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = () => {
    if (isListening) {
      speechRecognitionService.stop();
    } else {
      speechService.stop();
      const started = speechRecognitionService.start();
      if (!started) {
        console.error('Failed to start speech recognition');
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (isListening) {
      speechRecognitionService.stop();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setInterimTranscript('');
    setIsLoading(true);

    try {
      // Check if this is a system command (open app)
      const appToOpen = systemService.parseOpenCommand(userInput);
      
      if (appToOpen) {
        // Handle system command locally
        const result = await systemService.openApplication(appToOpen);
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
          isSystemAction: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (autoSpeak) {
          setTimeout(() => {
            handleSpeak(assistantMessage.id, result.message);
          }, 100);
        }
      } else {
        // Regular AI conversation
        const previousMessages: ChatMessage[] = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await sendMessageToOpenRouter(previousMessages, userInput);
        const cleanResponse = removeEmojis(response);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: cleanResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (autoSpeak) {
          setTimeout(() => {
            handleSpeak(assistantMessage.id, cleanResponse);
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I've encountered a system error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try your request again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayValue = input + (interimTranscript ? (input ? ' ' : '') + interimTranscript : '');

  return (
    <div className="chat-container">
      {/* Premium Header */}
      <header className="chat-header">
        <div className="arc-reactor">
          <div className="arc-reactor-core" />
        </div>
        <div className="header-content">
          <h1>J.A.R.V.I.S.</h1>
          <span className="header-subtitle">Just A Rather Very Intelligent System</span>
        </div>
        <div className="header-controls">
          <button 
            className="voice-selector"
            onClick={cycleVoice}
            title="Click to change voice"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <span className="voice-name">{currentVoiceName}</span>
          </button>
          <button 
            className={`auto-speak-toggle ${autoSpeak ? 'active' : ''}`}
            onClick={toggleAutoSpeak}
            title={autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF'}
          >
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {autoSpeak && (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
            </svg>
            <span className="toggle-label">{autoSpeak ? 'Auto' : 'Manual'}</span>
          </button>
          <div className={`header-status ${serverStatus === 'online' ? 'system-ready' : ''}`}>
            <span className={`status-dot ${serverStatus === 'online' ? 'system-online' : serverStatus === 'offline' ? 'system-offline' : ''}`} />
            <span className="status-text">
              {serverStatus === 'online' ? 'System Ready' : serverStatus === 'offline' ? 'AI Only' : 'Checking...'}
            </span>
          </div>
        </div>
      </header>

      {/* Messages Display */}
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'} ${message.isSystemAction ? 'system-action' : ''}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="message-content">
              <div className="message-avatar">
                {message.role === 'user' ? 'YOU' : 'J'}
              </div>
              <div className="message-body">
                <div className="message-header">
                  <div className="message-role">
                    {message.role === 'user' ? 'Commander' : 'J.A.R.V.I.S.'}
                    {message.isSystemAction && <span className="system-badge">SYSTEM</span>}
                  </div>
                  {message.role === 'assistant' && (
                    <button
                      className={`speak-button ${speakingMessageId === message.id ? 'speaking' : ''}`}
                      onClick={() => handleSpeak(message.id, message.content)}
                      title={speakingMessageId === message.id ? 'Stop speaking' : 'Speak message'}
                    >
                      {speakingMessageId === message.id ? (
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="currentColor"
                        >
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                <div className="message-text">{message.content}</div>
                <div className="message-timestamp">{formatTime(message.timestamp)}</div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading State */}
        {isLoading && (
          <div className="message assistant-message">
            <div className="message-content">
              <div className="message-avatar">J</div>
              <div className="message-body">
                <div className="message-role">J.A.R.V.I.S.</div>
                <div className="message-text">
                  <span className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-container">
        <div className={`chat-input-wrapper ${isListening ? 'listening' : ''}`}>
          {/* Voice Input Button */}
          {speechRecognitionService.isSupported() && (
            <button
              className={`voice-input-button ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
              disabled={isLoading}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? (
                <svg 
                  width="22" 
                  height="22" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg 
                  width="22" 
                  height="22" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
              {isListening && (
                <span className="listening-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              )}
            </button>
          )}
          
          <textarea
            ref={inputRef}
            className="chat-input"
            value={displayValue}
            onChange={(e) => {
              setInput(e.target.value);
              setInterimTranscript('');
            }}
            onKeyDown={handleKeyPress}
            placeholder={isListening ? "Listening..." : "Enter your command... (try 'open calculator')"}
            rows={1}
            disabled={isLoading}
          />
          <button
            className="send-button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
        {isListening && !voiceAgentActive && (
          <div className="listening-status">
            <span className="listening-dot"></span>
            Listening... speak now
          </div>
        )}
      </div>

      {/* Voice Agent Button */}
      <button
        className={`voice-agent-button ${voiceAgentActive ? 'active' : ''}`}
        onClick={voiceAgentActive ? stopVoiceAgent : startVoiceAgent}
        title={voiceAgentActive ? 'Stop Voice Agent' : 'Start Voice Agent'}
      >
        {voiceAgentActive ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
            <path d="M8 22h8" />
          </svg>
        )}
      </button>

      {/* Voice Agent Overlay */}
      {voiceAgentActive && (
        <div className="voice-agent-overlay">
          <div className="voice-agent-container">
            <div className={`voice-agent-orb ${voiceAgentState}`}>
              <div className="orb-core"></div>
              <div className="orb-ring ring-1"></div>
              <div className="orb-ring ring-2"></div>
              <div className="orb-ring ring-3"></div>
            </div>
             <div className="voice-agent-status">
               {voiceAgentState === 'processing' && 'Processing...'}
               {voiceAgentState === 'speaking' && 'Speaking...'}
               {voiceAgentState === 'idle' && 'Ready'}
             </div>
             {/* Large centered subtitle for listening mode */}
             {voiceAgentState === 'listening' && (
               <div className="voice-agent-listening-subtitle">
                 LISTENING...
               </div>
             )}
             {/* Subtitle for AI speaking mode */}
             {voiceAgentState === 'speaking' && lastAssistantMessageRef.current && (
               <div className="voice-agent-transcript ai-speaking-subtitle">
                 "{lastAssistantMessageRef.current.content}"
               </div>
             )}
            {voiceAgentState === 'listening' && (
              <div className="listen-progress-container">
                <div 
                  className="listen-progress-bar" 
                  style={{ width: `${listenProgress}%` }}
                />
              </div>
            )}
            {(interimTranscript || transcriptBufferRef.current.trim()) && voiceAgentState === 'listening' && (
              <div className="voice-agent-transcript">
                "{interimTranscript || transcriptBufferRef.current.trim()}"
              </div>
            )}
            <div className="voice-agent-hint">
              Say "goodbye" or "stop" to exit
            </div>
            <button className="voice-agent-close" onClick={stopVoiceAgent}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
