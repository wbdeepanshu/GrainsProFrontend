import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Mic, MicOff, Volume2, VolumeX, Settings, X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
// import { useVoiceAssistant } from './SimpleVoiceAssistantProvider';

interface VoiceCommand {
  command: string;
  action: () => void;
  description: string;
  keywords: string[];
}

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  isWakeWordEnabled?: boolean;
  toggleWakeWord?: () => void;
}

const SimpleVoiceAssistant: React.FC<VoiceAssistantProps> = ({ isOpen, onClose, isWakeWordEnabled = false, toggleWakeWord }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [, setLocation] = useLocation();

  // Simplified voice commands
  const voiceCommands: VoiceCommand[] = [
    {
      command: 'go to dashboard',
      action: () => setLocation('/dashboard'),
      description: 'Navigate to Dashboard',
      keywords: ['dashboard', 'home', 'main page']
    },
    {
      command: 'go to help videos',
      action: () => setLocation('/help-videos'),
      description: 'Navigate to Help Videos',
      keywords: ['help videos', 'help video', 'training videos', 'tutorials']
    },
    {
      command: 'go to customer analysis',
      action: () => setLocation('/reports/customer-analysis'),
      description: 'Navigate to Customer Analysis',
      keywords: ['customer analysis']
    },
    {
      command: 'go to user analysis',
      action: () => setLocation('/reports/salesman-analysis'),
      description: 'Navigate to User Analysis',
      keywords: ['user analysis', 'salesman analysis']
    },
    {
      command: 'go to item analysis',
      action: () => setLocation('/reports/item-analysis'),
      description: 'Navigate to Item Analysis',
      keywords: ['item analysis']
    },
    {
      command: 'go to voucher analysis',
      action: () => setLocation('/reports/voucher-analysis'),
      description: 'Navigate to Voucher Analysis',
      keywords: ['voucher analysis']
    },
    {
      command: 'go to outstanding reports',
      action: () => setLocation('/reports/outstanding-reports'),
      description: 'Navigate to Outstanding Reports',
      keywords: ['outstanding reports', 'outstanding report']
    },
    {
      command: 'go to brokerage report',
      action: () => setLocation('/reports/brokerage-reports'),
      description: 'Navigate to Brokerage Report',
      keywords: ['brokerage report', 'brokerage reports']
    },
    {
      command: 'go to live stocks',
      action: () => setLocation('/live-stocks'),
      description: 'Navigate to Live Stocks',
      keywords: ['live stocks', 'live stock']
    },
    {
      command: 'go to loading batches',
      action: () => setLocation('/outward/loading-batches'),
      description: 'Navigate to Loading Batches',
      keywords: ['loading batches', 'loading batch']
    },
    {
      command: 'go to items mapping',
      action: () => setLocation('/items-mapping'),
      description: 'Navigate to Items Mapping',
      keywords: ['items mapping', 'item mapping']
    },
    {
      command: 'go to route activity',
      action: () => setLocation('/route-activity'),
      description: 'Navigate to Route Activity',
      keywords: ['route activity']
    },
    {
      command: 'go to users',
      action: () => setLocation('/users'),
      description: 'Navigate to User List',
      keywords: ['users', 'user list', 'user management']
    },
    {
      command: 'go to stock journals',
      action: () => setLocation('/reports/stock-journal'),
      description: 'Navigate to Stock Journals',
      keywords: ['reports menu', 'open reports', 'stock journals', 'stock journal']
    },
    {
      command: 'go to inward list',
      action: () => setLocation('/reports/inward-list'),
      description: 'Navigate to Inward List',
      keywords: ['inward list', 'inward reports', 'inward']
    },
    {
      command: 'go to masters',
      action: () => setLocation('/godown-masters'),
      description: 'Navigate to Masters',
      keywords: ['masters', 'master data', 'configuration']
    },
    {
      command: 'go to import data',
      action: () => setLocation('/import'),
      description: 'Navigate to Import Data',
      keywords: ['import', 'import data', 'upload data']
    },
    {
      command: 'go to route management',
      action: () => setLocation('/route-management'),
      description: 'Navigate to Route Management',
      keywords: ['route management', 'routes', 'route']
    },
    {
      command: 'go to margin settings',
      action: () => setLocation('/margin-settings/item-price-margin'),
      description: 'Navigate to Margin Settings',
      keywords: ['margin', 'margin settings', 'pricing']
    },
    {
      command: 'go to recent activity',
      action: () => setLocation('/recent-activity'),
      description: 'Navigate to Recent Activity',
      keywords: ['recent', 'activity', 'recent activity']
    },
    {
      command: 'go to voucher settings',
      action: () => setLocation('/voucher-settings'),
      description: 'Navigate to Voucher Settings',
      keywords: ['voucher', 'voucher settings', 'settings']
    },
    {
      command: 'go to banners',
      action: () => setLocation('/banners'),
      description: 'Navigate to Banners',
      keywords: ['banners', 'banner', 'advertisements', 'ads']
    },
    {
      command: 'show banners',
      action: () => setLocation('/banners'),
      description: 'Show Banners',
      keywords: ['show banners', 'view banners', 'banner management']
    },
    {
      command: 'add user',
      action: () => setLocation('/add-user'),
      description: 'Add new user',
      keywords: ['add user', 'new user', 'create user']
    },
    {
      command: 'add inward',
      action: () => setLocation('/add-inward'),
      description: 'Add new inward entry',
      keywords: ['add inward', 'new inward', 'create inward']
    },
    {
      command: 'add outward',
      action: () => setLocation('/outward/add-outward'),
      description: 'Add new outward entry',
      keywords: ['add outward', 'new outward', 'create outward', 'add gate pass']
    },
    {
      command: 'add purchase order',
      action: () => setLocation('/add-purchase-order'),
      description: 'Add new purchase order',
      keywords: ['add purchase order', 'new purchase order', 'create purchase order', 'add purchase']
    },
    {
      command: 'add sales order',
      action: () => setLocation('/create-sales-order'),
      description: 'Add new sales order',
      keywords: ['add sales order', 'new sales order', 'create sales order', 'add sales']
    },
    {
      command: 'add expense',
      action: () => setLocation('/add-expense'),
      description: 'Add new expense',
      keywords: ['add expense', 'new expense', 'create expense']
    },
    {
      command: 'add receipt',
      action: () => setLocation('/add-receipt'),
      description: 'Add new receipt',
      keywords: ['add receipt', 'new receipt', 'create receipt']
    },
    {
      command: 'add hamali',
      action: () => setLocation('/add-hamali'),
      description: 'Add new hamali entry',
      keywords: ['add hamali', 'new hamali', 'create hamali']
    },
    {
      command: 'refresh page',
      action: () => window.location.reload(),
      description: 'Refresh the current page',
      keywords: ['refresh', 'reload', 'update page']
    },
    {
      command: 'go back',
      action: () => window.history.back(),
      description: 'Go back to previous page',
      keywords: ['back', 'previous', 'go back']
    },
    {
      command: 'show help',
      action: () => setShowCommands(true),
      description: 'Show available voice commands',
      keywords: ['help', 'commands', 'what can you do']
    },
    {
      command: 'hide help',
      action: () => setShowCommands(false),
      description: 'Hide voice commands help',
      keywords: ['hide help', 'close help', 'hide commands']
    },
    {
      command: 'stop listening',
      action: () => stopListening(),
      description: 'Stop voice recognition',
      keywords: ['stop', 'stop listening', 'turn off mic']
    }
  ];

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setFeedback({ type: 'info', message: 'Listening...' });
        };

        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
          
          setTranscript(transcript);
          
          if (event.results[event.results.length - 1].isFinal) {
            processCommand(transcript);
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setFeedback({ 
            type: 'error', 
            message: `Error: ${event.error}` 
          });
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  // Process voice command
  const processCommand = useCallback((command: string) => {
    setIsProcessing(true);
    const normalizedCommand = command.toLowerCase().trim();
    
    // Find matching command
    const matchedCommand = voiceCommands.find(cmd => 
      cmd.keywords.some(keyword => 
        normalizedCommand.includes(keyword.toLowerCase())
      ) || normalizedCommand.includes(cmd.command.toLowerCase())
    );

    if (matchedCommand) {
      setLastCommand(command);
      setFeedback({ 
        type: 'success', 
        message: `Executing: ${matchedCommand.description}` 
      });
      
      // Speak confirmation
      speak(`Navigating to ${matchedCommand.description}`);
      
      // Execute command
      setTimeout(() => {
        matchedCommand.action();
        setIsProcessing(false);
      }, 1000);
    } else {
      setFeedback({ 
        type: 'error', 
        message: 'Command not recognized. Say "show help" for available commands.' 
      });
      speak('Command not recognized. Please try again or say show help for available commands.');
      setIsProcessing(false);
    }
  }, [voiceCommands]);

  // Start listening
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setFeedback(null);
      recognitionRef.current.start();
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Text-to-speech
  const speak = (text: string) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    
    if (synthesisRef.current) {
      speechSynthesis.cancel();
    }
    
    synthesisRef.current = new SpeechSynthesisUtterance(text);
    synthesisRef.current.volume = volume;
    synthesisRef.current.rate = 0.9;
    synthesisRef.current.pitch = 1;
    
    speechSynthesis.speak(synthesisRef.current);
  };

  // Clear feedback after delay
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-white shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold text-gray-900">
            Voice Assistant
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommands(!showCommands)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Status and Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  isListening ? "bg-green-500 animate-pulse" : "bg-gray-400"
                )} />
                <span className="text-sm text-gray-600">
                  {isListening ? 'Listening' : 'Ready'}
                </span>
              </div>
              
              {!isSupported && (
                <Badge variant="destructive" className="text-xs">
                  Voice not supported
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
                className="text-gray-600 hover:text-gray-900"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Main Control Button */}
          <div className="flex justify-center">
            <Button
              onClick={toggleListening}
              disabled={!isSupported || isProcessing}
              className={cn(
                "w-20 h-20 rounded-full transition-all duration-200",
                isListening 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-blue-500 hover:bg-blue-600 text-white",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isListening ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">You said:</h4>
              <p className="text-gray-900">{transcript}</p>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={cn(
              "p-4 rounded-lg flex items-center space-x-2",
              feedback.type === 'success' && "bg-green-50 text-green-800",
              feedback.type === 'error' && "bg-red-50 text-red-800",
              feedback.type === 'info' && "bg-blue-50 text-blue-800"
            )}>
              {feedback.type === 'success' && <CheckCircle className="h-4 w-4" />}
              {feedback.type === 'error' && <AlertCircle className="h-4 w-4" />}
              {feedback.type === 'info' && <AlertCircle className="h-4 w-4" />}
              <span className="text-sm">{feedback.message}</span>
            </div>
          )}

          {/* Last Command */}
          {lastCommand && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Last Command:</h4>
              <p className="text-blue-900">{lastCommand}</p>
            </div>
          )}

          {/* Commands Help */}
          {showCommands && (
            <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Available Voice Commands:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {voiceCommands.map((cmd, index) => (
                  <div key={index} className="text-xs text-gray-600">
                    <span className="font-medium">"{cmd.command}"</span>
                    <span className="text-gray-500"> - {cmd.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-center text-sm text-gray-500">
            <p>Click the microphone button and speak your command</p>
            <p>Try saying: "Go to dashboard" or "Show help"</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleVoiceAssistant;
