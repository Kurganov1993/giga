interface Config {
  gigachat: {
    clientId: string
    clientSecret: string
    authUrl: string
    apiUrl: string
    timeout: number
    maxTokens: number
    temperature: {
      min: number
      max: number
      default: number
    }
  }
  app: {
    isProduction: boolean
    apiTimeout: number
    maxMessageLength: number
    maxSessions: number
    version: string
  }
  features: {
    enableStreaming: boolean
    enableSpeech: boolean
    enableExport: boolean
    enableFeedback: boolean
  }
}

// Валидация переменных окружения
function validateEnvironment(): void {
  const required = ['GIGACHAT_CLIENT_ID', 'GIGACHAT_CLIENT_SECRET']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Предупреждение для дефолтных значений (если они используются)
  const defaultClientId = '9b551490-5bc0-441f-892b-ad2e93fe491e'
  const defaultClientSecret = '7739daa8-f3c4-43d1-a372-69b8542b0071'
  
  if (process.env.GIGACHAT_CLIENT_ID === defaultClientId || 
      process.env.GIGACHAT_CLIENT_SECRET === defaultClientSecret) {
    console.warn('⚠️  Using default GigaChat credentials. Please configure your own credentials in production.')
  }

  // Валидация значений
  const clientId = process.env.GIGACHAT_CLIENT_ID!
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET!

  if (clientId.length < 10 || clientSecret.length < 10) {
    throw new Error('GigaChat credentials appear to be invalid')
  }
}

// Получение версии приложения
function getAppVersion(): string {
  return process.env.npm_package_version || '1.0.0'
}

// Проверяем переменные окружения при инициализации
validateEnvironment()

export const config: Config = {
  gigachat: {
    clientId: process.env.GIGACHAT_CLIENT_ID!,
    clientSecret: process.env.GIGACHAT_CLIENT_SECRET!,
    authUrl: process.env.GIGACHAT_AUTH_URL || 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    apiUrl: process.env.GIGACHAT_API_URL || 'https://gigachat.devices.sberbank.ru/api/v1',
    timeout: parseInt(process.env.GIGACHAT_TIMEOUT || '30000'),
    maxTokens: parseInt(process.env.GIGACHAT_MAX_TOKENS || '1024'),
    temperature: {
      min: 0,
      max: 2,
      default: 0.7
    }
  },
  app: {
    isProduction: process.env.NODE_ENV === 'production',
    apiTimeout: parseInt(process.env.API_TIMEOUT || '30000'),
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '4000'),
    maxSessions: parseInt(process.env.MAX_SESSIONS || '50'),
    version: getAppVersion()
  },
  features: {
    enableStreaming: process.env.ENABLE_STREAMING !== 'false', // Включено по умолчанию
    enableSpeech: process.env.ENABLE_SPEECH === 'true',
    enableExport: process.env.ENABLE_EXPORT !== 'false', // Включено по умолчанию
    enableFeedback: process.env.ENABLE_FEEDBACK !== 'false' // Включено по умолчанию
  }
}

// Валидация числовых значений
function validateConfig(): void {
  const validations = [
    { value: config.gigachat.timeout, min: 1000, max: 120000, name: 'GigaChat timeout' },
    { value: config.gigachat.maxTokens, min: 1, max: 4096, name: 'Max tokens' },
    { value: config.app.apiTimeout, min: 1000, max: 120000, name: 'API timeout' },
    { value: config.app.maxMessageLength, min: 1, max: 10000, name: 'Max message length' },
    { value: config.app.maxSessions, min: 1, max: 1000, name: 'Max sessions' }
  ]

  for (const { value, min, max, name } of validations) {
    if (value < min || value > max) {
      throw new Error(`${name} must be between ${min} and ${max}`)
    }
  }

  // Валидация URL
  try {
    new URL(config.gigachat.authUrl)
    new URL(config.gigachat.apiUrl)
  } catch {
    throw new Error('Invalid GigaChat API URLs configured')
  }
}

// Выполняем валидацию
validateConfig()

// Вспомогательные функции для работы с конфигом
export const configHelpers = {
  // Проверка доступности фич
  isFeatureEnabled(feature: keyof Config['features']): boolean {
    return config.features[feature]
  },

  // Получение безопасной версии конфига для логирования (без секретов)
  getSafeConfig(): Omit<Config, 'gigachat'> & { gigachat: Omit<Config['gigachat'], 'clientId' | 'clientSecret'> } {
    return {
      ...config,
      gigachat: {
        authUrl: config.gigachat.authUrl,
        apiUrl: config.gigachat.apiUrl,
        timeout: config.gigachat.timeout,
        maxTokens: config.gigachat.maxTokens,
        temperature: config.gigachat.temperature
      }
    }
  },

  // Валидация температуры
  validateTemperature(temp: number): number {
    return Math.max(config.gigachat.temperature.min, 
                   Math.min(config.gigachat.temperature.max, temp))
  },

  // Проверка длины сообщения
  validateMessageLength(message: string): boolean {
    return message.length <= config.app.maxMessageLength
  }
}

// Типы для экспорта
export type { Config }
export type FeatureFlag = keyof Config['features']

// Development-only debug info
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 App Configuration:', configHelpers.getSafeConfig())
}