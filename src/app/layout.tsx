import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TaskProvider } from "@/context/TaskContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const basePath = process.env.NODE_ENV === 'production' ? '/juice' : '';

export const metadata: Metadata = {
  title: "Juice",
  description: "A beautiful task management app",
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: `${basePath}/icon-180.png`,
    apple: `${basePath}/icon-180.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Juice",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F6F3" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1C1C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={plusJakarta.variable}>
      <head>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <ThemeProvider>
          <SettingsProvider>
            <TaskProvider>
              {children}
            </TaskProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}