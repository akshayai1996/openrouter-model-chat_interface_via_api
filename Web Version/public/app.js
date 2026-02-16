document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Sidebar Elements
    const sessionListEl = document.getElementById('session-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const tempChatBtn = document.getElementById('temp-chat-btn');

    // State
    let sessions = [];
    let currentSessionId = null;
    let isTemporarySession = false;
    let abortController = null;
    const MAX_CONTEXT_MESSAGES = 10; // Limit to last 10 messages for context

    // --- Persistence: Model Selection ---
    const savedModel = localStorage.getItem('selected_model');
    if (savedModel) {
        modelSelect.value = savedModel;
    }

    modelSelect.addEventListener('change', () => {
        localStorage.setItem('selected_model', modelSelect.value);
    });

    // --- Session Management ---

    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    const loadSessions = () => {
        const stored = localStorage.getItem('chat_sessions');
        if (stored) {
            try {
                sessions = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse sessions", e);
                sessions = [];
            }
        } else {
            sessions = [];
        }
        renderSessionList();
    };

    const saveSessions = () => {
        if (isTemporarySession) return; // Don't save temp sessions
        localStorage.setItem('chat_sessions', JSON.stringify(sessions));
        renderSessionList();
    };

    const startTemporarySession = () => {
        isTemporarySession = true;
        currentSessionId = 'temp';

        // UI Updates
        chatContainer.innerHTML = '';
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `<h2>🔥 Temporary Chat</h2><p>Messages here will <b>not</b> be saved.</p>`;
        chatContainer.appendChild(welcome);

        // Highlight temp button
        tempChatBtn.classList.add('active');
        // Unhighlight session items
        document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    };

    const createNewSession = () => {
        isTemporarySession = false;
        tempChatBtn.classList.remove('active');

        const newSession = {
            id: generateId(),
            title: `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            messages: [],
            timestamp: Date.now()
        };
        sessions.unshift(newSession); // Add to top
        currentSessionId = newSession.id;
        saveSessions();
        loadSession(currentSessionId);
    };

    const deleteSession = (e, id) => {
        e.stopPropagation();
        if (confirm('Delete this chat?')) {
            sessions = sessions.filter(s => s.id !== id);
            saveSessions(); // Renders list

            // If we deleted the current session
            if (currentSessionId === id) {
                if (sessions.length > 0) {
                    loadSession(sessions[0].id);
                } else {
                    createNewSession();
                }
            }
        }
    };

    const renderSessionList = () => {
        sessionListEl.innerHTML = '';
        sessions.forEach(session => {
            const div = document.createElement('div');
            div.classList.add('session-item');
            if (!isTemporarySession && session.id === currentSessionId) div.classList.add('active');

            // Title text container
            const titleSpan = document.createElement('span');
            titleSpan.className = 'session-title';
            titleSpan.textContent = session.title || 'New Chat';
            div.appendChild(titleSpan);

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-session-btn';
            deleteBtn.innerHTML = '&times;'; // close icon
            deleteBtn.title = 'Delete Chat';
            deleteBtn.addEventListener('click', (e) => deleteSession(e, session.id));
            div.appendChild(deleteBtn);

            // Click to load
            div.addEventListener('click', () => {
                isTemporarySession = false;
                tempChatBtn.classList.remove('active');
                loadSession(session.id);
            });

            sessionListEl.appendChild(div);
        });
    };

    const loadSession = (id) => {
        currentSessionId = id;
        const session = sessions.find(s => s.id === id);

        // Clear UI
        chatContainer.innerHTML = '';

        if (!session) return; // Should not happen

        if (session.messages.length === 0) {
            const welcome = document.createElement('div');
            welcome.className = 'welcome-message';
            welcome.innerHTML = `<h2>Welcome to AI Chat</h2><p>Select a model and start chatting below.</p>`;
            chatContainer.appendChild(welcome);
        } else {
            // Render messages
            session.messages.forEach(msg => {
                let content = msg.content;

                // Handle array content (multimodal) - just show text part (legacy support)
                if (Array.isArray(content)) {
                    const textPart = content.find(c => c.type === 'text');
                    content = textPart ? textPart.text : '[Image content hidden]';
                }

                addMessageToUI(content, msg.role, false);
            });
            scrollToBottom();
        }

        renderSessionList(); // To update active class
    };

    // --- Message Logic ---

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimateTokens = (text) => {
        return Math.ceil(text.length / 4);
    };

    // Update Session Title based on first user message
    const updateSessionTitle = (text) => {
        if (isTemporarySession) return;
        const session = sessions.find(s => s.id === currentSessionId);
        if (session && session.messages.length <= 1) { // First exchange
            let title = text.substring(0, 25);
            if (text.length > 25) title += '...';
            session.title = title;
            saveSessions();
        }
    };

    const scrollToBottom = () => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const copyToClipboard = async (text, btn) => {
        try {
            await navigator.clipboard.writeText(text);
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = originalText, 2000);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    };

    const createMessageElement = (content, role) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);

        // User Text
        if (role === 'user') {
            messageDiv.textContent = content;
        }
        // AI Response
        else {
            if (!content) content = "..."; // Placeholder if empty

            const contentDiv = document.createElement('div');
            contentDiv.classList.add('markdown-content');

            // Configure marked with GFM and line breaks
            marked.setOptions({
                gfm: true,
                breaks: true,
                headerIds: false
            });
            const rawHtml = marked.parse(content);
            const cleanHtml = DOMPurify.sanitize(rawHtml);
            contentDiv.innerHTML = cleanHtml;

            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

            messageDiv.appendChild(contentDiv);

            // Actions Toolbar
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';

            const stopBtn = document.createElement('button');
            stopBtn.className = 'action-btn stop-btn';
            stopBtn.textContent = '⏹ Stop';
            stopBtn.title = 'Stop generation';
            stopBtn.addEventListener('click', () => {
                if (abortController) {
                    abortController.abort();
                    stopBtn.textContent = 'Stopped';
                    stopBtn.disabled = true;
                }
            });
            actionsDiv.appendChild(stopBtn);

            const copyMdBtn = document.createElement('button');
            copyMdBtn.className = 'action-btn';
            copyMdBtn.textContent = 'Copy Markdown';
            copyMdBtn.addEventListener('click', () => copyToClipboard(content, copyMdBtn));

            const copyTextBtn = document.createElement('button');
            copyTextBtn.className = 'action-btn';
            copyTextBtn.textContent = 'Copy Answer';
            copyTextBtn.addEventListener('click', () => copyToClipboard(contentDiv.innerText, copyTextBtn));

            actionsDiv.appendChild(copyMdBtn);
            actionsDiv.appendChild(copyTextBtn);
            messageDiv.appendChild(actionsDiv);
        }

        return messageDiv;
    };

    const addMessageToUI = (content, role, save = true) => {
        const msgEl = createMessageElement(content, role);
        chatContainer.appendChild(msgEl);
        scrollToBottom();

        // Save logic
        if (save) {
            const msgObj = { role: role, content: content };

            if (!isTemporarySession) {
                const session = sessions.find(s => s.id === currentSessionId);
                if (session) {
                    session.messages.push(msgObj);
                    if (role === 'user') updateSessionTitle(content);
                    saveSessions();
                }
            } else {
                // If temporary, we still need to track messages in memory for context
                if (!window.tempMessages) window.tempMessages = [];
                window.tempMessages.push(msgObj);
            }
        }
    };

    // Send Logic - Streaming
    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        // Add User Message
        addMessageToUI(text, 'user');

        // Prepare Context (Token Limit Logic)
        let contextMessages = [];
        if (!isTemporarySession) {
            const session = sessions.find(s => s.id === currentSessionId);
            // Get all messages including the one we just added
            const allMessages = session.messages;
            // Slice the last N messages
            contextMessages = allMessages.slice(-MAX_CONTEXT_MESSAGES);
        } else {
            // Use temp memory
            if (!window.tempMessages) window.tempMessages = [];
            contextMessages = window.tempMessages.slice(-MAX_CONTEXT_MESSAGES);
        }

        // Clear UI
        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.disabled = true;
        loadingIndicator.classList.remove('hidden');

        const welcome = document.querySelector('.welcome-message');
        if (welcome && !welcome.innerHTML.includes('Temporary')) welcome.remove();

        // Create placeholder for streaming AI response
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'ai');

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('markdown-content');
        contentDiv.innerHTML = '<span class="typing-indicator">▊</span>'; // Typing cursor
        messageDiv.appendChild(contentDiv);

        // Add actions toolbar (hidden initially)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.style.opacity = '0';

        const stopBtn = document.createElement('button');
        stopBtn.className = 'action-btn stop-btn';
        stopBtn.textContent = '⏹ Stop';
        stopBtn.title = 'Stop generation';

        const copyMdBtn = document.createElement('button');
        copyMdBtn.className = 'action-btn';
        copyMdBtn.textContent = 'Copy Markdown';

        const copyTextBtn = document.createElement('button');
        copyTextBtn.className = 'action-btn';
        copyTextBtn.textContent = 'Copy Answer';

        actionsDiv.appendChild(stopBtn);
        actionsDiv.appendChild(copyMdBtn);
        actionsDiv.appendChild(copyTextBtn);
        messageDiv.appendChild(actionsDiv);

        chatContainer.appendChild(messageDiv);
        scrollToBottom();

        let fullResponse = '';
        let isFirstChunk = true;

        // Create abort controller for stopping generation
        abortController = new AbortController();

        try {
            const model = modelSelect.value;

            // Note: Even if the model is a "vision" model, we are only sending text now.
            // This is compatible with OpenRouter APIs.

            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: contextMessages
                }),
                signal: abortController.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            // Handle the data as raw text (OpenAI format already)
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';

                            if (content) {
                                fullResponse += content;

                                // Update UI in real-time
                                if (isFirstChunk) {
                                    contentDiv.innerHTML = '';
                                    isFirstChunk = false;
                                }

                                // Parse markdown and render
                                marked.setOptions({
                                    gfm: true,
                                    breaks: true,
                                    headerIds: false
                                });
                                const rawHtml = marked.parse(fullResponse);
                                const cleanHtml = DOMPurify.sanitize(rawHtml);
                                contentDiv.innerHTML = cleanHtml;

                                // Highlight code blocks
                                contentDiv.querySelectorAll('pre code').forEach((block) => {
                                    hljs.highlightElement(block);
                                });

                                scrollToBottom();
                            }
                        } catch (e) {
                            // Log parsing errors in dev mode
                            console.debug('Parse error (may be normal):', e.message);
                        }
                    }
                }
            }

            // Show action buttons after completion
            actionsDiv.style.opacity = '1';

            // Stop button functionality
            stopBtn.addEventListener('click', () => {
                if (abortController) {
                    abortController.abort();
                    stopBtn.textContent = 'Stopped';
                    stopBtn.disabled = true;
                }
            });

            // Add copy functionality
            copyMdBtn.addEventListener('click', () => copyToClipboard(fullResponse, copyMdBtn));
            copyTextBtn.addEventListener('click', () => copyToClipboard(contentDiv.innerText, copyTextBtn));

            // Save the response to session
            if (!isTemporarySession) {
                const session = sessions.find(s => s.id === currentSessionId);
                if (session) {
                    session.messages.push({ role: 'assistant', content: fullResponse });
                    saveSessions();
                }
            } else {
                if (!window.tempMessages) window.tempMessages = [];
                window.tempMessages.push({ role: 'assistant', content: fullResponse });
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                contentDiv.innerHTML += '<br><em>[Generation stopped]</em>';
            } else {
                console.error('Error:', error);
                contentDiv.innerHTML = `**Error:** ${error.message || 'Connection failed.'}`;
            }
        } finally {
            abortController = null;
            loadingIndicator.classList.add('hidden');
            sendBtn.disabled = false;
            userInput.focus();
        }
    };

    // Listeners
    newChatBtn.addEventListener('click', createNewSession);
    tempChatBtn.addEventListener('click', startTemporarySession);

    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
        const hasText = userInput.value.trim().length > 0;
        sendBtn.disabled = !hasText;
    });

    // Initialize
    loadSessions();
    if (sessions.length === 0) createNewSession();
    // Load first session if exists
    else if (!currentSessionId && sessions.length > 0) loadSession(sessions[0].id);

});
