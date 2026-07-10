import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout(props: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
