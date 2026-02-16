using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using System.IO;

namespace AIChatApp
{
    public partial class MainWindow : Window
    {
        private readonly HttpClient _httpClient;
        private readonly List<ChatMessage> _messages = new();
        private readonly string _apiKey;
        private const int MaxContextMessages = 10;
        
        // Model IDs mapped to display names
        private readonly Dictionary<string, string> _modelIds = new()
        {
            { "OpenRouter: Auto (Free)", "openrouter/free" },
            { "Aurora Alpha", "openrouter/aurora-alpha" },
            { "StepFun: Step 3.5 Flash", "stepfun/step-3.5-flash:free" },
            { "Arcee AI: Trinity Large Preview", "arcee-ai/trinity-large-preview:free" }
        };

        private const double MinFontSize = 10;
        private const double MaxFontSize = 24;
        private double _currentFontSize = 14;

        public double CurrentFontSize
        {
            get => _currentFontSize;
            set
            {
                if (_currentFontSize != value)
                {
                    _currentFontSize = Math.Clamp(value, MinFontSize, MaxFontSize);
                    this.FontSize = _currentFontSize; // Apply to Window
                    ChatBrowser.CoreWebView2.ExecuteScriptAsync($"updateFontSize({CurrentFontSize})");
                }
            }
        }

        public MainWindow()
        {
            InitializeComponent();
            
            _httpClient = new HttpClient();
            _apiKey = GetApiKey();
            
            if (string.IsNullOrEmpty(_apiKey))
            {
                MessageBox.Show("API Key not found! Please ensure APIKEY.txt exists in the same folder as the application.",
                    "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }

            InitializeWebView();
            this.FontSize = _currentFontSize; // Set initial font size
        }

        private async void InitializeWebView()
        {
            await ChatBrowser.EnsureCoreWebView2Async();
            ChatBrowser.CoreWebView2.Settings.IsZoomControlEnabled = false;
            ChatBrowser.NavigateToString(HtmlAssets.GetHtmlContent());
        }

        private void IncreaseFont_Click(object sender, RoutedEventArgs e) 
        {
            CurrentFontSize += 2;
            ChatBrowser.CoreWebView2.ExecuteScriptAsync($"updateFontSize({CurrentFontSize})");
        }

        private void DecreaseFont_Click(object sender, RoutedEventArgs e) 
        {
            CurrentFontSize -= 2;
            ChatBrowser.CoreWebView2.ExecuteScriptAsync($"updateFontSize({CurrentFontSize})");
        }

        // Method Removed: UpdateAllMessagesFontSize as it is now handled by CSS/JS via WebView.

        private string GetApiKey()
        {
            try
            {
                string localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "APIKEY.txt");
                if (File.Exists(localPath)) return File.ReadAllText(localPath).Trim();

                string originalPath = "C:\\Users\\Asus\\Desktop\\OPENROUTER MODELS\\APIKEY.txt";
                if (File.Exists(originalPath)) return File.ReadAllText(originalPath).Trim();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error reading API key: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            return string.Empty;
        }

        private void ModelComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e) { }

        private void MessageTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            SendButton.IsEnabled = !string.IsNullOrWhiteSpace(MessageTextBox.Text);
        }

        private void MessageTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter && !Keyboard.Modifiers.HasFlag(ModifierKeys.Shift))
            {
                e.Handled = true;
                SendMessage();
            }
        }

        private async Task SendMessage()
        {
            string userMessage = MessageTextBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(userMessage) || string.IsNullOrEmpty(_apiKey))
                return;

            MessageTextBox.Text = string.Empty;
            SendButton.IsEnabled = false;

            // Display user message in WebView
            var escapedUserMsg = System.Text.Json.JsonSerializer.Serialize(userMessage);
            await ChatBrowser.CoreWebView2.ExecuteScriptAsync($"appendUserMessage({escapedUserMsg})");

            _messages.Add(new ChatMessage { Role = "user", Content = userMessage });

            var selectedItem = ModelComboBox.SelectedItem as ComboBoxItem;
            string displayName = (selectedItem?.Content as TextBlock)?.Text ?? "OpenRouter: Auto (Free)";
            string modelId = _modelIds.GetValueOrDefault(displayName, "openrouter/free");

            try
            {
                var contextMessages = _messages.TakeLast(MaxContextMessages).ToList();
                var response = await SendStreamingRequest(modelId, contextMessages);
                
                if (!string.IsNullOrEmpty(response))
                {
                    _messages.Add(new ChatMessage { Role = "assistant", Content = response });
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Stream Error: {ex.Message}");
            }
            finally
            {
                SendButton.IsEnabled = true;
                MessageTextBox.Focus();
            }
        }

        private async void SendButton_Click(object sender, RoutedEventArgs e)
        {
            await SendMessage();
        }

        private async Task<string> SendStreamingRequest(string modelId, List<ChatMessage> contextMessages)
        {
            await ChatBrowser.CoreWebView2.ExecuteScriptAsync("startAIMessage()");

            var requestBody = new { model = modelId, messages = contextMessages, stream = true, max_tokens = 4096 };
            var request = new HttpRequestMessage(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions");
            request.Headers.Add("Authorization", $"Bearer {_apiKey}");
            request.Headers.Add("HTTP-Referer", "http://localhost");
            request.Headers.Add("X-Title", "AI Chat WPF");
            
            var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };
            request.Content = new StringContent(System.Text.Json.JsonSerializer.Serialize(requestBody, options), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                var escapedError = System.Text.Json.JsonSerializer.Serialize($"Error: {response.StatusCode} - {error}");
                await ChatBrowser.CoreWebView2.ExecuteScriptAsync($"appendAIToken({escapedError})");
                return "";
            }

            using var stream = await response.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);
            StringBuilder fullResponse = new StringBuilder();

            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrWhiteSpace(line)) continue;
                
                line = line.Trim();
                if (!line.StartsWith("data: ")) continue;

                var data = line.Substring(6).Trim();
                if (data == "[DONE]") break;

                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(data);
                    var choices = doc.RootElement.GetProperty("choices");
                    if (choices.GetArrayLength() > 0)
                    {
                        var delta = choices[0].GetProperty("delta");
                        if (delta.TryGetProperty("content", out var contentProp))
                        {
                            var content = contentProp.GetString();
                            if (!string.IsNullOrEmpty(content))
                            {
                                fullResponse.Append(content);
                                var escapedToken = System.Text.Json.JsonSerializer.Serialize(content);
                                await ChatBrowser.CoreWebView2.ExecuteScriptAsync($"appendAIToken({escapedToken})");
                            }
                        }
                    }
                }
                catch { }
            }
            return fullResponse.ToString();
        }
    }

    public class ChatMessage
    {
        public string Role { get; set; } = "";
        public string Content { get; set; } = "";
    }
}
