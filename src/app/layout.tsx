import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Golden Gate - Offboarding & Onboarding Agent',
  description: 'AI-powered offboarding and onboarding knowledge transfer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gg-bg text-gg-text`}>{children}</body>
    </html>
  )
}
