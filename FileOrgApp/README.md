# 🤖 AI File Organizer Desktop App for macOS

An intelligent, lightweight macOS Desktop Agent that continuously monitors your `Downloads` and `Documents` folders, automatically categorizing and moving files into structured directories using privacy-first local AI models (Ollama).

## ⚡ Core Features

- **100% Local & Private**: Relies entirely on your machine. Documents never leave your Mac.
- **Top Menu Bar UI**: A slick macOS Menu Bar integration (`🤖`) containing drop-down tools to execute manual sweeps or instantly undo actions without the terminal.
- **Image OCR (Vision capability)**: Effortlessly drag and drop images or screenshots of receipts. The engine uses Tesseract-OCR to scan the image's text under the hood before categorizing it with AI.
- **Extreme Memory Profiling**: Aggressively forces Python garbage collection (`gc.collect`) when idle and halts VRAM saturation by overriding Ollama to instantly unload the AI model using `"keep_alive": 0` the microsecond it finishes. 
- **1-Click Undo Security**: Accidental organization? Click 'Undo Last Action' in the top Menu bar. A dedicated SQLite tracking DB allows the agent to physically restore the exact file dynamically.
- **Apple Push Notifications**: Native desktop alert banners fire immediately whenever a file is routed correctly or reversed.

---

## 🛠️ Prerequisites

1. **Python 3.9+**
2. **Ollama**: (https://ollama.com) configured and running.
   ```bash
   brew install ollama
   brew services start ollama
   ollama pull llama3
   ```

---

## 🚀 Installation & Setup

1. **Navigate to the directory:**
   ```bash
   cd ~/FileOrgApp
   ```

2. **Run the Automatic Installer:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
   *What this does:*
   - Creates an isolated Virtual Environment (`venv`).
   - Automatically utilizes `brew` to install Tesseract-OCR if missing.
   - Installs all PyPI dependencies (`watchdog`, `pypdf`, `requests`, `pytesseract`, `rumps`).

3. **Modify Configuration (Optional):**
   Open `config/config.yaml` to change:
   - Folders being monitored.
   - Classification Categories mappings.

---

## 💻 Usage & Commands

**Launching the Application (IMPORTANT):**
Because Apple restricts invisible background tasks from drawing UI elements on your screen, you must run the desktop interface starter script rather than relying purely on silent launch-agents:
```bash
./start_ui.sh
```
*(This places the `🤖` neatly at the top right of your macOS screen).*

**Live Monitoring:**
Test it by simply dropping a PDF, a `.txt` receipt, or an image `.png` into `~/Downloads`. You will see a push notification slide in confirming the action.

**Force Sweep Existing Clutter:**
If you want to one-time batch sweep hundreds of scattered files already sitting in your directory, click the Menu bar `🤖` icon and press **"Manual Sweep"**, or run:
```bash
./venv/bin/python3 main.py --run-existing
```

**View the Agent Logs:**
To see exactly what the AI is thinking:
```bash
tail -f ~/FileOrgApp/logs/stdout.log
```
