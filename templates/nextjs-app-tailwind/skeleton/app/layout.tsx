import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout(props: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">{props.children}</body>
    </html>
  );
}
