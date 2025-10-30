/**
 * Типы данных для чат-приложения и GigaChat API
 */

// Статусы сообщений
export type MessageStatus = 'sending' | 'sent' | 'error' | 'streaming'
export type MessageRole = 'user' | 'assistant' | 'system'
export type FeedbackType = 'like' | 'dislike'

// Типы моделей GigaChat
export type GigaChatModel = 'GigaChat' | 'GigaChat-Plus' | 'GigaChat-Pro'

// Настройки чата
export interface ChatSettings {
  autoSpeech?: boolean
  model?: GigaChatModel
  temperature?: number
  maxTokens?: number
  stream?: boolean
  topP?: number
}

// Обратная связь для сессии
export interface SessionFeedback {
  likes: number
  dislikes: number
  lastFeedbackAt?: Date
}

// Сообщение чата
export interface Message {
  id: string
  content: string
  role: MessageRole
  timestamp: Date
  status?: MessageStatus
  feedback?: FeedbackType
  edited?: boolean
  updatedAt?: Date
  error?: string
  tokens?: number
  // Метаданные для аналитики
  metadata?: {
    responseTime?: number
    model?: string
    temperature?: number
  }
}

// Сессия чата
export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  feedback?: SessionFeedback
  settings?: ChatSettings
  // Метаданные сессии
  metadata?: {
    totalTokens?: number
    averageResponseTime?: number
    language?: string
    category?: string
  }
}

// Статистика сессии
export interface SessionStats {
  // Основная статистика
  userMessages: number
  assistantMessages: number
  totalMessages: number
  totalTokens: number
  likes: number
  dislikes: number
  satisfactionRate: number
  
  // Дополнительная аналитика
  averageMessageLength: number
  averageResponseTime?: number
  mostActiveHour?: number
  sessionDuration?: number
  messagesPerMinute?: number
  
  // Качество взаимодействия
  errorRate: number
  editedMessages: number
  feedbackRate: number
}

// Ответ GigaChat API
export interface GigaChatResponse {
  choices: Array<{
    index: number
    message: {
      role: MessageRole
      content: string
    }
    finish_reason?: string
  }>
  created: number
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  object: 'chat.completion'
}

// Ответ GigaChat API для streaming
export interface GigaChatStreamResponse {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: MessageRole
      content?: string
    }
    finish_reason?: string
  }>
}

// Ошибка API
export interface ApiError {
  error: string
  code?: string
  status?: number
  details?: Record<string, any>
  timestamp?: string
  requestId?: string
}

// Состояние загрузки
export interface LoadingState {
  isLoading: boolean
  progress?: number
  stage?: 'sending' | 'processing' | 'receiving'
}

// Параметры запроса к API
export interface ChatRequestOptions {
  temperature?: number
  maxTokens?: number
  stream?: boolean
  model?: GigaChatModel
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

// Результат отправки сообщения
export interface SendMessageResult {
  success: boolean
  message?: Message
  error?: ApiError
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  responseTime?: number
}

// События чата для аналитики
export interface ChatEvent {
  type: 'message_sent' | 'message_received' | 'feedback_given' | 'session_created' | 'session_exported'
  sessionId: string
  messageId?: string
  timestamp: Date
  data?: Record<string, any>
}

// Фильтры и поиск
export interface SessionFilters {
  search?: string
  dateRange?: {
    from: Date
    to: Date
  }
  hasFeedback?: boolean
  minMessages?: number
  tags?: string[]
}

// Пагинация
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: 'createdAt' | 'updatedAt' | 'messageCount'
  sortOrder?: 'asc' | 'desc'
}

// Импорт/экспорт данных
export interface ExportData {
  version: string
  exportedAt: string
  sessions: ChatSession[]
  settings?: {
    appVersion: string
    exportFormat: 'json' | 'csv'
  }
}

// Валидационные ошибки
export interface ValidationError {
  field: string
  message: string
  value?: any
}

// Вспомогательные типы для TypeScript
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>

// Типы для создания новых объектов (без id и timestamp)
export type NewMessage = PartialBy<Omit<Message, 'id' | 'timestamp' | 'updatedAt'>, 'status'>
export type NewChatSession = PartialBy<Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>, 'messages' | 'feedback' | 'settings'>

// Типы для обновления объектов (только изменяемые поля)
export type MessageUpdate = Partial<Pick<Message, 'content' | 'status' | 'feedback' | 'edited' | 'updatedAt'>>
export type SessionUpdate = Partial<Pick<ChatSession, 'title' | 'settings' | 'updatedAt'>>

// Константы для валидации
export const MESSAGE_CONSTRAINTS = {
  MAX_CONTENT_LENGTH: 4000,
  MIN_CONTENT_LENGTH: 1,
  MAX_TITLE_LENGTH: 100
} as const

export const API_CONSTRAINTS = {
  MAX_TEMPERATURE: 2,
  MIN_TEMPERATURE: 0,
  MAX_TOKENS: 4096,
  MIN_TOKENS: 1
} as const

// Вспомогательные функции для типов
export const TypeGuards = {
  isMessageRole(role: string): role is MessageRole {
    return ['user', 'assistant', 'system'].includes(role)
  },

  isMessageStatus(status: string): status is MessageStatus {
    return ['sending', 'sent', 'error', 'streaming'].includes(status)
  },

  isFeedbackType(feedback: string): feedback is FeedbackType {
    return ['like', 'dislike'].includes(feedback)
  },

  isValidMessage(message: any): message is Message {
    return (
      typeof message === 'object' &&
      typeof message.id === 'string' &&
      typeof message.content === 'string' &&
      this.isMessageRole(message.role) &&
      message.timestamp instanceof Date
    )
  },

  isValidChatSession(session: any): session is ChatSession {
    return (
      typeof session === 'object' &&
      typeof session.id === 'string' &&
      typeof session.title === 'string' &&
      Array.isArray(session.messages) &&
      session.messages.every((msg: any) => this.isValidMessage(msg)) &&
      session.createdAt instanceof Date &&
      session.updatedAt instanceof Date
    )
  }
}

// Утилиты для работы с типами
export const TypeUtils = {
  createMessage(partial: NewMessage): Message {
    const now = new Date()
    return {
      id: partial.id || `msg-${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
      content: partial.content || '',
      role: partial.role || 'user',
      timestamp: now,
      status: partial.status || 'sent',
      ...partial
    }
  },

  createChatSession(partial: NewChatSession): ChatSession {
    const now = new Date()
    return {
      id: partial.id || `session-${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
      title: partial.title || 'Новый чат',
      messages: partial.messages || [],
      createdAt: now,
      updatedAt: now,
      feedback: partial.feedback || { likes: 0, dislikes: 0 },
      settings: partial.settings,
      ...partial
    }
  }

// Экспорт всех типов
export type {
  MessageStatus,
  MessageRole,
  FeedbackType,
  GigaChatModel,
  ChatSettings,
  SessionFeedback,
  Message,
  ChatSession,
  SessionStats,
  GigaChatResponse,
  GigaChatStreamResponse,
  ApiError,
  LoadingState,
  ChatRequestOptions,
  SendMessageResult,
  ChatEvent,
  SessionFilters,
  PaginationParams,
  ExportData,
  ValidationError,
  NewMessage,
  NewChatSession,
  MessageUpdate,
  SessionUpdate
}