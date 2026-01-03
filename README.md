# 🎙️ JARVIS - AI-Powered Voice Assistant

> Just A Rather Very Intelligent System

An intelligent voice assistant that combines AI-powered conversations with voice-controlled system commands. Built with modern web technologies, JARVIS brings Iron Man's assistant to life in your browser.

![JARVIS Interface](https://img.shields.io/badge/Status-Active-success) ![React](https://img.shields.io/badge/React-19.2.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)

## ✨ Features

- 🎙️ **Voice Recognition** - Real-time speech-to-text using Web Speech API
- 🤖 **AI Conversations** - Powered by DeepSeek AI via OpenRouter
- 💻 **System Integration** - Voice-controlled app launching (100+ apps supported)
- 🎯 **Voice Agent Mode** - Hands-free continuous conversation experience
- 🎨 **Modern UI** - Iron Man-inspired arc reactor design with glassmorphism effects
- 🔊 **Text-to-Speech** - Multiple voice options with auto-speak functionality

## 🛠️ Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Voice:** Web Speech API (Speech Recognition & Synthesis)
- **AI:** OpenRouter API with DeepSeek models
- **Backend:** Node.js for system command execution
- **Styling:** Custom CSS with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Chrome or Edge browser (for Web Speech API support)
- OpenRouter API key (get one at [openrouter.ai](https://openrouter.ai))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/jarvis.git
   cd jarvis
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API key**
   - Open `src/services/openRouterService.ts`
   - Replace `OPENROUTER_API_KEY` with your API key

4. **Start the backend server** (Terminal 1)
   ```bash
   node server/index.js
   ```

5. **Start the frontend** (Terminal 2)
   ```bash
   npm run dev
   ```

6. **Open in browser**
   - Navigate to `http://localhost:5173`
   - Allow microphone permissions when prompted

## 📖 Usage

### Voice Commands
- **Open Applications:** "Open calculator", "Open Chrome", "Open VS Code"
- **Open Websites:** "Open YouTube", "Open GitHub"
- **AI Conversations:** Ask any question naturally

### Voice Agent Mode
1. Click the Voice Agent button (bottom right)
2. Speak your question or command
3. JARVIS will listen, process, and respond automatically
4. Say "stop" or "goodbye" to exit

### Manual Input
- Type your message in the input field
- Click send or press Enter
- Use the microphone button for voice input

## 🎯 Supported Applications

JARVIS can open 100+ applications including:
- **Browsers:** Chrome, Edge, Firefox
- **System Tools:** Calculator, Notepad, Paint, File Explorer
- **Development:** VS Code, Terminal, PowerShell
- **Office:** Word, Excel, PowerPoint
- **Media:** Spotify, VLC, Photos
- **Communication:** Discord, Slack, Teams
- **And many more...**

See `server/index.js` for the complete list.

## 📸 Screenshots

> Add screenshots of your interface here

## 🔧 Configuration

### Changing AI Model
Edit `src/services/openRouterService.ts`:
```typescript
const PRIMARY_MODEL = 'deepseek/deepseek-r1-0528:free';
```

### Adding Custom Applications
Edit `server/index.js` and add to `APP_COMMANDS`:
```javascript
'myapp': 'start myapp',
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Inspired by Iron Man's JARVIS
- Built with React, TypeScript, and modern web APIs
- AI powered by DeepSeek via OpenRouter

## 📧 Contact

Your Name - [@SHALINCODER](https://github.com/SHALINCODER)

Project Link: [https://github.com/SHALINCODER/jarvis](https://github.com/SHALINCODER/jarvis)

---

⭐ Star this repo if you find it interesting!
