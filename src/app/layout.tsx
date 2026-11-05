import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TaskProvider } from "@/context/TaskContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { CalendarFeedProvider } from "@/context/CalendarFeedContext";
import { THEME_COLORS, themeBootScript } from "@/utils/theme";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Self-hosted so a build never depends on reaching Google Fonts. A variable font,
// so in-between weights like 650 render as written.
const plusJakarta = localFont({
  src: "./fonts/PlusJakartaSans-latin-variable.woff2",
  weight: "200 800",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Juice",
  description: "A beautiful task management app",
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: `${basePath}/favicon-48.png`,
    apple: `${basePath}/icon-180.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Juice",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
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
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <ThemeProvider>
          <SettingsProvider>
            <TaskProvider>
              <CalendarFeedProvider>
                {children}
              </CalendarFeedProvider>
            </TaskProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
