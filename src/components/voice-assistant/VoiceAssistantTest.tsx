import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVoiceAssistant } from './VoiceAssistantProvider';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';

const VoiceAssistantTest: React.FC = () => {
  const { 
    isOpen, 
    openAssistant, 
    closeAssistant, 
    isListening, 
    isWakeWordEnabled, 
    toggleWakeWord 
  } = useVoiceAssistant();

  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testCommands = [
    { command: 'Go to dashboard', description: 'Navigate to Dashboard' },
    { command: 'Show help', description: 'Show available commands' },
    { command: 'Refresh page', description: 'Refresh current page' },
    { command: 'Go back', description: 'Go to previous page' },
    { command: 'Show users', description: 'Navigate to User List' },
    { command: 'Show reports', description: 'Navigate to Reports' },
  ];

  const runTest = (command: string) => {
    addTestResult(`Testing command: "${command}"`);
    // Simulate command execution
    setTimeout(() => {
      addTestResult(`Command "${command}" executed successfully`);
    }, 1000);
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mic className="h-5 w-5" />
            <span>Voice Assistant Test Panel</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Indicators */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm">Assistant: {isOpen ? 'Open' : 'Closed'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm">Listening: {isListening ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isWakeWordEnabled ? 'bg-blue-500' : 'bg-gray-400'}`} />
              <span className="text-sm">Wake Word: {isWakeWordEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center space-x-2">
            <Button onClick={openAssistant} disabled={isOpen}>
              <Mic className="h-4 w-4 mr-2" />
              Open Assistant
            </Button>
            <Button onClick={closeAssistant} disabled={!isOpen} variant="outline">
              <MicOff className="h-4 w-4 mr-2" />
              Close Assistant
            </Button>
            <Button onClick={toggleWakeWord} variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Toggle Wake Word
            </Button>
          </div>

          {/* Test Commands */}
          <div>
            <h4 className="text-sm font-medium mb-2">Test Commands:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testCommands.map((test, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => runTest(test.command)}
                  className="justify-start"
                >
                  <span className="text-left">
                    <div className="font-medium">"{test.command}"</div>
                    <div className="text-xs text-gray-500">{test.description}</div>
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Test Results:</h4>
              <div className="bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className="text-xs text-gray-600 mb-1">
                    {result}
                  </div>
                ))}
              </div>
              <Button 
                onClick={() => setTestResults([])} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Clear Results
              </Button>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">How to Test:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Click "Open Assistant" to open the voice assistant modal</li>
              <li>• Click the microphone button to start listening</li>
              <li>• Say one of the test commands clearly</li>
              <li>• Check if the command is recognized and executed</li>
              <li>• Use "Show help" to see all available commands</li>
            </ul>
          </div>

          {/* Browser Compatibility */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Browser Compatibility:</h4>
            <div className="flex items-center space-x-2 text-sm text-yellow-700">
              <Badge variant="outline" className="bg-green-100 text-green-800">Chrome: Supported</Badge>
              <Badge variant="outline" className="bg-green-100 text-green-800">Edge: Supported</Badge>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Safari: Limited</Badge>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Firefox: Limited</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceAssistantTest;
