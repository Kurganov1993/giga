import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Конфигурация безопасности
const SECURITY_HEADERS = {
  // Базовые заголовки безопасности
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Современные заголовки безопасности
  'Permissions-Policy': 'camera=(), microphone=(), location=()',
  'X-DNS-Prefetch-Control': 'off',
  
  // Для российских пользователей
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
} as const

// Дополнительные заголовки для продакшена
const PRODUCTION_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
} as const

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const { pathname } = request.nextUrl

  // Применяем базовые заголовки безопасности
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Дополнительные заголовки для продакшена
  if (process.env.NODE_ENV === 'production') {
    Object.entries(PRODUCTION_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // Заголовки для API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    // CORS для API (настройте под ваш домен)
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      'https://yourdomain.ru',
      'https://www.yourdomain.ru',
      'http://localhost:3000'
    ]

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }

    // Для preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: response.headers,
      })
    }
  }

  // Заголовки для статических ресурсов
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  // Заголовки для HTML страниц
  if (pathname.match(/\.(html|htm)$/) || pathname === '/') {
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, must-revalidate'
    )
  }

  // Блокировка доступа к敏感 файлам
  if (pathname.match(/\.(env|config|git|htaccess|htpasswd)$/)) {
    return new Response('Forbidden', { status: 403 })
  }

  // Rate limiting для API (базовый пример)
  if (pathname.startsWith('/api/chat')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    // Здесь можно добавить логику rate limiting на основе IP
    console.log(`API request from IP: ${ip}, Path: ${pathname}`)
  }

  // Geo-based redirect (пример для российских пользователей)
  const country = request.geo?.country?.toLowerCase()
  if (country === 'ru' && !pathname.startsWith('/ru')) {
    // Можно добавить редирект на русскую версию
    // const url = request.nextUrl.clone()
    // url.pathname = `/ru${pathname}`
    // return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
    
    // Особые случаи для API
    '/api/:path*',
    
    // Исключения для мониторинга и health checks
    '/((?!health|monitoring).*)',
  ],
}

// Вспомогательные функции для безопасности
const SecurityUtils = {
  // Валидация CSP (Content Security Policy)
  getCSPHeader(): string {
    const isProduction = process.env.NODE_ENV === 'production'
    
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Разрешить inline скрипты для Next.js
      "style-src 'self' 'unsafe-inline'", // Разрешить inline стили
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      // Для GigaChat API
      `connect-src 'self' https://gigachat.devices.sberbank.ru https://ngw.devices.sberbank.ru`,
    ]

    if (!isProduction) {
      directives.push("script-src 'self' 'unsafe-eval'") // Для development
    }

    return directives.join('; ')
  },

  // Генерация nonce для CSP
  generateNonce(): string {
    return Buffer.from(crypto.randomUUID()).toString('base64')
  }
}

// Дополнительный middleware для обработки ошибок
export function withErrorHandling(handler: Function) {
  return async (request: NextRequest) => {
    try {
      return await handler(request)
    } catch (error) {
      console.error('Middleware error:', error)
      
      // Возвращаем безопасный ответ без деталей ошибки
      return new Response(
        JSON.stringify({ 
          error: 'Internal Server Error',
          requestId: request.headers.get('x-request-id') 
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
    }
  }
}

// Экспорт для использования в других middleware
export { SECURITY_HEADERS, PRODUCTION_HEADERS }