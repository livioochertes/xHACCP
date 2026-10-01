import { Bot, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function AiChatWidget() {
  const [, navigate] = useLocation();

  return (
    <Button
      type="button"
      aria-label="Open Nori AI"
      title="Nori AI"
      onClick={() => navigate("/ai-assistant")}
      className="fixed bottom-5 right-5 z-[70] h-14 rounded-full bg-primary px-5 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span className="relative mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <Bot className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-emerald-300" />
      </span>
      <span className="font-semibold">Nori AI</span>
      <MessageCircle className="ml-2 h-4 w-4 opacity-80" />
    </Button>
  );
}