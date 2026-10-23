import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceAssistant } from './SimpleVoiceAssistantProvider';

const GlobalVoiceButton: React.FC = () => {
  const { openAssistant, isListening, isWakeWordEnabled } = useVoiceAssistant();
  const [showTooltip, setShowTooltip] = useState(false);
  
  useEffect(() => {
    // Show tooltip for first-time users
    const hasSeenTooltip = localStorage.getItem('voice-assistant-tooltip-seen');
    if (!hasSeenTooltip) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 5000);
      localStorage.setItem('voice-assistant-tooltip-seen', 'true');
    }
  }, []);
  
  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-16 right-0 bg-gray-900 text-white text-xs rounded-lg p-3 max-w-xs shadow-lg">
          <div className="font-medium mb-1">🎤 Voice Assistant Available!</div>
          <div className="text-gray-300">
            Click the microphone or say "Hey Assistant" to navigate with voice commands.
          </div>
          <div className="absolute bottom-0 right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
      
      <Button
        onClick={openAssistant}
        className={`w-14 h-14 rounded-full shadow-lg transition-all duration-200 ${
          isListening 
            ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
            : "bg-blue-500 hover:bg-blue-600 text-white hover:scale-105"
        }`}
        title={`Voice Assistant - Click to open${isWakeWordEnabled ? " or say 'Hey Assistant'" : ""}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>
    </div>
  );
};

export default GlobalVoiceButton;
