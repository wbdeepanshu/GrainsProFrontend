import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Mic, MicOff, Volume2, VolumeX, Settings, X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVoiceAssistant } from './VoiceAssistantProvider';

interface VoiceCommand {
  command: string;
  action: () => void;
  description: string;
  keywords: string[];
}

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ isOpen, onClose }) => {
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
  const { isWakeWordEnabled, toggleWakeWord } = useVoiceAssistant();

  // Voice commands configuration
  const voiceCommands: VoiceCommand[] = [
    // Navigation commands
    {
      command: 'go to dashboard',
      action: () => setLocation('/dashboard'),
      description: 'Navigate to Dashboard',
      keywords: ['dashboard', 'home', 'main page']
    },
    // Specific phrases first (sidebar Reports / Masters / Margin sub-items)
    {
      command: 'go to customer analysis',
      action: () => setLocation('/reports/customer-analysis'),
      description: 'Navigate to Customer Analysis',
      keywords: ['customer analysis', 'customer analytics']
    },
    {
      command: 'go to user analysis',
      action: () => setLocation('/reports/salesman-analysis'),
      description: 'Navigate to User Analysis',
      keywords: ['user analysis', 'salesman analysis', 'sales person analysis']
    },
    {
      command: 'go to item analysis',
      action: () => setLocation('/reports/item-analysis'),
      description: 'Navigate to Item Analysis',
      keywords: ['item analysis', 'product analysis']
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
      keywords: ['outstanding reports', 'outstanding report', 'ledger outstanding']
    },
    {
      command: 'go to brokerage report',
      action: () => setLocation('/reports/brokerage-reports'),
      description: 'Navigate to Brokerage Report',
      keywords: ['brokerage report', 'brokerage reports']
    },
    {
      command: 'go to brokerage configuration',
      action: () => setLocation('/margin-settings/brokerage-configuration'),
      description: 'Navigate to Brokerage Configuration',
      keywords: ['brokerage configuration', 'brokerage settings']
    },
    {
      command: 'go to help videos',
      action: () => setLocation('/help-videos'),
      description: 'Navigate to Help Videos',
      keywords: ['help videos', 'help video', 'training videos', 'video tutorials', 'tutorials']
    },
    {
      command: 'go to live stocks',
      action: () => setLocation('/live-stocks'),
      description: 'Navigate to Live Stocks',
      keywords: ['live stocks', 'view live stocks', 'live stock']
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
      keywords: ['items mapping', 'item mapping', 'items map']
    },
    {
      command: 'go to route activity',
      action: () => setLocation('/route-activity'),
      description: 'Navigate to Route Activity',
      keywords: ['route activity', 'route activities']
    },
    {
      command: 'go to users',
      action: () => setLocation('/users'),
      description: 'Navigate to User List',
      keywords: ['users', 'user list', 'user management']
    },
    {
      command: 'go to reports stock journals',
      action: () => setLocation('/reports/stock-journal'),
      description: 'Navigate to Stock Journals (Reports menu)',
      keywords: ['reports menu', 'reports section', 'open reports', 'stock journals', 'stock journal']
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
      keywords: ['route', 'route management', 'routes']
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
      command: 'go to privacy policy',
      action: () => setLocation('/privacy'),
      description: 'Navigate to Privacy Policy',
      keywords: ['privacy', 'privacy policy', 'policy']
    },
    {
      command: 'go to contact us',
      action: () => setLocation('/contact-us'),
      description: 'Navigate to Contact Us',
      keywords: ['contact', 'contact us', 'support']
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
    
    // Inward sub-navigation
    {
      command: 'show inward reports',
      action: () => setLocation('/reports/inward-list'),
      description: 'Show Inward Reports',
      keywords: ['inward', 'inward reports', 'inward list']
    },
    {
      command: 'show purchase reports',
      action: () => setLocation('/reports/purchaseorders-reports'),
      description: 'Show Purchase Reports',
      keywords: ['purchase', 'purchase reports', 'purchase orders']
    },
    
    // Outward sub-navigation
    {
      command: 'show sales order reports',
      action: () => setLocation('/reports/sales-order-list'),
      description: 'Show Sales Order Reports',
      keywords: ['sales', 'sales order', 'sales reports', 'sales order list']
    },
    {
      command: 'show gate pass report',
      action: () => setLocation('/outward/outward-list'),
      description: 'Show Gate Pass Report',
      keywords: ['gate pass', 'outward list', 'outward report', 'outward']
    },
    {
      command: 'show delivery notes',
      action: () => setLocation('/outward/delivery-notes'),
      description: 'Show Delivery Notes',
      keywords: ['delivery note', 'delivery notes']
    },
    {
      command: 'show invoices',
      action: () => setLocation('/outward/invoices'),
      description: 'Show Invoices',
      keywords: ['invoice', 'invoices']
    },
    
    // Report sub-navigation
    {
      command: 'show stock journals',
      action: () => setLocation('/reports/stock-journal'),
      description: 'Show Stock Journals',
      keywords: ['stock', 'stock journals', 'stock report']
    },
    {
      command: 'show machine reports',
      action: () => setLocation('/reports/machine-reports'),
      description: 'Show Machine Reports',
      keywords: ['machine', 'machine reports', 'equipment']
    },
    {
      command: 'show hamali reports',
      action: () => setLocation('/reports/hamali'),
      description: 'Show Hamali Reports',
      keywords: ['hamali', 'hamali reports', 'transport']
    },
    {
      command: 'show expense reports',
      action: () => setLocation('/reports/expense-list'),
      description: 'Show Expense Reports',
      keywords: ['expense', 'expense reports', 'expenses', 'expense list']
    },
    {
      command: 'show receipt reports',
      action: () => setLocation('/receipt-list'),
      description: 'Show Receipt Reports',
      keywords: ['receipt', 'receipt reports', 'receipts', 'receipt list']
    },
    
    // Master sub-navigation
    {
      command: 'show godown masters',
      action: () => setLocation('/godown-masters'),
      description: 'Show Godown Masters',
      keywords: ['godown', 'godown masters', 'warehouse']
    },
    {
      command: 'show item masters',
      action: () => setLocation('/item-masters'),
      description: 'Show Item Masters',
      keywords: ['item', 'item masters', 'items']
    },
    {
      command: 'show ledger masters',
      action: () => setLocation('/ledger-masters'),
      description: 'Show Ledger Masters',
      keywords: ['ledger', 'ledger masters', 'accounts']
    },
    {
      command: 'show testing params',
      action: () => setLocation('/lab-test-params'),
      description: 'Show Testing Parameters',
      keywords: ['testing', 'test params', 'lab test']
    },
    {
      command: 'show machine params',
      action: () => setLocation('/machine-params'),
      description: 'Show Machine Parameters',
      keywords: ['machine params', 'equipment params', 'machine settings']
    },
    {
      command: 'show hamali type masters',
      action: () => setLocation('/hamali-type-masters'),
      description: 'Show Hamali Type Masters',
      keywords: ['hamali type', 'hamali masters', 'transport types']
    },
    {
      command: 'show base price master',
      action: () => setLocation('/item-listing'),
      description: 'Show Base Price Master',
      keywords: ['base price', 'price master', 'item pricing']
    },
    
    // Margin Settings sub-navigation
    {
      command: 'show item price margin',
      action: () => setLocation('/margin-settings/item-price-margin'),
      description: 'Show Item Price Margin',
      keywords: ['item price margin', 'price margin', 'margin']
    },
    {
      command: 'show price master',
      action: () => setLocation('/price-master'),
      description: 'Show Price Master',
      keywords: ['price master', 'price masters']
    },
    {
      command: 'show branch settings',
      action: () => setLocation('/branches'),
      description: 'Show Branch Settings',
      keywords: ['branch settings', 'branch', 'branches']
    },
    
    // Route Management sub-navigation
    {
      command: 'create route',
      action: () => setLocation('/route-management'),
      description: 'Create Route',
      keywords: ['create route', 'new route', 'add route']
    },
    {
      command: 'assign route',
      action: () => setLocation('/route-assignment'),
      description: 'Assign Route',
      keywords: ['assign route', 'route assignment', 'assign']
    },
    
    // Action commands
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
    },
    
    // Quick actions
    {
      command: 'add new user',
      action: () => setLocation('/add-user'),
      description: 'Add a new user',
      keywords: ['add user', 'new user', 'create user']
    },
   
    {
      command: 'add inward entry',
      action: () => setLocation('/add-inward'),
      description: 'Add new inward entry',
      keywords: ['add inward', 'new inward', 'create inward']
    },
    {
      command: 'add outward entry',
      action: () => setLocation('/outward/add-outward'),
      description: 'Add new outward entry',
      keywords: ['add outward', 'new outward', 'create outward', 'add gate pass']
    },
    {
      command: 'add purchase order',
      action: () => setLocation('/add-purchase-order'),
      description: 'Add new purchase order',
      keywords: ['add purchase', 'new purchase', 'create purchase', 'add purchase order']
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
      command: 'create sales order',
      action: () => setLocation('/create-sales-order'),
      description: 'Create new sales order',
      keywords: ['create sales order', 'new sales order', 'add sales order']
    },
    
    // Search and filter commands
    {
      command: 'search users',
      action: () => {
        setLocation('/users');
        // Focus on search input if available
        setTimeout(() => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
        }, 500);
      },
      description: 'Search users',
      keywords: ['search users', 'find users', 'look for users']
    },
    {
      command: 'filter by date',
      action: () => {
        // Focus on date filter if available
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        if (dateInput) {
          dateInput.focus();
        }
      },
      description: 'Filter by date',
      keywords: ['filter date', 'date filter', 'filter by date']
    },
    
    // System commands
    {
      command: 'logout',
      action: () => {
        // Trigger logout
        const logoutButton = document.querySelector('[href*="logout"], button:contains("Log out")') as HTMLElement;
        if (logoutButton) {
          logoutButton.click();
        } else {
          // Fallback to direct navigation
          setLocation('/logout');
        }
      },
      description: 'Logout from the system',
      keywords: ['logout', 'sign out', 'log out']
    },
    {
      command: 'toggle sidebar',
      action: () => {
        // Toggle mobile sidebar if available
        const menuButton = document.querySelector('button[aria-label*="menu" i], button:contains("Menu")') as HTMLElement;
        if (menuButton) {
          menuButton.click();
        }
      },
      description: 'Toggle sidebar menu',
      keywords: ['toggle sidebar', 'open menu', 'close menu', 'sidebar']
    },
    
    // Accessibility commands
    {
      command: 'increase text size',
      action: () => {
        document.body.style.fontSize = '1.1em';
        speak('Text size increased');
      },
      description: 'Increase text size for better readability',
      keywords: ['increase text', 'bigger text', 'larger text']
    },
    {
      command: 'decrease text size',
      action: () => {
        document.body.style.fontSize = '0.9em';
        speak('Text size decreased');
      },
      description: 'Decrease text size',
      keywords: ['decrease text', 'smaller text', 'reduce text']
    },
    {
      command: 'reset text size',
      action: () => {
        document.body.style.fontSize = '';
        speak('Text size reset to default');
      },
      description: 'Reset text size to default',
      keywords: ['reset text', 'normal text', 'default text']
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

          {/* Wake Word Status */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Wake Word Detection</span>
              </div>
              <Button
                onClick={toggleWakeWord}
                variant={isWakeWordEnabled ? "default" : "outline"}
                size="sm"
                className={isWakeWordEnabled ? "bg-green-500 hover:bg-green-600" : ""}
              >
                {isWakeWordEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              {isWakeWordEnabled 
                ? "Say 'Hey Assistant' to activate voice commands from anywhere"
                : "Enable wake word detection to use voice commands without clicking the button"
              }
            </p>
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-gray-500">
            <p>Click the microphone button and speak your command</p>
            <p>Try saying: "Go to dashboard" or "Show help"</p>
            {!isWakeWordEnabled && (
              <p className="text-blue-600 mt-2">
                💡 Enable wake word detection above for hands-free operation
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceAssistant;
