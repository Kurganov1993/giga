import { GigaChatResponse } from './types'
import { v4 as uuidv4 } from 'uuid'
import { 
  GigaChatError, 
  AuthenticationError, 
  RateLimitError, 
  NetworkError,
  ServiceUnavailableError,
  TimeoutError,
  ValidationError,
  ErrorUtils
} from './errors'
import { config, configHelpers } from './config'

interface RequestOptions {
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

class GigaChatEnhancedService {
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private tokenRefreshPromise: Promise<string> | null = null
  private requestCounter: number = 0

  /**
   * Безопасный метод для выполнения HTTP запросов с таймаутом и обработкой ошибок
   */
  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    const requestId = `req-${++this.requestCounter}-${uuidv4().slice(0, 8)}`
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.app.apiTimeout)

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)

      const metadata = {
        requestId,
        url,
        method: options.method,
        timestamp: new Date().toISOString()
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(
          `Request timeout after ${config.app.apiTimeout}ms`,
          config.app.apiTimeout,
          metadata
        )
      }

      throw new NetworkError(
        error instanceof Error ? error.message : 'Network error occurred',
        metadata
      )
    }
  }

  /**
   * Получение access token с кэшированием и предотвращением race conditions
   */
  private async getAccessToken(): Promise<string> {
    // Проверяем валидный кэшированный токен
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) { // Запас 1 минута
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
    const credentials = Buffer.from(`${config.gigachat.clientId}:${config.gigachat.clientSecret}`).toString('base64')
    const rqUID = uuidv4()
    
    const metadata = {
      requestId: `auth-${rqUID.slice(0, 8)}`,
      timestamp: new Date().toISOString()
    }

    try {
      const response = await this.makeRequest(config.gigachat.authUrl, {
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
        throw new AuthenticationError('Invalid client credentials', metadata)
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
        throw new RateLimitError('Too many token requests', retryAfter, metadata)
      }

      if (!response.ok) {
        throw new GigaChatError(
          `Authentication failed: ${response.status} ${response.statusText}`,
          'AUTH_FAILED', 
          response.status,
          metadata
        )
      }

      const data = await response.json() as {
        access_token: string
        expires_at?: number
        expires_in?: number
      }
      
      if (!data.access_token) {
        throw new AuthenticationError('No access token in response', metadata)
      }

      // Вычисляем время истечения токена
      if (data.expires_at) {
        this.tokenExpiresAt = data.expires_at * 1000 // конвертируем в миллисекунды
      } else if (data.expires_in) {
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000 // вычитаем запас
      } else {
        // Дефолтное время жизни токена - 30 минут
        this.tokenExpiresAt = Date.now() + (30 * 60 * 1000) - 60000
      }

      this.accessToken = data.access_token
      
      console.log(`🔑 Access token refreshed, expires at: ${new Date(this.tokenExpiresAt).toISOString()}`)
      
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

    if (!configHelpers.validateMessageLength(message)) {
      throw new ValidationError(
        `Message too long. Maximum ${config.app.maxMessageLength} characters allowed.`,
        { length: message.length, maxLength: config.app.maxMessageLength }
      )
    }

    // Проверяем на наличие только пробельных символов
    if (/^\s*$/.test(message)) {
      throw new ValidationError('Message cannot be empty or contain only whitespace')
    }
  }

  /**
   * Отправка сообщения в GigaChat API
   */
  async sendMessage(message: string, options: RequestOptions = {}): Promise<string> {
    const requestId = `chat-${++this.requestCounter}-${uuidv4().slice(0, 8)}`
    const metadata = {
      requestId,
      messageLength: message.length,
      options,
      timestamp: new Date().toISOString()
    }

    try {
      // Валидация входных данных
      this.validateMessage(message)

      const accessToken = await this.getAccessToken()

      const requestBody = {
        model: 'GigaChat',
        messages: [
          {
            role: 'user',
            content: message.trim(),
          },
        ],
        temperature: configHelpers.validateTemperature(options.temperature || config.gigachat.temperature.default),
        max_tokens: options.maxTokens || config.gigachat.maxTokens,
        stream: options.stream !== undefined ? options.stream : config.features.enableStreaming,
        top_p: 0.9, // Добавляем для лучшего контроля качества
      }

      const response = await this.makeRequest(`${config.gigachat.apiUrl}/chat/completions`, {
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
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
        throw new RateLimitError('Too many API requests', retryAfter, metadata)
      }

      if (response.status >= 500) {
        throw new ServiceUnavailableError('GigaChat service is temporarily unavailable', metadata)
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response')
        throw new GigaChatError(
          `API request failed: ${response.status} ${response.statusText}`,
          'API_ERROR', 
          response.status,
          { ...metadata, responseBody: errorText.slice(0, 500) } // Ограничиваем длину лога
        )
      }

      const data: GigaChatResponse = await response.json()
      
      if (!data.choices?.[0]?.message?.content) {
        throw new GigaChatError(
          'Invalid response format from GigaChat', 
          'INVALID_RESPONSE',
          502,
          { ...metadata, responseData: data }
        )
      }

      console.log(`✅ Request ${requestId} completed successfully`)
      
      return data.choices[0].message.content

    } catch (error) {
      ErrorUtils.logError(
        error instanceof GigaChatError ? error : GigaChatError.fromError(error, metadata),
        metadata
      )
      throw error
    }
  }

  /**
   * Проверка доступности API
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      const token = await this.getAccessToken()
      
      return {
        healthy: true,
        details: {
          tokenValid: !!token,
          tokenExpiresAt: new Date(this.tokenExpiresAt).toISOString(),
          service: 'GigaChat API'
        }
      }
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          service: 'GigaChat API'
        }
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
   * Получение статистики сервиса
   */
  getServiceStats() {
    return {
      tokenValid: !!(this.accessToken && Date.now() < this.tokenExpiresAt),
      tokenExpiresAt: this.tokenExpiresAt ? new Date(this.tokenExpiresAt).toISOString() : null,
      totalRequests: this.requestCounter,
      isRefreshingToken: !!this.tokenRefreshPromise
    }
  }
}

// Создаем синглтон экземпляр
export const gigaChatEnhancedService = new GigaChatEnhancedService()