import React, { createContext, useContext, useState } from 'react';
import SimpleVoiceAssistant from './SimpleVoiceAssistant';
import VoiceAssistantWrapper from './VoiceAssistantWrapper';

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
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);

  const openAssistant = () => {
    setIsOpen(true);
  };

  const closeAssistant = () => {
    setIsOpen(false);
  };

  const toggleWakeWord = () => {
    setIsWakeWordEnabled(!isWakeWordEnabled);
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
      <SimpleVoiceAssistant 
        isOpen={isOpen} 
        onClose={closeAssistant} 
        isWakeWordEnabled={isWakeWordEnabled}
        toggleWakeWord={toggleWakeWord}
      />
      <VoiceAssistantWrapper />
    </VoiceAssistantContext.Provider>
  );
};
