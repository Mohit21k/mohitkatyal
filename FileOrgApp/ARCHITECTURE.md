# 🏗️ AI File Organizer Architecture

Below is the complete system architecture mapping out how the components interact in your macOS environment.

```mermaid
flowchart TD
    %% Define User Inputs
    subgraph macOS Environment
        DownloadsFolder[📂 ~/Downloads]
        MenuBarUI([🤖 Menu Bar App])
    end

    %% Watcher and Triggers
    subgraph Triggers
        Watchdog(Watchdog Daemon) -->|Monitors| DownloadsFolder
        MenuBarUI -->|Triggers| ManualSweep(Batch Process)
        MenuBarUI -->|Triggers| UndoAction(Undo Function)
    end

    %% Core Application Engine
    subgraph Main Processing Engine
        FileMover{File Mover & Orchestrator}
        
        Watchdog -- New File Event --> FileMover
        ManualSweep -- Bulk Scan --> FileMover
        
        subgraph Text Extraction
            FileMover -->|Extract| DetectType{File Type?}
            DetectType -- PDF --> PyPDF[PyPDF Extractor]
            DetectType -- Image --> Tesseract[Tesseract OCR]
            DetectType -- TXT/CSV --> RawText[Raw Text Extractor]
        end
    end
    
    %% AI Integration
    subgraph AI Intelligence
        Ollama((🧠 Ollama Llama 3))
        PyPDF -->|Context| Ollama
        Tesseract -->|OCR String| Ollama
        RawText -->|Context| Ollama
    end
    Ollama -->|JSON Category| FileMover

    %% Destination Actions
    subgraph Output Destinations
        Shutil[Shutil Mover]
        SQLite[(SQLite Audit DB)]
        Notifications[[macOS Push Notification]]
    end

    FileMover -->|Action| Shutil
    FileMover -->|Log Move| SQLite
    Shutil -->|Sends to category| TargetFolder[📂 ~/Documents/Category]
    Shutil --> Notifications
    
    %% Undo Flow
    UndoAction --> SQLite
    SQLite -.->|Fetch last location| Shutil
    Shutil -.->|Restore| DownloadsFolder
```

## How It Flows
1. Everything begins either with the **Watchdog Daemon** actively catching a new file or the user manually triggering a **Sweep** via the **Menu Bar UI**.
2. The orchestrator isolates the file and hands it off to your local extraction engines (`Tesseract`, `PyPDF`) to scrape text context safely.
3. The raw string context is packaged with the original filename and dispatched to the local **Ollama AI**.
4. Ollama replies with a structured JSON identifying the `Category` while automatically wiping the prompt from its Active Memory to preserve efficiency.
5. The orchestrated script fires a success **macOS Push Notification**, logs the absolute origin paths into the **SQLite History Database**, and physically transports the file using python's `shutil` library!
