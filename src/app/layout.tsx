import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenDream — AI Marketing Autopilot",
  description: "Register your hackathon project, connect socials, and let AI handle your marketing. Content generation, audience targeting, CRM, and token deployment — fully automated.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
