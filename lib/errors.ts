/**
 * Кастомные ошибки для GigaChat API и приложения
 * 
 * @remarks
 * Иерархия ошибок с дополнительными метаданными для лучшей обработки и логирования
 */

// Типы для дополнительных данных ошибок
export interface ErrorMetadata {
  requestId?: string
  timestamp?: string
  endpoint?: string
  details?: Record<string, any>
  retryAfter?: number
  originalError?: string
  responseBody?: string
  responseData?: any 
}

/**
 * Базовый класс ошибки GigaChat с дополнительными метаданными
 */
export class GigaChatError extends Error {
  public readonly code: string
  public readonly status: number
  public readonly timestamp: string
  public readonly metadata: ErrorMetadata

  constructor(
    message: string,
    code: string = 'GIGACHAT_ERROR',
    status: number = 500,
    metadata: ErrorMetadata = {}
  ) {
    super(message)
    this.name = 'GigaChatError'
    this.code = code
    this.status = status
    this.timestamp = new Date().toISOString()
    this.metadata = {
      timestamp: this.timestamp,
      ...metadata
    }

    // Сохраняем оригинальный stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GigaChatError)
    }
  }

  /**
   * Сериализация ошибки в JSON для API ответов
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      timestamp: this.timestamp,
      metadata: this.metadata
    }
  }

  /**
   * Создание ошибки из HTTP ответа
   */
  static fromResponse(response: Response, metadata?: ErrorMetadata): GigaChatError {
    const status = response.status
    const message = `HTTP ${status}: ${response.statusText}`

    switch (status) {
      case 401:
        return new AuthenticationError('Invalid API credentials', metadata)
      case 403:
        return new AuthenticationError('Access forbidden', metadata)
      case 429:
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
        return new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter} seconds`, retryAfter, metadata)
      case 502:
      case 503:
      case 504:
        return new ServiceUnavailableError('GigaChat service is temporarily unavailable', metadata)
      default:
        return new GigaChatError(message, `HTTP_${status}`, status, metadata)
    }
  }

  /**
   * Создание ошибки из исключения
   */
  static fromError(error: unknown, metadata?: ErrorMetadata): GigaChatError {
    if (error instanceof GigaChatError) {
      return error
    }

    if (error instanceof Error) {
      return new GigaChatError(
        error.message,
        'UNKNOWN_ERROR',
        500,
        { 
          ...metadata, 
          originalError: error.name 
        } as ErrorMetadata
      )
    }

    return new GigaChatError(
      'An unknown error occurred',
      'UNKNOWN_ERROR',
      500,
      metadata
    )
  }
}

/**
 * Ошибка аутентификации
 */
export class AuthenticationError extends GigaChatError {
  constructor(
    message: string = 'Authentication failed',
    metadata: ErrorMetadata = {}
  ) {
    super(message, 'AUTH_ERROR', 401, metadata)
    this.name = 'AuthenticationError'
  }
}

/**
 * Ошибка превышения лимита запросов
 */
export class RateLimitError extends GigaChatError {
  public readonly retryAfter: number

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number = 60,
    metadata: ErrorMetadata = {}
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, {
      ...metadata,
      retryAfter
    })
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }

  /**
   * Время, через которое можно повторить запрос (в миллисекундах)
   */
  getRetryDelay(): number {
    return this.retryAfter * 1000
  }
}

/**
 * Ошибка сети
 */
export class NetworkError extends GigaChatError {
  constructor(
    message: string = 'Network error occurred',
    metadata: ErrorMetadata = {}
  ) {
    super(message, 'NETWORK_ERROR', 503, metadata)
    this.name = 'NetworkError'
  }
}

/**
 * Ошибка сервиса (недоступен)
 */
export class ServiceUnavailableError extends GigaChatError {
  constructor(
    message: string = 'Service is temporarily unavailable',
    metadata: ErrorMetadata = {}
  ) {
    super(message, 'SERVICE_UNAVAILABLE', 503, metadata)
    this.name = 'ServiceUnavailableError'
  }
}

/**
 * Ошибка валидации входных данных
 */
export class ValidationError extends GigaChatError {
  constructor(
    message: string = 'Validation failed',
    details: Record<string, any> = {},
    metadata: ErrorMetadata = {}
  ) {
    super(message, 'VALIDATION_ERROR', 400, {
      ...metadata,
      details
    })
    this.name = 'ValidationError'
  }
}

/**
 * Ошибка превышения размера запроса
 */
export class RequestTooLargeError extends GigaChatError {
  constructor(
    message: string = 'Request too large',
    maxSize?: number,
    metadata: ErrorMetadata = {}
  ) {
    const fullMessage = maxSize 
      ? `${message}. Maximum size: ${maxSize} bytes`
      : message

    super(fullMessage, 'REQUEST_TOO_LARGE', 413, metadata)
    this.name = 'RequestTooLargeError'
  }
}

/**
 * Ошибка таймаута
 */
export class TimeoutError extends GigaChatError {
  constructor(
    message: string = 'Request timeout',
    timeoutMs?: number,
    metadata: ErrorMetadata = {}
  ) {
    const fullMessage = timeoutMs
      ? `${message}. Timeout: ${timeoutMs}ms`
      : message

    super(fullMessage, 'TIMEOUT_ERROR', 408, metadata)
    this.name = 'TimeoutError'
  }
}

/**
 * Вспомогательные функции для работы с ошибками
 */
export const ErrorUtils = {
  /**
   * Проверка, является ли ошибка восстановимой (можно повторить запрос)
   */
  isRetryable(error: GigaChatError): boolean {
    const retryableCodes = [
      'NETWORK_ERROR',
      'SERVICE_UNAVAILABLE',
      'RATE_LIMIT_ERROR',
      'TIMEOUT_ERROR'
    ]

    const retryableStatuses = [408, 429, 500, 502, 503, 504]

    return retryableCodes.includes(error.code) || 
           retryableStatuses.includes(error.status)
  },

  /**
   * Получение рекомендуемой задержки перед повторной попыткой (в ms)
   */
  getRetryDelay(error: GigaChatError, attempt: number): number {
    if (error instanceof RateLimitError) {
      return error.getRetryDelay()
    }

    // Экспоненциальная backoff стратегия
    const baseDelay = 1000 // 1 секунда
    const maxDelay = 30000 // 30 секунд
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)

    // Добавляем случайность чтобы избежать синхронизации
    const jitter = Math.random() * 1000

    return delay + jitter
  },

  /**
   * Логирование ошибки с контекстом
   */
  logError(error: GigaChatError, context: Record<string, any> = {}): void {
    const logData = {
      error: error.toJSON(),
      context,
      timestamp: new Date().toISOString()
    }

    if (error.status >= 500) {
      console.error('🚨 GigaChat Server Error:', logData)
    } else if (error.status >= 400) {
      console.warn('⚠️ GigaChat Client Error:', logData)
    } else {
      console.log('ℹ️ GigaChat Error:', logData)
    }
  },

  /**
   * Создание пользовательского сообщения об ошибке
   */
  getUserFriendlyMessage(error: GigaChatError): string {
    const messages: Record<string, string> = {
      'AUTH_ERROR': 'Ошибка авторизации. Проверьте настройки API.',
      'RATE_LIMIT_ERROR': 'Превышен лимит запросов. Попробуйте позже.',
      'NETWORK_ERROR': 'Ошибка сети. Проверьте подключение к интернету.',
      'SERVICE_UNAVAILABLE': 'Сервис временно недоступен. Попробуйте позже.',
      'VALIDATION_ERROR': 'Неверный формат запроса.',
      'REQUEST_TOO_LARGE': 'Слишком большой запрос.',
      'TIMEOUT_ERROR': 'Превышено время ожидания ответа.',
      'UNKNOWN_ERROR': 'Произошла неизвестная ошибка.'
    }

    return messages[error.code] || error.message
  }
}