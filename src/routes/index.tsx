import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, Droplets, FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ניהול דירות — חשמל, מים וחוזים" },
      { name: "description", content: "חישוב חשבונות חשמל ומים לשתי דירות, מעקב תשלומים, סיכום לוואטסאפ וניהול חוזים." },
      { property: "og:title", content: "ניהול דירות — חשמל, מים וחוזים" },
      { property: "og:description", content: "חישוב חשבונות חשמל ומים לשתי דירות, מעקב תשלומים וניהול חוזים." },
    ],
  }),
  component: Index,
});

function Index() {
  const items = [
    { icon: Zap, t: "חשמל לפי מונה ראשי ומונה משנה" },
    { icon: Droplets, t: "מים באותו חישוב בדיוק" },
    { icon: MessageCircle, t: "סיכום מוכן לוואטסאפ לכל דייר" },
    { icon: FileText, t: "חוזים, מועדים ואופציות" },
  ];
  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-4xl font-bold leading-tight text-foreground">
          החשבונות של הדירות,
          <br />
          <span className="text-primary">בלי מחשבון.</span>
        </h1>
        <ul className="mt-8 space-y-4">
          {items.map((i) => (
            <li key={i.t} className="flex items-center gap-3 text-foreground">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <i.icon className="h-5 w-5" />
              </span>
              {i.t}
            </li>
          ))}
        </ul>
        <Button asChild className="mt-10 h-12 w-full text-base">
          <Link to="/dashboard">כניסה למערכת</Link>
        </Button>
      </div>
    </div>
  );
}
