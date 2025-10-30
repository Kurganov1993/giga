import { GigaChatResponse } from './types'
import { v4 as uuidv4 } from 'uuid'
import { 
  GigaChatError, 
  AuthenticationError, 
  RateLimitError, 
  NetworkError,
  ServiceUnavailableError,
  ValidationError 
} from './errors'

// Конфигурация
const CLIENT_ID = process.env.GIGACHAT_CLIENT_ID
const CLIENT_SECRET = process.env.GIGACHAT_CLIENT_SECRET
const API_TIMEOUT = 30000 // 30 секунд
const MAX_MESSAGE_LENGTH = 4000

// Валидация конфигурации
function validateConfig(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GigaChat credentials are not configured. Please set GIGACHAT_CLIENT_ID and GIGACHAT_CLIENT_SECRET environment variables.')
  }

  // Предупреждение для дефолтных значений (опасно для продакшена)
  const defaultClientId = '9b551490-5bc0-441f-892b-ad2e93fe491e'
  const defaultClientSecret = '7739daa8-f3c4-43d1-a372-69b8542b0071'
  
  if (CLIENT_ID === defaultClientId || CLIENT_SECRET === defaultClientSecret) {
    console.warn('⚠️  SECURITY WARNING: Using default GigaChat credentials. This is insecure for production use.')
  }
}

// Выполняем валидацию при импорте
validateConfig()

class GigaChatService {
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private tokenRefreshPromise: Promise<string> | null = null

  /**
   * Безопасный fetch с таймаутом
   */
  private async safeFetch(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout')
      }
      throw new NetworkError(error instanceof Error ? error.message : 'Network error')
    }
  }

  /**
   * Получение access token с кэшированием
   */
  private async getAccessToken(): Promise<string> {
    // Проверяем валидный токен (с запасом в 1 минуту)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken
    }

    // Если уже идет обновление токена, ждем его
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise
    }

    // Создаем promise для обновления токена
    this.tokenRefreshPromise = this.refreshAccessToken()
    
    try {
      const token = await this.tokenRefreshPromise
      return token
    } finally {
      this.tokenRefreshPromise = null
    }
  }

  /**
   * Обновление access token
   */
  private async refreshAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    const rqUID = uuidv4()
    
    try {
      const response = await this.safeFetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': rqUID,
        },
        body: 'scope=GIGACHAT_API_PERS',
      })

      if (response.status === 401) {
        throw new AuthenticationError('Invalid client credentials')
      }

      if (response.status === 429) {
        throw new RateLimitError('Too many token requests')
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new GigaChatError(
          `Authentication failed: ${response.status} ${response.statusText}`,
          'AUTH_FAILED', 
          response.status
        )
      }

      const data = await response.json() as {
        access_token: string
        expires_at?: number
        expires_in?: number
      }
      
      if (!data.access_token) {
        throw new AuthenticationError('No access token in response')
      }

      // Вычисляем время истечения токена
      if (data.expires_at) {
        this.tokenExpiresAt = data.expires_at
      } else if (data.expires_in) {
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000)
      } else {
        // Дефолтное время жизни токена - 30 минут
        this.tokenExpiresAt = Date.now() + (30 * 60 * 1000)
      }

      this.accessToken = data.access_token
      
      console.log('🔑 Access token refreshed successfully')
      
      return this.accessToken

    } catch (error) {
      // Сбрасываем токен при ошибках аутентификации
      if (error instanceof AuthenticationError) {
        this.accessToken = null
        this.tokenExpiresAt = 0
      }
      
      throw error
    }
  }

  /**
   * Валидация входного сообщения
   */
  private validateMessage(message: string): void {
    if (!message || typeof message !== 'string') {
      throw new ValidationError('Message must be a non-empty string')
    }

    if (message.trim().length === 0) {
      throw new ValidationError('Message cannot be empty or contain only whitespace')
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new ValidationError(
        `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`,
        { length: message.length, maxLength: MAX_MESSAGE_LENGTH }
      )
    }
  }

  /**
   * Отправка сообщения в GigaChat API
   */
  async sendMessage(message: string, options: {
    temperature?: number
    maxTokens?: number
  } = {}): Promise<string> {
    // Валидация входных данных
    this.validateMessage(message)

    try {
      const accessToken = await this.getAccessToken()

      const requestBody = {
        model: 'GigaChat',
        messages: [
          {
            role: 'user',
            content: message.trim(),
          },
        ],
        temperature: Math.max(0, Math.min(2, options.temperature || 0.7)),
        max_tokens: Math.max(1, Math.min(4096, options.maxTokens || 1024)),
        stream: false,
      }

      const response = await this.safeFetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      // Обработка специфических HTTP статусов
      if (response.status === 401) {
        // Инвалидируем токен и повторяем запрос один раз
        this.accessToken = null
        this.tokenExpiresAt = 0
        
        console.log('🔄 Token expired, retrying request...')
        return this.sendMessage(message, options)
      }

      if (response.status === 429) {
        throw new RateLimitError('Too many API requests')
      }

      if (response.status >= 500) {
        throw new ServiceUnavailableError('GigaChat service is temporarily unavailable')
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new GigaChatError(
          `API request failed: ${response.status} ${response.statusText}`,
          'API_ERROR', 
          response.status
        )
      }

      const data: GigaChatResponse = await response.json()
      
      if (!data.choices?.[0]?.message?.content) {
        throw new GigaChatError(
          'Invalid response format from GigaChat', 
          'INVALID_RESPONSE',
          502
        )
      }

      return data.choices[0].message.content

    } catch (error) {
      console.error('Error sending message to GigaChat:', error)
      
      // Пробрасываем ошибку дальше, если это уже GigaChatError
      if (error instanceof GigaChatError) {
        throw error
      }
      
      // Конвертируем обычные ошибки в GigaChatError
      throw new GigaChatError(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Проверка доступности сервиса
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    try {
      await this.getAccessToken()
      return { healthy: true, details: 'Service is available' }
    } catch (error) {
      return { 
        healthy: false, 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Принудительное обновление токена
   */
  async refreshToken(): Promise<void> {
    this.accessToken = null
    this.tokenExpiresAt = 0
    await this.getAccessToken()
  }

  /**
   * Получение статуса сервиса
   */
  getServiceStatus() {
    return {
      hasValidToken: !!(this.accessToken && Date.now() < this.tokenExpiresAt),
      tokenExpiresAt: this.tokenExpiresAt ? new Date(this.tokenExpiresAt).toISOString() : null,
      isRefreshingToken: !!this.tokenRefreshPromise
    }
  }
}

// Создаем синглтон экземпляр
export const gigaChatService = new GigaChatService()