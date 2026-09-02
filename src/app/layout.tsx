import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import type { ReactNode } from "react";

import { WdsProviders } from "./providers";

import "./globals.css";
import "@wanteddev/wds/global.css";

const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "Rally On",
  description: "테니스 초보자를 위한 부담 없는 매칭 서비스",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${notoSansKr.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <WdsProviders>{children}</WdsProviders>
      </body>
    </html>
  );
}
