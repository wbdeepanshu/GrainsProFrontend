import React from 'react';
import { useVoiceAssistant } from './SimpleVoiceAssistantProvider';
import GlobalVoiceButton from './GlobalVoiceButton';

const VoiceAssistantWrapper: React.FC = () => {
  // This component should only be rendered within the VoiceAssistantProvider context
  return <GlobalVoiceButton />;
};

export default VoiceAssistantWrapper;
