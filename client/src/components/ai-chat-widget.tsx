import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { getNoriAiCopy } from "@/lib/nori-ai-copy";
import { trackEvent } from "@/lib/analytics";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

const WELCOME_MESSAGE_ID = "1";

function readSavedMessages(welcome: string): ChatMessage[] {
  try {
    const saved = localStorage.getItem("aiAssistant_messages");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const restored = parsed
          .filter(
            (message): message is ChatMessage =>
              typeof message?.id === "string" &&
              typeof message?.text === "string" &&
              (message?.sender === "user" || message?.sender === "assistant"),
          )
          .map((message) => ({
            ...message,
            timestamp: new Date(message.timestamp),
          }));

        if (
          restored[0]?.id === WELCOME_MESSAGE_ID &&
          restored[0]?.sender === "assistant"
        ) {
          restored[0] = { ...restored[0], text: welcome };
        }
        if (restored.length > 0) return restored;
      }
    }
  } catch {
    // Use a clean welcome message if the saved chat is invalid.
  }

  return [{
    id: WELCOME_MESSAGE_ID,
    text: welcome,
    sender: "assistant",
    timestamp: new Date(),
  }];
}

function readSavedSession() {
  try {
    const sessionId = localStorage.getItem("aiAssistant_sessionId");
    return {
      sessionId,
      isConnected:
        localStorage.getItem("aiAssistant_isConnected") === "true" &&
        Boolean(sessionId),
    };
  } catch {
    return { sessionId: null, isConnected: false };
  }
}

function renderMessageWithLinks(text: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    parts.push(
      <Link
        key={match.index}
        href={match[2]}
        className="font-medium text-primary underline underline-offset-2"
      >
        {match[1]}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export default function AiChatWidget() {
  const [location] = useLocation();
  const copy = getNoriAiCopy();
  const market = getMarketFromHostname();
  const savedSession = readSavedSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    readSavedMessages(copy.welcome),
  );
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(savedSession.isConnected);
  const [sessionId, setSessionId] = useState<string | null>(savedSession.sessionId);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const connectAttemptedRef = useRef(false);
  const previousLocationRef = useRef(location);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setConnectionFailed(false);

    try {
      const response = await apiRequest("POST", "/api/ai/connect", {});
      const data = await response.json();
      if (!data.success || !data.sessionId) {
        throw new Error(data.message || "Unable to connect to Nori AI.");
      }

      setIsConnected(true);
      setSessionId(data.sessionId);
      trackEvent("ai_assistant_connected", { market });
    } catch (error) {
      console.error("Nori AI connection error:", error);
      setConnectionFailed(true);
      trackEvent("ai_assistant_connection_failed", { market });
    } finally {
      setIsConnecting(false);
    }
  }, [market]);

  useEffect(() => {
    if (open && !isConnected && !isConnecting && !connectAttemptedRef.current) {
      connectAttemptedRef.current = true;
      void handleConnect();
    }
  }, [open, isConnected, isConnecting, handleConnect]);

  useEffect(() => {
    if (location === "/ai-assistant") {
      setOpen(false);
    }

    if (
      previousLocationRef.current === "/ai-assistant" &&
      location !== "/ai-assistant"
    ) {
      const storedSession = readSavedSession();
      setMessages(readSavedMessages(copy.welcome));
      setSessionId(storedSession.sessionId);
      setIsConnected(storedSession.isConnected);
      setInputMessage("");
    }

    previousLocationRef.current = location;
  }, [location, copy.welcome]);

  useEffect(() => {
    if (!messages.length) return;
    try {
      localStorage.setItem("aiAssistant_messages", JSON.stringify(messages));
    } catch (error) {
      console.warn("Unable to save Nori AI chat history:", error);
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem("aiAssistant_isConnected", isConnected.toString());
      if (sessionId) {
        localStorage.setItem("aiAssistant_sessionId", sessionId);
      }
    } catch (error) {
      console.warn("Unable to save Nori AI session:", error);
    }
  }, [isConnected, sessionId]);

  useEffect(() => {
    if (open && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [open, messages, isTyping]);

  const sendMessage = async (messageText: string) => {
    const text = messageText.trim();
    if (!text || !isConnected || !sessionId || isTyping) return;

    const userMessage: ChatMessage = {
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
        message: text,
        sessionId,
        language: copy.language,
      });
      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        text: data.response || data.message || copy.connectionFailed,
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((current) => [...current, assistantMessage]);
      trackEvent("ai_message_sent", {
        message_length: text.length,
        language: copy.language,
        market,
        response_status: "success",
      });
    } catch (error) {
      console.error("Nori AI chat error:", error);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          text: copy.connectionFailed,
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
      trackEvent("ai_message_sent", {
        message_length: text.length,
        language: copy.language,
        market,
        response_status: "failed",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(inputMessage);
  };

  if (location === "/ai-assistant") return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-label="Nori AI"
          aria-expanded={open}
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
        aria-label="Nori AI chat"
        className="z-[70] flex h-[min(620px,calc(100dvh-6.5rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold leading-5">Nori AI</h2>
              <p className="truncate text-xs text-white/80">{copy.subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-white/90">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-300" : isConnecting ? "bg-amber-300" : "bg-white/50"
                }`}
              />
              {isConnecting ? copy.connecting : isConnected ? copy.connected : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.close}
              onClick={() => setOpen(false)}
              className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div
          ref={chatScrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4"
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
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  message.sender === "user"
                    ? "rounded-br-md bg-primary text-white"
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.sender === "assistant"
                    ? renderMessageWithLinks(message.text)
                    : message.text}
                </p>
                <time className="mt-1 block text-[10px] opacity-60">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          ))}

          {messages.length === 1 &&
            messages[0]?.id === WELCOME_MESSAGE_ID &&
            messages[0]?.sender === "assistant" && (
              <div className="ml-9 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {copy.language === "fr"
                    ? "Questions suggérées"
                    : copy.language === "ro"
                      ? "Întrebări sugerate"
                      : "Suggested questions"}
                </p>
                <div className="grid gap-2">
                  {copy.questions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => {
                        if (isConnected) void sendMessage(question);
                        else setInputMessage(question);
                      }}
                      disabled={isTyping}
                      className="rounded-xl border border-primary/20 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-700 transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {isTyping && (
            <div className="flex items-center gap-2 pl-9 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {copy.thinking}
            </div>
          )}
          <div />
        </div>

        <div className="border-t border-slate-200 bg-white px-3 py-3">
          {connectionFailed && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>{copy.connectionFailed}</span>
              <button
                type="button"
                className="shrink-0 font-semibold underline underline-offset-2"
                onClick={() => {
                  connectAttemptedRef.current = true;
                  void handleConnect();
                }}
              >
                {copy.retry}
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              placeholder={copy.inputPlaceholder}
              disabled={!isConnected || isTyping}
              aria-label={copy.inputPlaceholder}
              className="h-11 min-w-0 rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white"
            />
            <Button
              type="submit"
              size="icon"
              aria-label={copy.send}
              disabled={!isConnected || isTyping || !inputMessage.trim()}
              className="h-11 w-11 shrink-0 rounded-xl"
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}