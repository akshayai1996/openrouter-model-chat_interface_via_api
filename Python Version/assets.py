# HTML Content for the WebView
# Optimized for Python version

def get_html_content():
    return r"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat Interface</title>
    <!-- Highlight.js Styles -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <!-- Font -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap">
    
    <style>
        /* INJECTED USER CSS START */
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --accent: #6366f1;
            --accent-hover: #4f46e5;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --glass-bg: rgba(30, 41, 59, 0.7);
            --glass-border: 1px solid rgba(255, 255, 255, 0.1);
            --user-msg-bg: #4f46e5;
            --ai-msg-bg: #334155;
            --border-radius: 12px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            scroll-behavior: smooth;
        }
        
        .chat-container::-webkit-scrollbar { width: 8px; }
        .chat-container::-webkit-scrollbar-track { background: transparent; }
        .chat-container::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 4px; }

        .message {
            max-width: 85%;
            padding: 1rem 1.5rem;
            border-radius: 18px;
            line-height: 1.6;
            position: relative;
            font-size: 1rem;
            animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            align-self: flex-end;
            background-color: var(--user-msg-bg);
            color: white;
            border-bottom-right-radius: 2px;
        }

        .message.ai {
            align-self: flex-start;
            background-color: var(--ai-msg-bg);
            color: var(--text-primary);
            border-bottom-left-radius: 2px;
            border: var(--glass-border);
        }

        /* Markdown Styles */
        .message img { max-width: 100%; border-radius: 8px; margin-top: 10px; border: 1px solid rgba(255,255,255,0.1); }
        .message pre {
            background: #0d1117;
            padding: 0; /* Padding handled by code block container if needed */
            border-radius: 8px;
            overflow-x: auto;
            margin: 1rem 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
        }
        .message code { font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9em; }
        .message p { margin-bottom: 0.8rem; }
        .message p:last-child { margin-bottom: 0; }
        
        /* Code Block Header with Copy Button */
        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255, 255, 255, 0.05);
            padding: 0.5rem 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        
        .code-content {
            padding: 1rem;
            overflow-x: auto;
        }

        .copy-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: color 0.2s;
        }
        
        .copy-btn:hover { color: var(--text-primary); }

        /* Typing Indicator */
        .typing-indicator span {
            display: inline-block;
            width: 6px;
            height: 6px;
            background-color: var(--text-secondary);
            border-radius: 50%;
            animation: typing 1.4s infinite ease-in-out both;
            margin: 0 2px;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        
        @keyframes typing {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }
        
        /* INJECTED USER CSS END */
    </style>
    
    <!-- Scripts -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.0/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</head>
<body>
    <div id="chat-container" class="chat-container">
        <div class="message ai">
            <p>Welcome to AI Chat! Select a model and start chatting.</p>
        </div>
    </div>

    <script>
        const chatContainer = document.getElementById('chat-container');
        let currentAiMessageDiv = null;
        let currentAiMessageContent = "";

        // Scroll to bottom helper
        function scrollToBottom() {
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }

        // Copy functionality
        window.copyToClipboard = function(text, btn) {
            navigator.clipboard.writeText(text).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Check!';
                setTimeout(() => btn.innerHTML = originalText, 2000);
            });
        };

        // Custom renderer for code blocks to add copy button
        const renderer = new marked.Renderer();
        renderer.code = function(code, language) {
            const validLang = hljs.getLanguage(language) ? language : 'plaintext';
            const highlighted = hljs.highlight(code, { language: validLang }).value;
            // Escape code for onclick attribute
            const escapedCode = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            return `
            <pre><div class="code-header">
                <span>${validLang}</span>
                <button class="copy-btn" onclick="copyToClipboard(\`${escapedCode}\`, this)">Copy</button>
            </div><div class="code-content"><code class="hljs language-${validLang}">${highlighted}</code></div></pre>
            `;
        };
        marked.use({ renderer });

        // API Functions called from Python
        
        window.appendUserMessage = function(text) {
            const div = document.createElement('div');
            div.className = 'message user';
            // Parse simplistic markdown for user too if needed, or just text
            div.innerHTML = marked.parse(text); 
            chatContainer.appendChild(div);
            scrollToBottom();
        };

        window.startAIMessage = function() {
            const div = document.createElement('div');
            div.className = 'message ai';
            // Initial placeholder
            div.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
            chatContainer.appendChild(div);
            currentAiMessageDiv = div;
            currentAiMessageContent = "";
            scrollToBottom();
        };

        window.appendAIToken = function(token) {
            if (!currentAiMessageDiv) return;
            currentAiMessageContent += token;
            // Re-render the markdown with new content
            currentAiMessageDiv.innerHTML = marked.parse(currentAiMessageContent);
            scrollToBottom();
        };
        
        window.updateFontSize = function(size) {
            document.documentElement.style.fontSize = size + 'px';
        };
    </script>
</body>
</html>
"""
