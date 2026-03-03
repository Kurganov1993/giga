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
  Bug,
  Mic,
  MicOff,
  Save,
  X
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { useSaluteSpeech } from '@/hooks/useSaluteSpeech'

interface ChatMessageProps {
  message: Message
  onEdit?: (messageId: string, newContent: string) => void
  isMobile?: boolean
  autoSpeech?: boolean
  onSpeechToText?: (text: string) => void
}

// Declare Speech Recognition types
declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

export const ChatMessage = memo(function ChatMessage({ 
  message, 
  onEdit, 
  isMobile = false, 
  autoSpeech = false,
  onSpeechToText 
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [showDebug, setShowDebug] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [interimText, setInterimText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  
  const { 
    isSpeaking, 
    isReady, 
    speak, 
    stop, 
    error,
    debugLog
  } = useSaluteSpeech()

  // Initialize speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.warn('Браузер не поддерживает распознавание речи')
      setSpeechError('Ваш браузер не поддерживает голосовой ввод')
      return
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      
      // Настройки распознавания
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'ru-RU'
      recognitionRef.current.maxAlternatives = 1

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        // Обновляем промежуточный текст
        if (interimTranscript) {
          setInterimText(interimTranscript)
        }

        // Добавляем финальный распознанный текст
        if (finalTranscript) {
          setEditedContent(prev => {
            const newContent = prev + finalTranscript
            // Вызываем callback если передан
            if (onSpeechToText) {
              onSpeechToText(newContent)
            }
            return newContent
          })
          setInterimText('') // Сбрасываем промежуточный текст
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Ошибка распознавания речи:', event.error)
        let errorMessage = 'Ошибка распознавания речи'
        
        switch (event.error) {
          case 'not-allowed':
          case 'permission-denied':
            errorMessage = 'Разрешите доступ к микрофону'
            break
          case 'network':
            errorMessage = 'Проблемы с сетью'
            break
          case 'audio-capture':
            errorMessage = 'Микрофон не найден'
            break
          default:
            errorMessage = `Ошибка: ${event.error}`
        }
        
        setSpeechError(errorMessage)
        setIsListening(false)
        setInterimText('')
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
        setInterimText('')
      }

      recognitionRef.current.onstart = () => {
        setSpeechError(null)
        setInterimText('')
        console.log('Распознавание речи начато')
      }

    } catch (error) {
      console.error('Ошибка инициализации распознавания речи:', error)
      setSpeechError('Не удалось инициализировать распознавание речи')
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Игнорируем ошибки при остановке
        }
      }
    }
  }, [onSpeechToText])

  // Автоматическое озвучивание AI сообщений
  useEffect(() => {
    if (autoSpeech && message.role === 'assistant' && !isSpeaking && isReady) {
      const timer = setTimeout(() => {
        console.log('Auto-speech triggered for:', message.content.substring(0, 50))
        speak(message.content)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [autoSpeech, message.role, message.content, isSpeaking, isReady, speak])

  // Автофокус и настройка высоты textarea при редактировании
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      textareaRef.current.focus()
    }
  }, [isEditing, editedContent])

  // Функции для управления распознаванием речи
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setSpeechError('Распознавание речи не поддерживается вашим браузером')
      return
    }

    try {
      setSpeechError(null)
      setInterimText('')
      recognitionRef.current.start()
      setIsListening(true)
    } catch (err) {
      console.error('Ошибка запуска распознавания:', err)
      setSpeechError('Не удалось начать запись. Проверьте доступ к микрофону.')
      setIsListening(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.error('Ошибка остановки распознавания:', err)
      }
    }
    setIsListening(false)
    setInterimText('')
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Функции для управления текстом и редактированием
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
    if (isEditing) {
      // Сохраняем изменения
      if (editedContent !== message.content) {
        onEdit?.(message.id, editedContent)
      }
      setIsEditing(false)
      stopListening() // Останавливаем запись при сохранении
    } else {
      // Начинаем редактирование
      setIsEditing(true)
      setEditedContent(message.content)
    }
  }, [isEditing, editedContent, message.content, message.id, onEdit, stopListening])

  const cancelEdit = useCallback(() => {
    setEditedContent(message.content)
    setIsEditing(false)
    stopListening() // Останавливаем запись при отмене
    setSpeechError(null)
    setInterimText('')
  }, [message.content, stopListening])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelEdit()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleEdit()
    }
  }, [cancelEdit, handleEdit])

  const clearText = useCallback(() => {
    setEditedContent('')
    setInterimText('')
  }, [])

  // Вспомогательные функции
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

  const hasSpeechRecognition = useMemo(() => 
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    []
  )

  const displayText = useMemo(() => {
    if (!isEditing) return message.content
    return editedContent + (interimText ? ` ${interimText}` : '')
  }, [isEditing, message.content, editedContent, interimText])

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
          <div className="space-y-3">
            {/* Поле ввода текста с поддержкой голосового ввода */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border border-gray-300 rounded-lg p-3 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[100px]"
                rows={3}
                autoFocus
                placeholder="Введите текст или нажмите микрофон для голосового ввода..."
              />
              
              {/* Кнопка очистки текста */}
              {editedContent && (
                <button
                  onClick={clearText}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Очистить текст"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Индикатор записи и промежуточный текст */}
            <div className="space-y-2">
              {isListening && (
                <div className="flex items-center space-x-2 text-sm text-red-500 animate-pulse">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Запись... Говорите сейчас</span>
                </div>
              )}
              
              {interimText && (
                <div className="text-sm text-gray-500 italic bg-gray-50 p-2 rounded border">
                  <span className="font-medium">Распознается:</span> {interimText}
                </div>
              )}
            </div>

            {/* Сообщения об ошибках */}
            {speechError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {speechError}
              </div>
            )}

            {/* Панель управления редактированием */}
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex space-x-2">
                <button
                  onClick={handleEdit}
                  disabled={!editedContent.trim()}
                  className="flex items-center px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Сохранить
                </button>
                
                {hasSpeechRecognition && (
                  <button
                    onClick={toggleListening}
                    className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                      isListening 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                    title={isListening ? "Остановить запись" : "Начать голосовой ввод"}
                  >
                    {isListening ? (
                      <MicOff className="w-4 h-4 mr-1" />
                    ) : (
                      <Mic className="w-4 h-4 mr-1" />
                    )}
                    {isListening ? 'Стоп запись' : 'Голосовой ввод'}
                  </button>
                )}
              </div>
              
              <button
                onClick={cancelEdit}
                className="flex items-center px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4 mr-1" />
                Отмена
              </button>
            </div>

            {/* Подсказка по горячим клавишам */}
            <div className="text-xs text-gray-500 text-center">
              💡 <strong>Ctrl+Enter</strong> - сохранить, <strong>Esc</strong> - отменить
            </div>
          </div>
        ) : (
          <>
            {/* Отображение обычного сообщения */}
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