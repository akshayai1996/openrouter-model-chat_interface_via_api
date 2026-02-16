import sys
import os
import json
import httpx
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                               QHBoxLayout, QTextEdit, QPushButton, QComboBox, 
                               QLabel, QMessageBox, QFrame)
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtCore import QUrl, Slot, Signal, QThread, Qt
from PySide6.QtGui import QIcon, QFont
import assets

# --- Configuration ---
MAX_CONTEXT_MESSAGES = 10
MODELS = {
    "OpenRouter: Auto (Free)": "openrouter/free",
    "Aurora Alpha": "openrouter/aurora-alpha",
    "StepFun: Step 3.5 Flash": "stepfun/step-3.5-flash:free",
    "Arcee AI: Trinity Large Preview": "arcee-ai/trinity-large-preview:free"
}

# --- Workers ---

class APIWorker(QThread):
    token_received = Signal(str)
    finished_response = Signal()
    error_occurred = Signal(str)

    def __init__(self, api_key, model, messages):
        super().__init__()
        self.api_key = api_key
        self.model = model
        self.messages = messages

    def run(self):
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost",
            "X-Title": "AI Chat Python",
            "Content-Type": "application/json"
        }
        data = {
            "model": self.model,
            "messages": self.messages,
            "stream": True,
            "max_tokens": 4096
        }

        try:
            with httpx.stream("POST", url, headers=headers, json=data, timeout=60.0) as response:
                if response.status_code != 200:
                    self.error_occurred.emit(f"Error: {response.status_code} - {response.read().decode()}")
                    return

                for line in response.iter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            json_data = json.loads(data_str)
                            choices = json_data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    self.token_received.emit(content)
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            self.error_occurred.emit(f"Connection Error: {str(e)}")
        finally:
            self.finished_response.emit()

# --- Main Window ---

class AIChatApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("AI Chat - OpenRouter (Python)")
        self.resize(1000, 700)
        self.setMinimumSize(700, 500)
        
        # Styles handling
        self.setStyleSheet("""
            QMainWindow { background-color: #0F172A; }
            QWidget { color: #F1F5F9; font-family: 'Segoe UI', sans-serif; font-size: 14px; }
            
            /* Frames */
            QFrame#Header { background-color: #1E293B; border-bottom: 1px solid #334155; }
            QFrame#InputArea { background-color: #1E293B; border-top: 1px solid #334155; }
            
            /* Titles */
            QLabel { color: #F1F5F9; }
            
            /* Text Edit */
            QTextEdit { 
                background-color: #334155; 
                border: 1px solid #475569; 
                border-radius: 8px; 
                padding: 10px;
                color: #F1F5F9;
            }
            
            /* Buttons */
            QPushButton {
                background-color: #334155;
                border: 1px solid #475569;
                border-radius: 6px;
                padding: 6px 12px;
                color: #F1F5F9;
            }
            QPushButton:hover { background-color: #475569; border-color: #94A3B8; }
            QPushButton:pressed { background-color: #1E293B; }
            
            /* Send Button */
            QPushButton#SendButton {
                background-color: #2563EB;
                border: none;
                font-weight: bold;
                padding: 10px 20px;
            }
            QPushButton#SendButton:hover { background-color: #3B82F6; }
            QPushButton#SendButton:disabled { background-color: #475569; color: #94A3B8; }

            /* ComboBox */
            QComboBox {
                background-color: #334155;
                border: 1px solid #475569;
                border-radius: 6px;
                padding: 5px 10px;
                color: #F1F5F9;
                min-height: 25px;
            }
            QComboBox:hover { border-color: #94A3B8; }
            QComboBox::drop-down {
                subcontrol-origin: padding;
                subcontrol-position: top right;
                width: 20px;
                border-left-width: 0px;
            }
            QComboBox::down-arrow {
                image: none;
                border-left: 2px solid #94A3B8;
                border-bottom: 2px solid #94A3B8;
                width: 6px;
                height: 6px;
                margin-right: 10px;
                transform: rotate(-45deg);
            }
            /* Dropdown List */
            QComboBox QAbstractItemView {
                background-color: #1E293B;
                color: #F1F5F9;
                border: 1px solid #475569;
                selection-background-color: #2563EB;
                selection-color: white;
                outline: none;
            }
        """)

        self.messages = []
        self.current_font_size = 14
        self.api_key = self.load_api_key()

        self.setup_ui()
        
        if not self.api_key:
            QMessageBox.warning(self, "Missing API Key", 
                "APIKEY.txt not found.\nPlease create it in the app directory.")

    def load_api_key(self):
        try:
            if os.path.exists("APIKEY.txt"):
                with open("APIKEY.txt", "r") as f:
                    return f.read().strip()
            # Fallbck to parent directory if running from subdir
            elif os.path.exists("../APIKEY.txt"):
                with open("../APIKEY.txt", "r") as f:
                    return f.read().strip()
        except Exception:
            pass
        return ""

    def setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 1. Header
        header = QFrame()
        header.setObjectName("Header")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(16, 12, 16, 12)

        # Logo/Title
        title_label = QLabel("AI Chat Assistant")
        title_label.setFont(QFont("Segoe UI", 12, QFont.Bold))
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()

        # Font Controls
        self.btn_font_dec = QPushButton("A-")
        self.btn_font_dec.setFixedWidth(40)
        self.btn_font_dec.clicked.connect(self.decrease_font)
        
        self.btn_font_inc = QPushButton("A+")
        self.btn_font_inc.setFixedWidth(40)
        self.btn_font_inc.clicked.connect(self.increase_font)

        header_layout.addWidget(self.btn_font_dec)
        header_layout.addWidget(self.btn_font_inc)
        header_layout.addSpacing(10)

        # Model Selector
        header_layout.addWidget(QLabel("Model:"))
        self.combo_model = QComboBox()
        self.combo_model.addItems(MODELS.keys())
        self.combo_model.setFixedWidth(250)
        header_layout.addWidget(self.combo_model)

        main_layout.addWidget(header)

        # 2. WebView (Chat Area)
        self.webview = QWebEngineView()
        self.webview.setHtml(assets.get_html_content())
        main_layout.addWidget(self.webview)

        # 3. Input Area
        input_area = QFrame()
        input_area.setObjectName("InputArea")
        input_layout = QHBoxLayout(input_area)
        input_layout.setContentsMargins(16, 16, 16, 16)

        self.input_text = QTextEdit()
        self.input_text.setPlaceholderText("Type your message...")
        self.input_text.setFixedHeight(60) # Fixed height for a cleaner look, can serve as a "lines=2" approx
        self.input_text.textChanged.connect(self.check_input)
        input_layout.addWidget(self.input_text)

        self.btn_send = QPushButton("Send")
        self.btn_send.setObjectName("SendButton")
        self.btn_send.setEnabled(False)
        self.btn_send.clicked.connect(self.send_message)
        input_layout.addWidget(self.btn_send)

        main_layout.addWidget(input_area)

        # Initialize Font in WebView
        # We need to wait for load? usually it's fast enough or we can inject later
        self.webview.loadFinished.connect(lambda: self.update_font_size())

    def check_input(self):
        self.btn_send.setEnabled(bool(self.input_text.toPlainText().strip()))

    def update_font_size(self):
        # Update Native UI Font
        font = QFont("Segoe UI", self.current_font_size)
        QApplication.setFont(font)
        # Update Web UI Font
        self.webview.page().runJavaScript(f"updateFontSize({self.current_font_size})")

    def decrease_font(self):
        if self.current_font_size > 10:
            self.current_font_size -= 2
            self.update_font_size()

    def increase_font(self):
        if self.current_font_size < 24:
            self.current_font_size += 2
            self.update_font_size()

    def send_message(self):
        user_text = self.input_text.toPlainText().strip()
        if not user_text or not self.api_key:
            return

        self.input_text.clear()
        self.btn_send.setEnabled(False)
        
        # 1. Show user message
        escaped_text = json.dumps(user_text)
        self.webview.page().runJavaScript(f"appendUserMessage({escaped_text})")
        
        self.messages.append({"role": "user", "content": user_text})

        # 2. Start AI Stream
        model_id = MODELS[self.combo_model.currentText()]
        context_messages = self.messages[-MAX_CONTEXT_MESSAGES:]
        
        # Prepare UI for AI response
        self.webview.page().runJavaScript("startAIMessage()")

        self.worker = APIWorker(self.api_key, model_id, context_messages)
        self.worker.token_received.connect(self.handle_token)
        self.worker.finished_response.connect(self.handle_finished)
        self.worker.error_occurred.connect(self.handle_error)
        self.worker.start()
        
        self.current_response = ""

    @Slot(str)
    def handle_token(self, token):
        self.current_response += token
        escaped_token = json.dumps(token)
        self.webview.page().runJavaScript(f"appendAIToken({escaped_token})")

    @Slot()
    def handle_finished(self):
        self.messages.append({"role": "assistant", "content": self.current_response})
        self.btn_send.setEnabled(True)
        self.input_text.setFocus()

    @Slot(str)
    def handle_error(self, error_msg):
        escaped_error = json.dumps(error_msg)
        self.webview.page().runJavaScript(f"appendAIToken({escaped_error})")
        self.btn_send.setEnabled(True)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = AIChatApp()
    window.show()
    sys.exit(app.exec())
