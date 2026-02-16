# AI Chat Interface (OpenRouter API)

This repository contains two versions of an AI Chat Interface that connects to the OpenRouter API.

## Project Structure

1.  **Web Version**: A Node.js web application.
2.  **Local EXE Version**: A compiled C# (.NET 8 WPF) desktop application.

---

## 🔑 API Key Setup (CRITICAL)

**The API Key is NOT included in this repository for security reasons.**

1.  Go to [OpenRouter.ai](https://openrouter.ai/) and sign up/log in.
2.  Navigate to **Keys** and generate a new API Key.
3.  **For Web Version**:
    - Create a file named `APIKEY.txt` inside the `Web Version` folder.
    - Paste your API key into this file.
4.  **For Local EXE Version**:
    - Create a file named `APIKEY.txt` inside the `Local EXE Version/AIChatApp` (or wherever you run the executable from).
    - Paste your API key into this file.

> **Note**: Do not share your `APIKEY.txt` file or commit it to version control.

---

## 🌐 Web Version

A simple web interface powered by Node.js.

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Run
1.  **Download the entire** `Web Version` folder (not just `public`).
2.  Navigate to the `Web Version` folder:
    ```bash
    cd "Web Version"
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    npm start
    ```
    *Or manually run `node server.js`*
4.  Open your browser and visit `http://localhost:3000`.

---

## 🖥️ Local EXE Version (Desktop)

A native Windows desktop application built with C# and WPF.

### Prerequisites
- [.NET 8 Desktop Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) (if running the build).
- [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) (if you want to build/modify the source).

### How to Run
    - Open `Local EXE Version/AIChatApp` in your terminal or Visual Studio.
    - Run the command:
      ```bash
      dotnet run
      ```
2.  **Using Pre-built Executable**:
    - **Download the entire** `Local EXE Version/ReadyToRun` folder. (The `.exe` needs the other files in there to work).
    - Navigate to that folder.
    - Double-click `AIChatApp.exe`.
    *Note: Create a file named `APIKEY.txt` in this folder and paste your key inside.*

---

## Features
- **Model Selection**: Choose from free and paid OpenRouter models.
- **Real-time Streaming**: Chat responses stream in real-time.
- **Markdown Support**: Code blocks and formatting are rendered beautifully.
- **Chat History**: Maintains conversation context.

## License
MIT
