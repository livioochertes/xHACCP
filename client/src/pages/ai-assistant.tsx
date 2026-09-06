import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, MessageCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getMarketFromHostname } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/language-context";

import { Link } from "wouter";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

// Function to render markdown links as clickable components
const renderMessageWithLinks = (text: string) => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add the link component
    const linkText = match[1];
    const linkUrl = match[2];
    parts.push(
      <Link 
        key={match.index} 
        href={linkUrl} 
        className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
      >
        {linkText}
      </Link>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
};

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [sessionRestored, setSessionRestored] = useState(false);
  const connectAttemptedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only auto-scroll for new messages (not when loading from localStorage)
  useEffect(() => {
    if (messages.length > 0 && shouldAutoScroll) {
      const lastMessage = messages[messages.length - 1];
      const isRecentMessage = Date.now() - lastMessage.timestamp.getTime() < 1000;
      
      if (isRecentMessage) {
        setTimeout(() => scrollToBottom(), 100);
      }
    }
  }, [messages, shouldAutoScroll]);

  // Load saved session data on component mount
  useEffect(() => {
    const savedIsConnected = localStorage.getItem('aiAssistant_isConnected');
    const savedSessionId = localStorage.getItem('aiAssistant_sessionId');
    const savedCapabilities = localStorage.getItem('aiAssistant_capabilities');
    const savedMessages = localStorage.getItem('aiAssistant_messages');

    if (savedIsConnected === 'true' && savedSessionId) {
      setIsConnected(true);
      setSessionId(savedSessionId);
      
      if (savedCapabilities) {
        try {
          setCapabilities(JSON.parse(savedCapabilities));
        } catch (e) {
          console.error('Failed to parse saved capabilities:', e);
        }
      }
    }

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        // Disable auto-scroll when loading existing messages
        setShouldAutoScroll(false);
        // Re-enable after a short delay
        setTimeout(() => setShouldAutoScroll(true), 1000);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
        // Set default welcome message if parsing fails
        setMessages([
          {
            id: "1",
            text: t('ai.welcome'),
            sender: "assistant",
            timestamp: new Date(),
          },
        ]);
      }
    } else {
      // Set default welcome message if no saved messages
      setMessages([
        {
          id: "1",
          text: t('ai.welcome'),
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    }
    setSessionRestored(true);
  }, []);

  // Auto-connect on page load after session restore check
  useEffect(() => {
    if (sessionRestored && !isConnected && !isConnecting && !connectAttemptedRef.current) {
      connectAttemptedRef.current = true;
      handleConnect();
    }
  }, [sessionRestored]);

  // Update welcome message when language changes
  useEffect(() => {
    if (messages.length > 0 && messages[0].id === "1" && messages[0].sender === "assistant") {
      setMessages(prevMessages => [
        {
          ...prevMessages[0],
          text: t('ai.welcome'),
        },
        ...prevMessages.slice(1)
      ]);
    }
  }, [t]);

  // Save session data whenever it changes
  useEffect(() => {
    localStorage.setItem('aiAssistant_isConnected', isConnected.toString());
    if (sessionId) {
      localStorage.setItem('aiAssistant_sessionId', sessionId);
    }
    if (capabilities.length > 0) {
      localStorage.setItem('aiAssistant_capabilities', JSON.stringify(capabilities));
    }
  }, [isConnected, sessionId, capabilities]);

  // Save messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('aiAssistant_messages', JSON.stringify(messages));
    }
  }, [messages]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await apiRequest("POST", "/api/ai/connect", {});
      const data = await response.json();
      
      if (data.success) {
        setIsConnected(true);
        setSessionId(data.sessionId);
        setCapabilities(data.capabilities || []);
        trackEvent("ai_assistant_connected", {
          market: getMarketFromHostname(),
        });
        
        toast({
          title: t('ai.connectionSuccess'),
          description: t('ai.connectionSuccessDesc'),
        });
      } else {
        throw new Error(data.message || "Failed to connect");
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast({
        title: t('ai.connectionFailed'),
        description: t('ai.connectionFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "1",
        text: t('ai.welcome'),
        sender: "assistant",
        timestamp: new Date(),
      },
    ]);
    localStorage.removeItem('aiAssistant_messages');
    toast({
      title: t('ai.chatCleared'),
      description: t('ai.chatClearedDesc'),
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isConnected || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const response = await apiRequest("POST", "/api/ai/chat", {
        message: userMessage.text,
        sessionId,
        language: language,
      });

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || data.message || t('ai.error'),
        sender: "assistant",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      trackEvent("ai_message_sent", {
        message_length: userMessage.text.length,
        language,
        market: getMarketFromHostname(),
        response_status: "success",
      });
    } catch (error) {
      console.error("Chat error:", error);
      trackEvent("ai_message_sent", {
        message_length: userMessage.text.length,
        language,
        market: getMarketFromHostname(),
        response_status: "failed",
      });
      
      // Add error message to chat instead of just toast
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: t('ai.error'),
        sender: "assistant",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: t('ai.connectionIssue'),
        description: t('ai.connectionIssueDesc'),
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const suggestedQuestions = [
    t('ai.suggestions.cleaning'),
    t('ai.suggestions.thermometer'),
    t('ai.suggestions.haccp'),
    t('ai.suggestions.bestsellers'),
    t('ai.suggestions.orderStatus'),
    t('ai.suggestions.invoices'),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              {t('ai.title')}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('ai.placeholder')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Connection Status & Features */}
            <div className="space-y-4 lg:col-span-1">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4" />
                    {t('ai.connectionStatus')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-xs font-medium">
                      {isConnected ? t('ai.connected') : t('ai.disconnected')}
                    </span>
                  </div>
                  {!isConnected && isConnecting && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('ai.connecting')}
                    </div>
                  )}
                  {!isConnected && !isConnecting && sessionRestored && (
                    <Button onClick={() => { connectAttemptedRef.current = false; handleConnect(); }} className="w-full h-8 text-xs" variant="outline">
                      {t('ai.connect')}
                    </Button>
                  )}
                  {isConnected && (
                    <Button 
                      onClick={handleClearChat} 
                      variant="outline" 
                      className="w-full h-8 text-xs"
                    >
                      {t('ai.clearChat')}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4" />
                    {t('ai.features')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {capabilities.length > 0 ? (
                      capabilities.map((capability, index) => (
                        <Badge key={index} variant="secondary" className="w-full justify-start text-xs py-1">
                          {capability}
                        </Badge>
                      ))
                    ) : (
                      <>
                        <Badge variant="outline" className="w-full justify-start text-xs py-1">
                          {t('ai.capabilities.productRecommendations')}
                        </Badge>
                        <Badge variant="outline" className="w-full justify-start text-xs py-1">
                          {t('ai.capabilities.kitchenSetup')}
                        </Badge>
                        <Badge variant="outline" className="w-full justify-start text-xs py-1">
                          {t('ai.capabilities.haccp')}
                        </Badge>
                        <Badge variant="outline" className="w-full justify-start text-xs py-1">
                          {t('ai.capabilities.equipmentComparison')}
                        </Badge>
                        <Badge variant="outline" className="w-full justify-start text-xs py-1">
                          {t('ai.capabilities.orderStatus')}
                        </Badge>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t('ai.quickQuestions')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {suggestedQuestions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left h-auto p-2 text-xs leading-normal whitespace-normal min-h-[2rem]"
                        onClick={() => {
                          if (isConnected) {
                            setInputMessage(question);
                          }
                        }}
                        disabled={!isConnected}
                      >
                        <span className="block break-words">{question}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chat Interface */}
            <div className="lg:col-span-3">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="flex-shrink-0 pb-4">
                  <CardTitle>{t('ai.chatTitle')}</CardTitle>
                  <CardDescription>
                    {t('ai.chatDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                  <div className="flex-1 flex flex-col min-h-0 px-6">
                    <ScrollArea className="flex-1 pr-4">
                      <div className="space-y-4 py-2">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${
                              message.sender === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            {message.sender === "assistant" && (
                              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot className="h-4 w-4 text-white" />
                              </div>
                            )}
                            <div
                              className={`max-w-[70%] p-3 rounded-lg break-words ${
                                message.sender === "user"
                                  ? "bg-primary text-white"
                                  : "bg-muted"
                              }`}
                            >
                              <div className="text-sm whitespace-pre-wrap">
                                {message.sender === "assistant" 
                                  ? renderMessageWithLinks(message.text)
                                  : message.text
                                }
                              </div>
                              <p className="text-xs opacity-70 mt-1">
                                {message.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                            {message.sender === "user" && (
                              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>
                        ))}
                        {isTyping && (
                          <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-white" />
                            </div>
                            <div className="bg-muted p-3 rounded-lg">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                    
                    <Separator className="my-4 flex-shrink-0" />
                    
                    <form onSubmit={handleSendMessage} className="flex gap-2 flex-shrink-0 pb-6">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder={
                          isConnected
                            ? t('ai.inputPlaceholder')
                            : t('ai.inputPlaceholderDisconnected')
                        }
                        disabled={!isConnected}
                        className="flex-1"
                      />
                      <Button type="submit" disabled={!isConnected || !inputMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}