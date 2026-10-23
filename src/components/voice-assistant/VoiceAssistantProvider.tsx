import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import VoiceAssistant from './VoiceAssistant';
import GlobalVoiceButton from './GlobalVoiceButton';

interface VoiceAssistantContextType {
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  isListening: boolean;
  isWakeWordEnabled: boolean;
  toggleWakeWord: () => void;
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType | undefined>(undefined);

export const useVoiceAssistant = () => {
  const context = useContext(VoiceAssistantContext);
  if (!context) {
    throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
  }
  return context;
};

interface VoiceAssistantProviderProps {
  children: React.ReactNode;
}

export const VoiceAssistantProvider: React.FC<VoiceAssistantProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false); // Disabled by default to prevent error loops
  const [wakeWordRecognition, setWakeWordRecognition] = useState<SpeechRecognition | null>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const restartAttemptsRef = useRef<number>(0);
  const maxRestartAttempts = 3;

  // Safe restart function for wake word recognition
  const safeRestartRecognition = useCallback((recognition: SpeechRecognition, delay: number = 1000) => {
    if (wakeWordTimeoutRef.current) {
      clearTimeout(wakeWordTimeoutRef.current);
    }
    
    wakeWordTimeoutRef.current = setTimeout(() => {
      if (isWakeWordEnabled && !isRecognitionActiveRef.current && restartAttemptsRef.current < maxRestartAttempts) {
        try {
          isRecognitionActiveRef.current = true;
          recognition.start();
          restartAttemptsRef.current = 0; // Reset attempts on successful start
        } catch (e) {
        //  console.log('Failed to restart wake word recognition:', e);
          isRecognitionActiveRef.current = false;
          restartAttemptsRef.current++;
          
          // Exponential backoff for failed attempts
          if (restartAttemptsRef.current < maxRestartAttempts) {
            safeRestartRecognition(recognition, delay * 2);
          } else {
            // console.log('Max restart attempts reached, disabling wake word recognition');
            setIsWakeWordEnabled(false);
          }
        }
      }
    }, delay);
  }, [isWakeWordEnabled]);

  // Check microphone permissions
  const checkMicrophonePermission = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return permission.state === 'granted';
      }
      return true; // Assume granted if permissions API not available
    } catch (e) {
      // console.log('Error checking microphone permission:', e);
      return true; // Assume granted on error
    }
  }, []);

  // Initialize wake word recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && isWakeWordEnabled) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
          setIsListening(true);
          isRecognitionActiveRef.current = true;
          restartAttemptsRef.current = 0;
        };

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('')
            .toLowerCase();

          // Check for wake words
          if (transcript.includes('hey assistant') || 
              transcript.includes('voice assistant') || 
              transcript.includes('open assistant')) {
            openAssistant();
          }
        };

        recognition.onerror = (event) => {
          // console.log('Wake word recognition error:', event.error);
          isRecognitionActiveRef.current = false;
          
          // Handle different error types
          if (event.error === 'not-allowed') {
            // console.log('Microphone permission denied');
            setIsWakeWordEnabled(false);
            return;
          }
          
          if (event.error === 'aborted') {
            // Don't restart immediately for aborted errors
            return;
          }
          
          // Restart recognition after other errors
          if (event.error !== 'aborted' && isWakeWordEnabled) {
            safeRestartRecognition(recognition, 2000);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          isRecognitionActiveRef.current = false;
          
          // Only restart if wake word is still enabled and not manually stopped
          if (isWakeWordEnabled && !isOpen) {
            safeRestartRecognition(recognition, 500);
          }
        };

        setWakeWordRecognition(recognition);
        
        // Check permissions and start wake word recognition
        checkMicrophonePermission().then((hasPermission) => {
          if (hasPermission) {
            try {
              isRecognitionActiveRef.current = true;
              recognition.start();
            } catch (e) {
              // console.log('Failed to start wake word recognition:', e);
              isRecognitionActiveRef.current = false;
              setIsWakeWordEnabled(false);
            }
          } else {
            // console.log('Microphone permission not granted');
            setIsWakeWordEnabled(false);
          }
        });
      }
    }

    return () => {
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
      if (wakeWordRecognition) {
        try {
          wakeWordRecognition.stop();
        } catch (e) {
          // console.log('Error stopping recognition:', e);
        }
      }
    };
  }, [isWakeWordEnabled, safeRestartRecognition, isOpen, checkMicrophonePermission]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
      if (wakeWordRecognition && isRecognitionActiveRef.current) {
        try {
          wakeWordRecognition.stop();
        } catch (e) {
          // console.log('Error stopping recognition on unmount:', e);
        }
      }
    };
  }, [wakeWordRecognition]);

  const openAssistant = () => {
    setIsOpen(true);
    // Stop wake word recognition when assistant is open
    if (wakeWordRecognition && isRecognitionActiveRef.current) {
      try {
        wakeWordRecognition.stop();
        isRecognitionActiveRef.current = false;
      } catch (e) {
        // console.log('Error stopping recognition:', e);
      }
    }
  };

  const closeAssistant = () => {
    setIsOpen(false);
    // Restart wake word recognition when assistant is closed
    if (isWakeWordEnabled && wakeWordRecognition && !isRecognitionActiveRef.current) {
      safeRestartRecognition(wakeWordRecognition, 1000);
    }
  };

  const toggleWakeWord = () => {
    const newState = !isWakeWordEnabled;
    setIsWakeWordEnabled(newState);
    
    if (newState && wakeWordRecognition && !isRecognitionActiveRef.current) {
      // Enable wake word
      safeRestartRecognition(wakeWordRecognition, 1000);
    } else if (!newState && wakeWordRecognition && isRecognitionActiveRef.current) {
      // Disable wake word
      try {
        wakeWordRecognition.stop();
        isRecognitionActiveRef.current = false;
        if (wakeWordTimeoutRef.current) {
          clearTimeout(wakeWordTimeoutRef.current);
        }
      } catch (e) {
        // console.log('Error stopping recognition:', e);
      }
    }
  };

  const contextValue: VoiceAssistantContextType = {
    isOpen,
    openAssistant,
    closeAssistant,
    isListening,
    isWakeWordEnabled,
    toggleWakeWord,
  };

  return (
    <VoiceAssistantContext.Provider value={contextValue}>
      {children}
      <VoiceAssistant isOpen={isOpen} onClose={closeAssistant} />
      <GlobalVoiceButton />
    </VoiceAssistantContext.Provider>
  );
};
