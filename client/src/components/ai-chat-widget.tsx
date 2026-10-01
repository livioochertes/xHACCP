import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { getNoriAiCopy } from "@/lib/nori-ai-copy";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

interface SavedSession {
  isConnected: boolean;
  sessionId: string | null;
}

function welcomeMessage(text: string): Message {
  return {
    id: "1",
    text,
    sender: "assistant",
    timestamp: new Date(),
  };
}

function readSavedMessages(welcomeText: string): Message[] {
  const fallback = [welcomeMessage(welcomeText)];
  if (typeof window === "undefined") return fallback;

  try {
    const savedMessages = window.localStorage.getItem("aiAssistant_messages");
    if (!savedMessages) return fallback;

    const parsed = JSON.parse(savedMessages);
    if (!Array.isArray(parsed)) return fallback;

    const messages = parsed
      .filter(
        (message): message is Record<string, unknown> =>
          Boolean(message) && typeof message === "object",
      )
      .filter(
        (message) =>
          typeof message.id === "string" &&
          typeof message.text === "string" &&
          (message.sender === "user" || message.sender === "assistant"),
      )
      .map((message) => ({
        id: message.id as string,
        text: message.text as string,
        sender: message.sender as Message["sender"],
        timestamp: new Date(String(message.timestamp ?? Date.now())),
      }));

    return messages.length ? messages : fallback;
  } catch (error) {
    console.warn("Unable to restore Nori AI chat history:", error);
    return fallback;
  }
}

function readSavedSession(): SavedSession {
  if (typeof window === "undefined") {
    return { isConnected: false, sessionId: null };
  }

  try {
    const sessionId = window.localStorage.getItem("aiAssistant_sessionId");
    return {
      isConnected:
        window.localStorage.getItem("aiAssistant_isConnected") === "true" &&
        Boolean(sessionId),
      sessionId,
    };
  } catch {
    return { isConnected: false, sessionId: null };
  }
}

function readSavedCapabilities(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem("aiAssistant_capabilities");
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function AiChatWidget() {
  const [location] = useLocation();
  const copy = getNoriAiCopy();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() =>
    readSavedMessages(copy.welcome),
  );
  const [inputMessage, setInputMessage] = useState("");
  const initialSession = readSavedSession();
  const [isConnected, setIsConnected] = useState(initialSession.isConnected);
  const [sessionId, setSessionId] = useState<string | null>(
    initialSession.sessionId,
  );
  const [capabilities, setCapabilities] = useState<string[]>(
    readSavedCapabilities,
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const connectAttemptedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDedicatedPage = location === "/ai-assistant";

  const handleConnect = async () => {
    if (isConnecting) return;
    connectAttemptedRef.current = true;
    setIsConnecting(true);
    setHasConnectionError(false);

    try {
      const response = await apiRequest("POST", "/api/ai/connect", {});
      const data = await response.json();
      if (!data.success || !data.sessionId) {
        throw new Error(data.message || "Failed to connect to Nori AI.");
      }

      setIsConnected(true);
      setSessionId(data.sessionId);
      const nextCapabilities = Array.isArray(data.capabilities)
        ? data.capabilities.filter(
            (item: unknown): item is string => typeof item === "string",
          )
        : [];
      setCapabilities(nextCapabilities);
      trackEvent("ai_assistant_connected", {
        market: getMarketFromHostname(),
      });
    } catch (error) {
      console.error("Nori AI connection error:", error);
      setHasConnectionError(true);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (
      open &&
      !isDedicatedPage &&
      !isConnected &&
      !isConnecting &&
      !connectAttemptedRef.current
    ) {
      void handleConnect();
    }
  }, [open, isConnected, isConnecting, isDedicatedPage]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        window.localStorage.setItem(
          "aiAssistant_messages",
          JSON.stringify(messages),
        );
      } catch (error) {
        console.warn("Unable to save Nori AI chat history:", error);
      }
    }
  }, [messages]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "aiAssistant_isConnected",
        String(isConnected),
      );
      if (sessionId) {
        window.localStorage.setItem("aiAssistant_sessionId", sessionId);
      }
      if (capabilities.length > 0) {
        window.localStorage.setItem(
          "aiAssistant_capabilities",
          JSON.stringify(capabilities),
        );
      }
    } catch (error) {
      console.warn("Unable to save Nori AI session:", error);
    }
  }, [isConnected, sessionId, capabilities]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      connectAttemptedRef.current = false;
      setMessages(readSavedMessages(copy.welcome));
      const savedSession = readSavedSession();
      setIsConnected(savedSession.isConnected);
      setSessionId(savedSession.sessionId);
      setCapabilities(readSavedCapabilities());
      setHasConnectionError(false);
    }
    setOpen(nextOpen);
  };

  const sendMessage = async (messageText: string) => {
    const text = messageText.trim();
    if (!text || !isConnected || !sessionId || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((current) => [...current, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const response = await apiRequest("POST", "/api/ai/chat", {
        message: userMessage.text,
        sessionId,
        language: copy.language,
      });
      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || data.message || copy.connectionFailed,
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((current) => [...current, assistantMessage]);
      trackEvent("ai_message_sent", {
        message_length: userMessage.text.length,
        language: copy.language,
        market: getMarketFromHostname(),
        response_status: "success",
      });
    } catch (error) {
      console.error("Nori AI chat error:", error);
      setMessages((current) => [
        ...current,
        {
          id: (Date.now() + 1).toString(),
          text: copy.connectionFailed,
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
      trackEvent("ai_message_sent", {
        message_length: userMessage.text.length,
        language: copy.language,
        market: getMarketFromHostname(),
        response_status: "failed",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(inputMessage);
  };

  if (isDedicatedPage) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-label="Open Nori AI"
          aria-expanded={open}
          title="Nori AI"
          className="fixed bottom-5 right-5 z-[70] h-14 rounded-full bg-primary px-5 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className="relative mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Bot className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-emerald-300" />
          </span>
          <span className="font-semibold">Nori AI</span>
          <MessageCircle className="ml-2 h-4 w-4 opacity-80" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        className="z-[75] flex h-[min(620px,calc(100dvh-6.5rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden p-0 shadow-2xl"
      >
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold leading-5">Nori AI</h2>
            <p className="truncate text-xs text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
            )}
            <span className="hidden sm:inline">
              {isConnecting
                ? copy.connecting
                : isConnected
                  ? copy.connected
                  : hasConnectionError
                    ? copy.connectionFailed
                    : copy.connecting}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={copy.close}
            onClick={() => setOpen(false)}
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {hasConnectionError && !isConnected && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              {copy.connectionFailed}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                connectAttemptedRef.current = false;
                void handleConnect();
              }}
              className="h-7 shrink-0 px-2"
            >
              {copy.retry}
            </Button>
          </div>
        )}

        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4"
          aria-live="polite"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.sender === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] break-words rounded-xl px-3 py-2 ${
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                {message.sender === "assistant" &&
                  message.id === "1" &&
                  messages.length === 1 && (
                    <div className="mt-3 grid gap-2">
                      {copy.questions.map((question) => (
                        <Button
                          key={question}
                          type="button"
                          variant="outline"
                          disabled={isTyping}
                          onClick={() => {
                            if (isConnected) void sendMessage(question);
                            else setInputMessage(question);
                          }}
                          className="h-auto justify-start whitespace-normal bg-background p-2 text-left text-xs leading-normal"
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  )}
                <p className="mt-1 text-right text-[10px] opacity-60">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {message.sender === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <MessageCircle className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.thinking}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSendMessage}
          className="flex shrink-0 gap-2 border-t p-3"
        >
          <Input
            value={inputMessage}
            onChange={(event) => setInputMessage(event.target.value)}
            placeholder={copy.inputPlaceholder}
            disabled={!isConnected || isTyping}
            aria-label={copy.inputPlaceholder}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={copy.send}
            disabled={!isConnected || !inputMessage.trim() || isTyping}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}