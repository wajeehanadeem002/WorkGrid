import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WorkGrid", template: "%s · WorkGrid" },
  description:
    "A secure workspace for projects, tasks, and accountable team delivery.",
  applicationName: "WorkGrid",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      dynamic
      appearance={{
        variables: {
          colorPrimary: "#075c4b",
          colorPrimaryForeground: "#ffffff",
          colorBackground: "#fffdf8",
          colorForeground: "#10201d",
          colorMuted: "#ece8dd",
          colorMutedForeground: "#5f6d68",
          colorInput: "#ffffff",
          colorInputForeground: "#10201d",
          colorBorder: "#b8b0a2",
          colorRing: "#075c4b",
          colorNeutral: "#10201d",
          colorDanger: "#b42318",
          colorSuccess: "#067647",
          colorWarning: "#a15c07",
          borderRadius: "0.55rem",
        },
      }}
    >
      <html lang="en">
        <body>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
