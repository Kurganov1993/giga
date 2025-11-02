import { useState, useCallback, useRef, useEffect } from 'react'
import { Message, ChatSession } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

// Константы
const STORAGE_KEY = 'chat-sessions'
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

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Загрузка сессий из localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
        localStorage.removeItem(STORAGE_KEY)
      } finally {
        setIsInitialized(true)
      }
    }
  }, [])

  // Сохранение сессий в localStorage
  useEffect(() => {
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

  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    const trimmedTitle = title.trim() || 'Без названия'
    if (trimmedTitle.length > 100) return
    
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, title: trimmedTitle, updatedAt: new Date() }
        : session
    ))
  }, [])

  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (!newContent.trim() || newContent.length > MAX_MESSAGE_LENGTH) return
    
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId 
        ? {
            ...session,
            messages: session.messages.map(msg => 
              msg.id === messageId 
                ? { ...msg, content: newContent.trim(), edited: true, updatedAt: new Date() }
                : msg
            ),
            updatedAt: new Date()
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

  const sendMessage = useCallback(async (content: string, options?: {
  temperature?: number
  streaming?: boolean
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
    // ИСПОЛЬЗУЕМ НОВЫЙ PROXY ENDPOINT
    const response = await fetch('/api/gigachat-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  const exportSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return false

    try {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        session: {
          ...session,
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          }))
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chat-${session.title}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      return true
    } catch (error) {
      console.error('Ошибка экспорта:', error)
      return false
    }
  }, [sessions])

  const importSession = useCallback((file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          if (!content) throw new Error('Файл пуст')

          const importedData = JSON.parse(content)
          if (!importedData.session || !Array.isArray(importedData.session.messages)) {
            throw new Error('Неверный формат файла')
          }

          const importedSession: ChatSession = {
            ...importedData.session,
            id: uuidv4(),
            messages: importedData.session.messages.map((msg: any) => ({
              id: msg.id || uuidv4(),
              content: msg.content || '',
              role: msg.role || 'user',
              timestamp: new Date(msg.timestamp || Date.now()),
              status: 'sent' as const,
              feedback: msg.feedback
            })),
            createdAt: new Date(importedData.session.createdAt || Date.now()),
            updatedAt: new Date(),
            feedback: importedData.session.feedback || { likes: 0, dislikes: 0 },
            title: importedData.session.title || 'Импортированный чат'
          }

          setSessions(prev => [importedSession, ...prev])
          setCurrentSessionId(importedSession.id)
          resolve(true)
          
        } catch (error) {
          console.error('Ошибка импорта:', error)
          resolve(false)
        }
      }
      
      reader.onerror = () => resolve(false)
      reader.readAsText(file)
    })
  }, [])

  const getSessionStats = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return null

    const userMessages = session.messages.filter(m => m.role === 'user').length
    const assistantMessages = session.messages.filter(m => m.role === 'assistant').length
    const totalMessages = userMessages + assistantMessages

    return {
      userMessages,
      assistantMessages,
      totalMessages,
      totalTokens: 0,
      likes: 0,
      dislikes: 0,
      satisfactionRate: 0
    }
  }, [sessions])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    // Состояние
    sessions,
    currentSession,
    isLoading,
    isInitialized,
    
    // Действия
    createNewChat,
    deleteSession,
    updateSessionTitle,
    sendMessage,
    clearMessages,
    setCurrentSessionId,
    editMessage,
    exportSession,
    importSession,
    getSessionStats,
    cancelRequest
  }
}