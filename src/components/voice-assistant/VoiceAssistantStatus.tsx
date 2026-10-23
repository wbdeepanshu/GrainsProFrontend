import React from 'react';
import { useVoiceAssistant } from './SimpleVoiceAssistantProvider';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff } from 'lucide-react';

const VoiceAssistantStatus: React.FC = () => {
  const { isOpen, isListening, isWakeWordEnabled } = useVoiceAssistant();

  return (
    <div className="fixed top-4 right-4 z-50 bg-white p-3 rounded-lg shadow-lg border">
      <div className="flex items-center space-x-2 text-sm">
        <div className="flex items-center space-x-1">
          {isListening ? (
            <Mic className="h-4 w-4 text-red-500 animate-pulse" />
          ) : (
            <MicOff className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-gray-600">Voice Assistant</span>
        </div>
        
        <Badge variant={isOpen ? "default" : "outline"} className="text-xs">
          {isOpen ? "Open" : "Closed"}
        </Badge>
        
        <Badge variant={isWakeWordEnabled ? "default" : "secondary"} className="text-xs">
          Wake: {isWakeWordEnabled ? "On" : "Off"}
        </Badge>
      </div>
    </div>
  );
};

export default VoiceAssistantStatus;
