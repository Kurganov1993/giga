import { NextRequest, NextResponse } from 'next/server'
import fetch from 'node-fetch'
import https from 'https'
import { v4 as uuidv4 } from 'uuid'

// Конфигурация
const isProduction = process.env.NODE_ENV === 'production'
const MAX_MESSAGE_LENGTH = 4000
const REQUEST_TIMEOUT = 30000 // 30 секунд
const TOKEN_CACHE_TTL = 30 * 60 * 1000 // 30 минут

// Глобальный кэш для токена
let tokenCache: {
  token: string
  expiresAt: number
} | null = null

// HTTPS агент с улучшенными настройками
const agent = new https.Agent({
  rejectUnauthorized: isProduction,
  keepAlive: true,
  maxSockets: 50,
  timeout: REQUEST_TIMEOUT,
})

const CLIENT_ID = process.env.GIGACHAT_CLIENT_ID
const CLIENT_SECRET = process.env.GIGACHAT_CLIENT_SECRET

// Валидация конфигурации
function validateConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GigaChat API credentials are not configured')
  }
  
  if (CLIENT_ID === '9b551490-5bc0-441f-892b-ad2e93fe491e' || 
      CLIENT_SECRET === '7739daa8-f3c4-43d1-a372-69b8542b0071') {
    console.warn('Using default GigaChat credentials. Please configure your own credentials.')
  }
}

// Получение access token с кэшированием
async function getAccessToken(): Promise<string> {
  // Проверяем валидный кэшированный токен
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token
  }

  validateConfig()
  
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const rqUID = uuidv4()
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const tokenResponse = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': rqUID,
      },
      body: 'scope=GIGACHAT_API_PERS',
      agent,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('GigaChat authentication failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        rqUID
      })
      
      throw new Error(`Authentication failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string
      expires_in: number
    }
    
    // Кэшируем токен с запасом в 1 минуту
    const expiresIn = (tokenData.expires_in - 60) * 1000 // конвертируем в ms и вычитаем запас
    tokenCache = {
      token: tokenData.access_token,
      expiresAt: Date.now() + expiresIn
    }

    console.log('Access token obtained successfully')
    return tokenData.access_token

  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Authentication request timeout')
    }
    
    throw error
  }
}

// Валидация входных данных
function validateInput(message: string, temperature: number): { isValid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Valid message is required' }
  }

  if (message.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' }
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { 
      isValid: false, 
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` 
    }
  }

  if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
    return { 
      isValid: false, 
      error: 'Temperature must be a number between 0 and 2' 
    }
  }

  return { isValid: true }
}

export async function POST(request: NextRequest) {
  let requestId = uuidv4()
  
  console.log(`[${requestId}] Processing chat request`)

  try {
    // Проверяем размер тела запроса
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      )
    }

    const body = await request.json().catch(() => null)
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { message, temperature = 0.7 } = body

    // Валидация входных данных
    const validation = validateInput(message, temperature)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    console.log(`[${requestId}] Getting access token...`)
    const accessToken = await getAccessToken()

    console.log(`[${requestId}] Sending message to GigaChat...`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const chatResponse = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: 'GigaChat',
          messages: [
            {
              role: 'user',
              content: message.trim(),
            },
          ],
          temperature: Math.max(0, Math.min(2, temperature)), // clamp value
          max_tokens: 1024,
          top_p: 0.9, // Добавляем для лучшего контроля качества
          stream: false,
        }),
        agent,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text()
        console.error(`[${requestId}] GigaChat API request failed:`, {
          status: chatResponse.status,
          statusText: chatResponse.statusText,
          requestId
        })
        
        if (chatResponse.status === 401) {
          // Инвалидируем кэш токена при 401 ошибке
          tokenCache = null
          return NextResponse.json(
            { error: 'Authentication failed. Please check your API credentials.' },
            { status: 401 }
          )
        }
        
        if (chatResponse.status === 429) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
          )
        }

        if (chatResponse.status >= 500) {
          return NextResponse.json(
            { error: 'GigaChat service is temporarily unavailable. Please try again later.' },
            { status: 503 }
          )
        }
        
        return NextResponse.json(
          { error: `GigaChat API error: ${chatResponse.status}` },
          { status: chatResponse.status }
        )
      }

      const chatData = await chatResponse.json() as any
      
      if (!chatData.choices?.[0]?.message?.content) {
        console.error(`[${requestId}] Invalid response format:`, chatData)
        throw new Error('Invalid response format from GigaChat')
      }

      const response = chatData.choices[0].message.content
      console.log(`[${requestId}] Successfully received response from GigaChat`)

      return NextResponse.json({ 
        response,
        usage: chatData.usage, // Передаем информацию об использовании токенов
        requestId 
      })

    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('GigaChat API request timeout')
      }
      
      throw fetchError
    }

  } catch (error) {
    console.error(`[${requestId}] Error in chat API:`, error)
    
    let errorMessage = 'Internal server error'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message.includes('credentials are not configured')) {
        errorMessage = 'Service configuration error'
        statusCode = 500
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.'
        statusCode = 504
      } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
        errorMessage = 'SSL certificate error. Please ensure your server has updated root certificates.'
        statusCode = 502
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.'
        statusCode = 503
      } else if (error.message.includes('401') || error.message.includes('authenticate')) {
        errorMessage = 'Authentication failed. Please check your API credentials.'
        statusCode = 401
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    )
  }
}

// Health check endpoint
export async function GET() {
  const isConfigured = !!(CLIENT_ID && CLIENT_SECRET)
  
  return NextResponse.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    configured: isConfigured,
    tokenCached: !!(tokenCache && tokenCache.expiresAt > Date.now()),
    limits: {
      maxMessageLength: MAX_MESSAGE_LENGTH,
      requestTimeout: REQUEST_TIMEOUT
    }
  })
}

// Очистка кэша токена (для тестирования)
export async function DELETE() {
  tokenCache = null
  return NextResponse.json({ 
    status: 'Token cache cleared',
    timestamp: new Date().toISOString()
  })
}