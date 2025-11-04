import { Message } from '@/lib/types'
import { 
  Check, 
  Clock, 
  AlertCircle, 
  Copy, 
  CheckCheck, 
  Edit3,
  Volume2,
  VolumeX,
  Bug
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { useSaluteSpeech } from '@/hooks/useSaluteSpeech'

interface ChatMessageProps {
  message: Message
  onEdit?: (messageId: string, newContent: string) => void
  isMobile?: boolean
  autoSpeech?: boolean
}

export const ChatMessage = memo(function ChatMessage({ 
  message, 
  onEdit, 
  isMobile = false, 
  autoSpeech = false 
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [showDebug, setShowDebug] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { 
    isSpeaking, 
    isReady, 
    speak, 
    stop, 
    error,
    debugLog
  } = useSaluteSpeech()

  // Автоматическое озвучивание AI сообщений
  useEffect(() => {
    if (autoSpeech && message.role === 'assistant' && !isSpeaking && isReady) {
      const timer = setTimeout(() => {
        console.log('Auto-speech triggered for:', message.content.substring(0, 50))
        speak(message.content)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, []) // Убраны зависимости чтобы избежать повторных вызовов

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEditing, editedContent])

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Ошибка копирования:', err)
    }
  }, [message.content])

  const toggleSpeech = useCallback(async () => {
    console.log('Toggle speech clicked, isSpeaking:', isSpeaking, 'isReady:', isReady)
    try {
      if (isSpeaking) {
        stop()
      } else {
        await speak(message.content)
      }
    } catch (err) {
      console.error('Ошибка озвучивания:', err)
    }
  }, [isSpeaking, isReady, stop, speak, message.content])

  const handleEdit = useCallback(() => {
    if (isEditing && editedContent !== message.content) {
      onEdit?.(message.id, editedContent)
    }
    setIsEditing(!isEditing)
  }, [isEditing, editedContent, message.content, message.id, onEdit])

  const cancelEdit = useCallback(() => {
    setEditedContent(message.content)
    setIsEditing(false)
  }, [message.content])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelEdit()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleEdit()
    }
  }, [cancelEdit, handleEdit])

  const getStatusIcon = useCallback(() => {
    switch (message.status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-yellow-500 animate-pulse" />
      case 'sent':
        return <Check className="w-3 h-3 text-green-500" />
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />
      default:
        return null
    }
  }, [message.status])

  const formatTimestamp = useCallback((timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  const recentDebugLog = useMemo(() => 
    debugLog.slice(-5), 
    [debugLog]
  )

  const canSpeak = useMemo(() => 
    message.content.trim().length > 0, 
    [message.content]
  )

  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 px-4`}>
      {/* Аватар для AI */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
        </div>
      )}
      
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-blue-500 text-white rounded-br-md'
          : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
      }`}>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-white border border-gray-300 rounded-lg p-2 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={3}
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleEdit}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
              >
                Сохранить
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content}
            </div>
            
            <div className={`flex items-center justify-between mt-2 text-xs ${
              isUser ? 'text-blue-100' : 'text-gray-500'
            }`}>
              <div className="flex items-center space-x-2">
                <span>{formatTimestamp(message.timestamp)}</span>
                {getStatusIcon()}
              </div>
              
              <div className="flex items-center space-x-1">
                {!isUser && (
                  <>
                    {!isReady && !isSpeaking ? (
                      <div className="p-1" title="Система речи загружается">
                        <Clock className="w-3 h-3 animate-spin" />
                      </div>
                    ) : (
                      <button
                        onClick={toggleSpeech}
                        className="p-1 hover:bg-white/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isSpeaking ? "Остановить" : "Озвучить"}
                        disabled={!isReady || !canSpeak}
                        aria-label={isSpeaking ? "Остановить воспроизведение" : "Озвучить сообщение"}
                        aria-live="polite"
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-3 h-3" />
                        ) : (
                          <Volume2 className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => setShowDebug(!showDebug)}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                      title="Отладка"
                      aria-label="Показать отладочную информацию"
                    >
                      <Bug className="w-3 h-3" />
                    </button>
                  </>
                )}

                <button
                  onClick={copyToClipboard}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Копировать"
                  aria-label="Копировать сообщение"
                >
                  {copied ? (
                    <CheckCheck className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>

                {isUser && onEdit && (
                  <button
                    onClick={handleEdit}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Редактировать"
                    aria-label="Редактировать сообщение"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Отладочная информация */}
            {showDebug && !isUser && (
              <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
                <div className="font-mono">
                  <div>Готов: {isReady ? '✅' : '❌'}</div>
                  <div>Озвучка: {isSpeaking ? '▶️' : '⏸️'}</div>
                  <div>Может говорить: {canSpeak ? '✅' : '❌'}</div>
                  {error && <div className="text-red-600">Ошибка: {error}</div>}
                  <div className="mt-1 max-h-20 overflow-y-auto">
                    {recentDebugLog.map((log, i) => (
                      <div key={i} className="text-gray-600">{log}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Аватар для пользователя */}
      {isUser && (
        <div className="flex-shrink-0 ml-3">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
            Я
          </div>
        </div>
      )}
    </div>
  )
})