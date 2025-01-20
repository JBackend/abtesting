import type { Metadata } from 'next'
import './globals.css'
import { Inter } from "next/font/google";
import { ThemeProvider } from 'next-themes'
import { Providers } from './providers';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'AB Testing Framework',
  description: 'A framework for running AB tests',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
