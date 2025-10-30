import type { Metadata } from 'next'
import { Inter, Roboto } from 'next/font/google'
import './globals.css'

// Оптимизированные шрифты для русского языка
const inter = Inter({ 
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
  variable: '--font-inter',
})

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata: Metadata = {
  title: {
    default: 'GigaChat AI - Российский AI ассистент',
    template: '%s | GigaChat AI'
  },
  description: 'Продвинутый AI ассистент на основе GigaChat от Сбера. Русский язык, понимание контекста, безопасное общение.',
  keywords: ['искусственный интеллект', 'AI', 'GigaChat', 'Сбер', 'чат-бот', 'нейросеть', 'русский язык'],
  authors: [{ name: 'GigaChat AI Team' }],
  creator: 'GigaChat AI',
  publisher: 'GigaChat AI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://your-domain.ru'),
  alternates: {
    canonical: '/',
    languages: {
      'ru-RU': '/ru',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://your-domain.ru',
    title: 'GigaChat AI - Российский AI ассистент',
    description: 'Продвинутый AI ассистент на основе GigaChat от Сбера',
    siteName: 'GigaChat AI',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${roboto.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="yandex-verification" content="your-yandex-verification" />
        <meta name="google-site-verification" content="your-google-verification" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}