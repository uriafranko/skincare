import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { cn } from "@/lib/utils";
import messages from "@/messages/en.json";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: messages.Metadata.title,
  description: messages.Metadata.description,
  openGraph: {
    title: messages.Metadata.ogTitle,
    description: messages.Metadata.ogDescription,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, bricolageGrotesque.variable, "font-sans")}>
      <body>
        <NextIntlClientProvider locale="en" messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
