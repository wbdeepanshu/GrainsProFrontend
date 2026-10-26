import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Mic, MicOff, X, AlertCircle, CheckCircle, Info, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthService } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';

const StandaloneVoiceButton: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const locationRef = useRef(location);
  const voiceCommandsRef = useRef<Array<{ keywords: string[]; action: () => void }>>([]);
  locationRef.current = location;

  
  // Custom popup state
  const [popup, setPopup] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    duration?: number;
  }>({ show: false, type: 'info', title: '', message: '' });

  // Fuzzy matching function
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Show custom popup
  const showPopup = (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string, duration = 4000) => {
    setPopup({ show: true, type, title, message, duration });
    
    if (duration > 0) {
      setTimeout(() => {
        setPopup(prev => ({ ...prev, show: false }));
      }, duration);
    }
  };

  // Close popup
  const closePopup = () => {
    setPopup(prev => ({ ...prev, show: false }));
  };

  // Context-aware: use super admin routes when on super admin pages, else regular app routes
  const getNav = (superAdminPath: string, regularPath: string) => () => {
    const isSuperAdmin = (locationRef.current || '').startsWith('/superadmin');
    setLocation(isSuperAdmin ? superAdminPath : regularPath);
  };

  // Comprehensive voice commands — longer phrases first so short keywords do not steal matches.
  const voiceCommands = [
    // Analysis & advanced reports (before generic "users", "branch", "route", "stock")
    { keywords: ['customer analysis', 'customer analytics'], action: () => setLocation('/reports/customer-analysis') },
    { keywords: ['user analysis', 'salesman analysis', 'sales person analysis', 'salesman report'], action: () => setLocation('/reports/salesman-analysis') },
    { keywords: ['item analysis', 'product analysis'], action: () => setLocation('/reports/item-analysis') },
    { keywords: ['voucher analysis'], action: () => setLocation('/reports/voucher-analysis') },
    { keywords: ['outstanding reports', 'outstanding report', 'ledger outstanding'], action: () => setLocation('/reports/outstanding-reports') },
    { keywords: ['brokerage configuration', 'brokerage settings'], action: () => setLocation('/margin-settings/brokerage-configuration') },
    { keywords: ['brokerage report', 'brokerage reports'], action: () => setLocation('/reports/brokerage-reports') },

    { keywords: ['help videos', 'help video', 'training videos', 'video tutorials', 'tutorials'], action: () => setLocation('/help-videos') },
    { keywords: ['live stocks', 'view live stocks', 'live stock'], action: () => setLocation('/live-stocks') },
    { keywords: ['loading batches', 'loading batch'], action: () => setLocation('/outward/loading-batches') },
    { keywords: ['items mapping', 'item mapping', 'items map'], action: () => setLocation('/items-mapping') },
    { keywords: ['route activity', 'route activities'], action: () => setLocation('/route-activity') },
    { keywords: ['onboarding flow', 'onboarding design', 'onboarding'], action: () => setLocation('/superadmin/onboarding-design') },

    // Super Admin (explicit phrases; avoid bare "admin" where it conflicts)
    { keywords: ['organizations', 'organization list'], action: () => setLocation('/superadmin/organizations') },
    { keywords: ['superadmin branches', 'organization branches', 'branches admin'], action: () => setLocation('/superadmin/branches') },
    { keywords: ['admin list', 'admins list'], action: () => setLocation('/superadmin/admin-list') },
    { keywords: ['new registration', 'new register', 'add admin', 'register admin'], action: () => setLocation('/superadmin/add-admin') },
    { keywords: ['analysis reports', 'analysis report'], action: () => setLocation('/superadmin/analysis-reports') },
    { keywords: ['tally config', 'tally configuration'], action: () => setLocation('/superadmin/tally-config') },

    // Main navigation
    { keywords: ['dashboard', 'home', 'main'], action: getNav('/superadmin/dashboard', '/dashboard') },
    { keywords: ['all users', 'all user', 'user list', 'users'], action: getNav('/superadmin/all-users', '/users') },
    { keywords: ['import', 'import data'], action: () => setLocation('/import') },
    { keywords: ['route management', 'routes'], action: () => setLocation('/route-management') },
    { keywords: ['assign route', 'route assignment'], action: () => setLocation('/route-assignment') },
    { keywords: ['create route', 'new route'], action: () => setLocation('/route-management') },
    { keywords: ['margin settings', 'margin'], action: () => setLocation('/margin-settings/item-price-margin') },
    { keywords: ['recent activity', 'activity log'], action: () => setLocation('/recent-activity') },
    { keywords: ['voucher settings', 'voucher types'], action: getNav('/superadmin/voucher-types', '/voucher-settings') },
    { keywords: ['banners', 'banner', 'advertisements', 'ads'], action: () => setLocation('/banners') },
    { keywords: ['privacy policy', 'privacy'], action: () => setLocation('/privacy') },
    { keywords: ['contact us', 'contact'], action: () => setLocation('/contact-us') },

    // Inward / purchase / sales (top-level sidebar items)
    { keywords: ['inward reports', 'inward report', 'inward list'], action: () => setLocation('/reports/inward-list') },
    { keywords: ['purchase orders', 'purchase report', 'purchase reports', 'purchase order report'], action: () => setLocation('/reports/purchaseorders-reports') },
    { keywords: ['sales orders', 'sales order reports', 'sales order report', 'sales order list'], action: () => setLocation('/reports/sales-order-list') },

    // Outward submenu
    { keywords: ['gate pass report', 'gate pass', 'outward list', 'outward report'], action: () => setLocation('/outward/outward-list') },
    { keywords: ['delivery note', 'delivery notes'], action: () => setLocation('/outward/delivery-notes') },
    { keywords: ['invoice', 'invoices'], action: () => setLocation('/outward/invoices') },

    // Reports submenu (app)
    { keywords: ['stock journals', 'stock journal'], action: getNav('/superadmin/stock-journals', '/reports/stock-journal') },
    { keywords: ['machine reports', 'machine report'], action: () => setLocation('/reports/machine-reports') },
    { keywords: ['hamali report', 'hamali reports'], action: () => setLocation('/reports/hamali') },
    { keywords: ['expense reports', 'expense report', 'expense list'], action: () => setLocation('/reports/expense-list') },
    { keywords: ['receipt reports', 'receipt report', 'receipt list'], action: () => setLocation('/receipt-list') },

    // Masters submenu
    { keywords: ['godown masters', 'godown master', 'godown'], action: () => setLocation('/godown-masters') },
    { keywords: ['item masters', 'item master'], action: () => setLocation('/item-masters') },
    { keywords: ['ledger masters', 'ledger master', 'ledger'], action: () => setLocation('/ledger-masters') },
    { keywords: ['testing params', 'testing parameters', 'lab test params'], action: () => setLocation('/lab-test-params') },
    { keywords: ['machine params', 'machine parameters'], action: () => setLocation('/machine-params') },
    { keywords: ['hamali type masters', 'hamali type master', 'hamali types'], action: () => setLocation('/hamali-type-masters') },
    { keywords: ['base price master', 'base price', 'item listing'], action: () => setLocation('/item-listing') },

    // Margin settings submenu
    { keywords: ['item price margin', 'price margin'], action: () => setLocation('/margin-settings/item-price-margin') },
    { keywords: ['price master', 'price masters'], action: () => setLocation('/price-master') },
    { keywords: ['branch settings', 'branch configuration'], action: () => setLocation('/branches') },

    // Short aliases (listed after specific phrases to avoid wrong matches)
    { keywords: ['items'], action: () => setLocation('/item-masters') },
    { keywords: ['voucher'], action: getNav('/superadmin/voucher-types', '/voucher-settings') },
    { keywords: ['route'], action: () => setLocation('/route-management') },
    { keywords: ['activity'], action: () => setLocation('/recent-activity') },
    
    // Add/Create Actions - Quick Access
    { keywords: ['add user', 'new user', 'create user'], action: () => setLocation('/add-user') },
    { keywords: ['add inward', 'new inward', 'create inward'], action: () => setLocation('/add-inward') },
    { keywords: ['add outward', 'new outward', 'create outward', 'add gate pass'], action: () => setLocation('/outward/add-outward') },
    { keywords: ['add purchase order', 'new purchase order', 'create purchase order', 'add purchase'], action: () => setLocation('/add-purchase-order') },
    { keywords: ['add sales order', 'new sales order', 'create sales order', 'add sales'], action: () => setLocation('/create-sales-order') },
    { keywords: ['add expense', 'new expense', 'create expense'], action: () => setLocation('/add-expense') },
    { keywords: ['add receipt', 'new receipt', 'create receipt'], action: () => setLocation('/add-receipt') },
    { keywords: ['add hamali', 'new hamali', 'create hamali'], action: () => setLocation('/add-hamali') },
    
    // System Commands
    { keywords: ['refresh', 'reload', 'update'], action: () => window.location.reload() },
    { keywords: ['back', 'previous', 'return'], action: () => window.history.back() },
    { keywords: ['logout', 'log out', 'sign out', 'exit', 'quit'], action: async () => {
      try {
        const isSuperAdmin = (locationRef.current || '').startsWith('/superadmin');
        showPopup('info', 'Logging Out', 'Please wait...', 2000);

        if (isSuperAdmin) {
          localStorage.removeItem('superadmin_token');
          localStorage.removeItem('superadmin_user');
          queryClient.clear();
          setLocation('/superadmin/login');
        } else {
          await AuthService.logout();
          queryClient.clear();
          queryClient.invalidateQueries();
          queryClient.resetQueries();
          setLocation('/login');
        }
        showPopup('success', 'Logged Out', 'Successfully logged out!', 3000);
      } catch (error) {
        console.error('Logout error:', error);
        showPopup('error', 'Logout Error', 'Error during logout. Please try again.', 5000);
      }
    }},
    
    // Help and Test Commands
    { keywords: ['help', 'commands', 'what can you do'], action: () => {
      showPopup('info', 'Voice Commands Help', 
        'Navigation (matches sidebar):\n\n' +
        '• Help Videos, Privacy, Contact, Banners, Import Data\n' +
        '• Dashboard, Users, Recent Activity, Voucher Settings\n' +
        '• Inward list, Purchase Orders, Sales Orders\n' +
        '• Outward: Gate Pass, Delivery Notes, Invoices, Loading Batches\n' +
        '• Reports: Stock Journals, Machine, Hamali, Brokerage, Customer/User/Item/Voucher Analysis, Outstanding, Expense, Receipt\n' +
        '• Masters: Godown, Item, Ledger, Testing/Machine Params, Hamali Types, Base Price, Live Stocks, Items Mapping\n' +
        '• Route: Management, Assign, Activity\n' +
        '• Margin: Business/Credit Types, Branch Settings, States/Districts/Cities, Price Rules, Stock Item Pricing, Brokerage Configuration\n' +
        '• Superadmin: Organizations, Branches, Admin List, Analysis, Tally Config, Onboarding\n\n' +
        'Quick add: user, inward, outward, purchase order, sales order, expense, receipt, hamali\n\n' +
        'System: Refresh, Back, Logout, Help, Test', 14000);
    }},
    { keywords: ['test', 'testing'], action: () => showPopup('success', 'Voice Assistant Test', 'Voice assistant is working! 🎉', 3000) },
    { keywords: ['hello', 'hi', 'hey'], action: () => showPopup('success', 'Hello!', 'Voice recognition is working! 👋', 3000) },
    { keywords: ['sorry', 'apologize', 'confused', 'what can you do'], action: () => {
      showPopup('info', 'No Need to Apologize!', 
        'I\'m here to help you navigate the system.\n\n' +
        'Try: "dashboard", "help videos", "stock journals", "inward list", "logout"\n\n' +
        'Say "help" for complete list. I\'m always ready to assist! 😊', 6000);
    }},
  ];
  voiceCommandsRef.current = voiceCommands;

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
        recognitionRef.current.maxAlternatives = 1;

        recognitionRef.current.onstart = () => {
          // console.log('Voice recognition started');
          setIsListening(true);
          
          // Set a timeout to stop listening after 5 seconds
          timeoutRef.current = setTimeout(() => {
            if (recognitionRef.current && isListening) {
              // console.log('Auto-stopping voice recognition due to timeout');
              recognitionRef.current.stop();
            }
          }, 5000);
        };

        recognitionRef.current.onresult = (event) => {
          // console.log('Voice recognition result:', event);
          
          // Get the final transcript
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          
          const transcript = finalTranscript.toLowerCase().trim();
          // console.log('Final transcript:', transcript);
          
              if (transcript) {
                const commands = voiceCommandsRef.current;
                // First try exact matching
                let matchedCommand = commands.find(cmd => 
                  cmd.keywords.some(keyword => {
                    const keywordLower = keyword.toLowerCase();
                    return transcript.includes(keywordLower) || 
                           keywordLower.includes(transcript) ||
                           transcript.split(' ').some(word => word.includes(keywordLower));
                  })
                );

                // If no exact match, try fuzzy matching with 90% threshold
                if (!matchedCommand) {
                  let bestMatch = { command: null, similarity: 0, keyword: '' };
                  
                  commands.forEach(cmd => {
                    cmd.keywords.forEach(keyword => {
                      const similarity = calculateSimilarity(transcript, keyword.toLowerCase());
                      if (similarity > bestMatch.similarity && similarity >= 0.9) {
                        bestMatch = { command: cmd, similarity, keyword };
                      }
                    });
                  });
                  
                  if (bestMatch.command) {
                    matchedCommand = bestMatch.command;
                    // console.log(`Fuzzy match found: "${transcript}" matched "${bestMatch.keyword}" with ${(bestMatch.similarity * 100).toFixed(1)}% similarity`);
                  }
                }

                if (matchedCommand) {
                  // console.log('Command matched:', matchedCommand);
//                   showPopup('success', 'Command Recognized', `Executing: ${transcript}`, 2000);
                  // Add a small delay to ensure the command is processed
                  setTimeout(() => {
                    matchedCommand.action();
                  }, 100);
                } else {
                  // console.log('No command matched for:', transcript);
                  // console.log('Available keywords:', voiceCommands.flatMap(cmd => cmd.keywords));
                  
                  // Show apology and help for unrecognized commands
                  if (transcript.length > 0) {
                    showPopup('error', 'Command Not Recognized', 
                      `Sorry, I didn't understand "${transcript}".\n\n` +
                      `I apologize for the confusion. Please try:\n\n` +
                      `• "help" - see all commands\n` +
                      `• "dashboard" - go to dashboard\n` +
                      `• "users" - go to user list\n` +
                      `• "logout" - logout\n` +
                      `• "test" - test voice recognition`, 6000);
                  }
                }
              }
        };

        recognitionRef.current.onerror = (event) => {
          // console.log('Speech recognition error:', event.error);
          setIsListening(false);
          
          // Show user-friendly error messages
          let errorTitle = 'Voice Recognition Error';
          let errorMessage = 'Sorry, there was an error with voice recognition.';
          
          switch (event.error) {
            case 'no-speech':
              errorTitle = 'No Speech Detected';
              errorMessage = 'Sorry, I didn\'t hear anything. Please try speaking again.';
              break;
            case 'audio-capture':
              errorTitle = 'Microphone Access Error';
              errorMessage = 'Sorry, I couldn\'t access your microphone. Please check your microphone permissions.';
              break;
            case 'not-allowed':
              errorTitle = 'Permission Denied';
              errorMessage = 'Sorry, microphone access was denied. Please allow microphone access and try again.';
              break;
            case 'network':
              errorTitle = 'Network Error';
              errorMessage = 'Sorry, there was a network error. Please check your internet connection.';
              break;
            case 'aborted':
              // Don't show error for aborted (user stopped or timeout)
              return;
            default:
              errorMessage = `Sorry, there was an error: ${event.error}. Please try again.`;
          }
          
          showPopup('error', errorTitle, errorMessage, 5000);
        };

        recognitionRef.current.onend = () => {
          // console.log('Voice recognition ended');
          setIsListening(false);
          
          // Clear the timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        };
      } else {
        // console.log('Speech recognition not supported');
        setIsSupported(false);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      // console.log('Speech recognition not available');
      return;
    }
    
    if (isListening) {
      // console.log('Stopping voice recognition');
      recognitionRef.current.stop();
      
      // Clear timeout if manually stopping
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // console.log('Starting voice recognition');
      try {
        recognitionRef.current.start();
      } catch (error) {
        // console.log('Error starting voice recognition:', error);
        setIsListening(false);
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gray-400 flex items-center justify-center shadow-lg z-40">
        <Mic className="h-6 w-6 text-white" />
      </div>
    );
  }

  return (
    <>
      {/* Custom Popup */}
      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className={`relative max-w-md w-full mx-4 p-6 rounded-lg shadow-xl transform transition-all duration-300 ${
            popup.type === 'success' ? 'bg-green-50 border border-green-200' :
            popup.type === 'error' ? 'bg-red-50 border border-red-200' :
            popup.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-black border border-black'
          }`}>
            {/* Close button */}
            <button
              onClick={closePopup}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
            
            {/* Icon */}
            <div className="flex items-center mb-4">
              {popup.type === 'success' && <CheckCircle className="h-6 w-6 text-green-600 mr-3" />}
              {popup.type === 'error' && <AlertCircle className="h-6 w-6 text-red-600 mr-3" />}
              {popup.type === 'warning' && <AlertCircle className="h-6 w-6 text-yellow-600 mr-3" />}
              {popup.type === 'info' && <Info className="h-6 w-6 text-blue-600 mr-3" />}
              <h3 className={`text-lg font-semibold ${
                popup.type === 'success' ? 'text-green-800' :
                popup.type === 'error' ? 'text-red-800' :
                popup.type === 'warning' ? 'text-yellow-800' :
                'text-blue-800'
              }`}>
                {popup.title}
              </h3>
            </div>
            
            {/* Message */}
            <div className={`text-sm whitespace-pre-line ${
              popup.type === 'success' ? 'text-green-700' :
              popup.type === 'error' ? 'text-red-700' :
              popup.type === 'warning' ? 'text-yellow-700' :
              'text-blue-700'
            }`}>
              {popup.message}
            </div>
          </div>
        </div>
      )}

      {/* Voice Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* Status indicator */}
        {isListening && (
          <div className="absolute bottom-16 right-0 bg-red-500 text-white text-xs rounded-lg p-2 shadow-lg">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>Listening...</span>
            </div>
          </div>
        )}

        {/* <Button
          onClick={toggleListening}
          className={`relative w-14 h-14 rounded-full transition-all duration-300 flex items-center justify-center ${
            isListening
              ? "bg-red-600 text-white shadow-md shadow-red-300"
              : "bg-gray-900 text-white hover:bg-gray-700 hover:scale-105"
          }`}
          title="🎤 Click to start voice navigation"
        >
          {isListening ? (
            <Radio className="h-6 w-6 animate-pulse" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button> */}
      </div>
    </>
  );
};

export default StandaloneVoiceButton;
