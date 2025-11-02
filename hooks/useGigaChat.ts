import { useState, useCallback, useRef } from 'react'
import { Message, ChatSession } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

// Константы
const STORAGE_KEY = 'gigachat-sessions'
const MAX_SESSIONS = 50
const MAX_MESSAGE_LENGTH = 4000

function createNewSession(title: string = 'Новый чат'): ChatSession {
  return {
    id: uuidv4(),
    title,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    feedback: {
      likes: 0,
      dislikes: 0
    }
  }
}

function generateSessionTitle(message: string): string {
  const cleanMessage = message.trim().slice(0, 100)
  if (cleanMessage.length <= 50) return cleanMessage
  return cleanMessage.slice(0, 47) + '...'
}

export function useGigaChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Загрузка сессий из localStorage
  const initialize = useCallback(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsedSessions = JSON.parse(saved, (key, value) => {
            if (key.endsWith('At') || key === 'timestamp') {
              return new Date(value)
            }
            return value
          }) as ChatSession[]
          
          const validSessions = parsedSessions.filter(session => 
            session && session.id && session.title && Array.isArray(session.messages)
          )
          
          setSessions(validSessions.length > 0 ? validSessions : [createNewSession()])
          if (validSessions.length > 0) {
            setCurrentSessionId(validSessions[0].id)
          }
        } else {
          const newSession = createNewSession()
          setSessions([newSession])
          setCurrentSessionId(newSession.id)
        }
      } catch (error) {
        console.error('Ошибка загрузки сессий:', error)
        const newSession = createNewSession()
        setSessions([newSession])
        setCurrentSessionId(newSession.id)
      } finally {
        setIsInitialized(true)
      }
    }
  }, [isInitialized])

  // Сохранение сессий в localStorage
  const saveSessions = useCallback(() => {
    if (typeof window !== 'undefined' && isInitialized && sessions.length > 0) {
      try {
        const sessionsToSave = sessions.slice(0, MAX_SESSIONS)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToSave))
      } catch (error) {
        console.error('Ошибка сохранения сессий:', error)
      }
    }
  }, [sessions, isInitialized])

  const currentSession = sessions.find(session => session.id === currentSessionId) || sessions[0]

  const createNewChat = useCallback((title?: string) => {
    const newSession = createNewSession(title)
    setSessions(prev => [newSession, ...prev.slice(0, MAX_SESSIONS - 1)])
    setCurrentSessionId(newSession.id)
    return newSession.id
  }, [])

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const filtered = prev.filter(session => session.id !== sessionId)
      if (filtered.length === 0) {
        const newSession = createNewSession()
        setCurrentSessionId(newSession.id)
        return [newSession]
      }
      if (sessionId === currentSessionId) {
        setCurrentSessionId(filtered[0].id)
      }
      return filtered
    })
  }, [currentSessionId])

  const sendMessage = useCallback(async (content: string, options?: {
    temperature?: number
  }) => {
    if (!content.trim() || isLoading || content.length > MAX_MESSAGE_LENGTH) return

    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const userMessage: Message = {
      id: uuidv4(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
      status: 'sending' as const
    }

    // Обновляем сессию
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId 
        ? {
            ...session,
            messages: [...session.messages, userMessage],
            updatedAt: new Date(),
            title: session.messages.length === 0 ? generateSessionTitle(content) : session.title
          }
        : session
    ))

    setIsLoading(true)
    abortControllerRef.current = new AbortController()

    try {
      // ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЙ ENDPOINT
      const response = await fetch('/api/gigachat-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          message: content,
          temperature: Math.max(0, Math.min(2, options?.temperature || 0.7))
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: uuidv4(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
        status: 'sent' as const
      }

      setSessions(prev => prev.map(session => 
        session.id === currentSessionId 
          ? {
              ...session,
              messages: [
                ...session.messages.map(msg => 
                  msg.id === userMessage.id 
                    ? { ...msg, status: 'sent' as const }
                    : msg
                ), 
                assistantMessage
              ],
              updatedAt: new Date()
            }
          : session
      ))

      return data.response

    } catch (error) {
      // Игнорируем ошибки отмены
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      console.error('Ошибка отправки сообщения:', error)
      
      const errorMessage: Message = {
        id: uuidv4(),
        content: error instanceof Error ? error.message : 'Извините, произошла ошибка.',
        role: 'assistant',
        timestamp: new Date(),
        status: 'error' as const
      }

      setSessions(prev => prev.map(session => 
        session.id === currentSessionId 
          ? {
              ...session,
              messages: [
                ...session.messages.map(msg => 
                  msg.id === userMessage.id 
                    ? { ...msg, status: 'error' as const }
                    : msg
                ), 
                errorMessage
              ],
              updatedAt: new Date()
            }
          : session
      ))
      
      throw error
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [currentSessionId, isLoading])

  const clearMessages = useCallback(() => {
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId 
        ? { 
            ...session, 
            messages: [], 
            updatedAt: new Date(),
            feedback: { likes: 0, dislikes: 0 }
          }
        : session
    ))
  }, [currentSessionId])

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
  }, [])

  // Инициализация при монтировании
  useState(() => {
    initialize()
  })

  // Автосохранение
  useState(() => {
    saveSessions()
  })

  return {
    // Состояние
    sessions,
    currentSession,
    isLoading,
    isInitialized,
    
    // Действия
    createNewChat,
    deleteSession,
    sendMessage,
    clearMessages,
    setCurrentSessionId,
    cancelRequest
  }
}