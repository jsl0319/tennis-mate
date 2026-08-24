import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "Tennis Mate",
  description: "테니스 초보자를 위한 부담 없는 매칭 서비스",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`h-full antialiased ${notoSansKr.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
