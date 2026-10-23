# Voice Assistant for GrainPro ERP

A comprehensive voice command-based AI assistant integrated into the React.js Portal Dashboard that helps users navigate between pages and perform key actions using natural speech.

## Features

### 🎤 Voice Recognition
- **Wake Word Support**: Say "Hey Assistant", "Voice Assistant", or "Open Assistant" to activate
- **Continuous Listening**: Always-on voice recognition for hands-free operation
- **Natural Language Processing**: Understands natural speech patterns and variations
- **Multi-language Support**: Currently supports English (en-US)

### 🧭 Navigation Commands
- **Dashboard Navigation**: "Go to dashboard", "Go to users", "Go to reports"
- **Master Data**: "Go to masters", "Show godown masters", "Show item masters"
- **Reports**: "Show inward reports", "Show stock journals", "Show machine reports"
- **Settings**: "Go to margin settings", "Go to voucher settings"

### ⚡ Quick Actions
- **Add New Entries**: "Add new user", "Add inward entry", "Add purchase order"
- **Create Records**: "Create sales order", "Add expense", "Add receipt"
- **Search & Filter**: "Search users", "Filter by date"

### 🔧 System Commands
- **Page Control**: "Refresh page", "Go back", "Toggle sidebar"
- **Accessibility**: "Increase text size", "Decrease text size", "Reset text size"
- **Help**: "Show help", "Hide help", "Stop listening"

## Usage

### Activation Methods
1. **Click the floating microphone button** (bottom-right corner)
2. **Say wake words**: "Hey Assistant", "Voice Assistant", or "Open Assistant"
3. **Use the header button** on the dashboard page

### Voice Commands

#### Navigation Commands
```
"Go to dashboard"          → Navigate to Dashboard
"Go to users"              → Navigate to User List
"Go to reports"            → Navigate to Reports
"Go to masters"            → Navigate to Masters
"Go to import data"        → Navigate to Import Data
"Go to route management"   → Navigate to Route Management
"Go to margin settings"    → Navigate to Margin Settings
"Go to recent activity"    → Navigate to Recent Activity
"Go to voucher settings"   → Navigate to Voucher Settings
"Go to privacy policy"     → Navigate to Privacy Policy
```

#### Report Navigation
```
"Show inward reports"      → Inward Reports
"Show stock journals"      → Stock Journals
"Show machine reports"     → Machine Reports
"Show hamali reports"      → Hamali Reports
"Show purchase reports"    → Purchase Reports
"Show expense reports"     → Expense Reports
"Show sales order reports" → Sales Order Reports
"Show receipt reports"     → Receipt Reports
```

#### Master Data Navigation
```
"Show godown masters"      → Godown Masters
"Show item masters"        → Item Masters
"Show ledger masters"      → Ledger Masters
"Show testing params"      → Testing Parameters
"Show machine params"      → Machine Parameters
"Show hamali type masters" → Hamali Type Masters
"Show base price master"   → Base Price Master
```

#### Margin Settings Navigation
```
"Show business types"      → Business Types
"Show credit types"        → Credit Types
"Show states"              → States
"Show districts"           → Districts
"Show cities"              → Cities
"Show price rules"         → Price Rules
"Show stock item pricing"  → Stock Item Pricing
```

#### Route Management
```
"Create route"             → Create Route
"Assign route"             → Assign Route
```

#### Quick Actions
```
"Add new user"             → Add User
"Add inward entry"         → Add Inward Entry
"Add purchase order"       → Add Purchase Order
"Add expense"              → Add Expense
"Add receipt"              → Add Receipt
"Add hamali"               → Add Hamali
"Create sales order"       → Create Sales Order
```

#### Search & Filter
```
"Search users"             → Search Users
"Filter by date"           → Filter by Date
```

#### System Commands
```
"Refresh page"             → Refresh Current Page
"Go back"                  → Go to Previous Page
"Toggle sidebar"           → Toggle Sidebar Menu
"Logout"                   → Logout from System
```

#### Accessibility
```
"Increase text size"       → Increase Text Size
"Decrease text size"       → Decrease Text Size
"Reset text size"          → Reset Text Size
```

#### Help Commands
```
"Show help"                → Show Available Commands
"Hide help"                → Hide Commands Help
"Stop listening"           → Stop Voice Recognition
```

## Technical Implementation

### Components Structure
```
src/components/voice-assistant/
├── VoiceAssistant.tsx           # Main voice assistant modal
├── VoiceAssistantButton.tsx     # Header button component
├── GlobalVoiceButton.tsx        # Floating global button
├── VoiceAssistantProvider.tsx   # Context provider with wake word
├── index.ts                     # Export file
└── README.md                    # Documentation
```

### Key Features
- **Speech Recognition API**: Uses Web Speech API for voice input
- **Text-to-Speech**: Provides audio feedback for commands
- **Context Management**: React Context for global state
- **Wake Word Detection**: Continuous listening for activation phrases
- **Command Processing**: Natural language understanding and matching
- **Responsive Design**: Works on desktop and mobile devices

### Browser Compatibility
- **Chrome**: Full support
- **Edge**: Full support
- **Safari**: Limited support (may require user interaction)
- **Firefox**: Limited support

### Security Considerations
- Voice data is processed locally in the browser
- No voice data is sent to external servers
- Commands are executed within the application context
- User permissions are respected for microphone access

## Installation & Setup

The voice assistant is automatically integrated into the application through the `VoiceAssistantProvider` in the main App component.

### Environment Requirements
- Modern browser with Web Speech API support
- Microphone permissions granted
- HTTPS connection (required for microphone access in production)

### Configuration
The voice assistant can be configured through the provider context:
- Enable/disable wake word detection
- Adjust speech recognition language
- Customize command responses

## Troubleshooting

### Common Issues
1. **Microphone not working**: Check browser permissions
2. **Commands not recognized**: Ensure clear speech and quiet environment
3. **Wake word not working**: Check if wake word detection is enabled
4. **Navigation not working**: Verify user has proper permissions

### Browser Permissions
Ensure the following permissions are granted:
- Microphone access
- Audio output (for text-to-speech)

## Future Enhancements

### Planned Features
- **Multi-language Support**: Add support for Hindi and other regional languages
- **Custom Commands**: Allow users to create custom voice commands
- **Voice Training**: Improve recognition accuracy with user-specific training
- **Offline Support**: Work without internet connection
- **Advanced Actions**: Support for complex multi-step operations
- **Voice Shortcuts**: Quick access to frequently used functions

### Integration Opportunities
- **Mobile App**: Extend to React Native mobile application
- **Smart Devices**: Integration with smart speakers and devices
- **API Integration**: Connect with external voice services for enhanced capabilities

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.

---

**Note**: This voice assistant is designed to enhance user experience and accessibility. It should be used as a complement to traditional UI interactions, not as a replacement.
