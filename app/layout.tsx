import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'GigaChat AI - Российский AI ассистент',
    template: '%s | GigaChat AI'
  },
  description: 'Продвинутый AI ассистент на основе GigaChat от Сбера. Русский язык, понимание контекста, безопасное общение.',
  keywords: ['искусственный интеллект', 'AI', 'GigaChat', 'Сбер', 'чат-бот', 'нейросеть', 'русский язык'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}