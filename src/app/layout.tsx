import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TaskProvider } from "@/context/TaskContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";

export const metadata: Metadata = {
  title: "Juice",
  description: "A beautiful task management app",
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
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
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
