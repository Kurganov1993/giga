import { NextRequest, NextResponse } from 'next/server'
import fetch from 'node-fetch'
import https from 'https'
import { v4 as uuidv4 } from 'uuid'

// Конфигурация
const MAX_MESSAGE_LENGTH = 4000
const REQUEST_TIMEOUT = 30000

// HTTPS агент с отключенной проверкой SSL для Vercel
const agent = new https.Agent({
  rejectUnauthorized: false, // ОТКЛЮЧАЕМ проверку SSL для Vercel
  keepAlive: true,
  maxSockets: 50,
})

const CLIENT_ID = process.env.GIGACHAT_CLIENT_ID
const CLIENT_SECRET = process.env.GIGACHAT_CLIENT_SECRET

// Глобальный кэш для токена
let tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GigaChat API credentials are not configured')
  }
  
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
      agent, // Используем наш кастомный агент
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!tokenResponse.ok) {
      throw new Error(`Authentication failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string
      expires_in: number
    }
    
    // Кэшируем токен
    const expiresIn = (tokenData.expires_in - 60) * 1000
    tokenCache = {
      token: tokenData.access_token,
      expiresAt: Date.now() + expiresIn
    }

    return tokenData.access_token

  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export async function POST(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    const { message, temperature = 0.7 } = await request.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Valid message is required' },
        { status: 400 }
      )
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` },
        { status: 400 }
      )
    }

    const accessToken = await getAccessToken()

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
          messages: [{ role: 'user', content: message.trim() }],
          temperature: Math.max(0, Math.min(2, temperature)),
          max_tokens: 1024,
          top_p: 0.9,
        }),
        agent, // Используем наш кастомный агент
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!chatResponse.ok) {
        if (chatResponse.status === 401) {
          tokenCache = null
        }
        throw new Error(`GigaChat API error: ${chatResponse.status}`)
      }

      const chatData = await chatResponse.json() as any
      
      if (!chatData.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from GigaChat')
      }

      return NextResponse.json({ 
        response: chatData.choices[0].message.content,
        usage: chatData.usage,
        requestId 
      })

    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error)
    
    let errorMessage = 'Internal server error'
    let statusCode = 500

    if (error.message.includes('credentials')) {
      errorMessage = 'Service configuration error'
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout'
      statusCode = 504
    } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
      errorMessage = 'SSL connection error'
      statusCode = 502
    } else if (error.message.includes('401')) {
      errorMessage = 'Authentication failed'
      statusCode = 401
    } else {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage, requestId },
      { status: statusCode }
    )
  }
}