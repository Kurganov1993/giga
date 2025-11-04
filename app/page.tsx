'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useGigaChat } from '@/hooks/useGigaChat'
import { useSaluteSpeech } from '@/hooks/useSaluteSpeech'
import { 
  Plus, 
  Trash2, 
  Send, 
  Menu, 
  MessageCircle,
  Clock,
  Settings,
  Download,
  Upload,
  X,
  Search,
  BarChart3,
  Volume2,
  VolumeX,
  Zap,
  Crown,
  Mic,
  MicOff
} from 'lucide-react'
import { ChatMessage } from './components/ChatMessage'
import { LoadingDots } from './components/LoadingDots'

// Константы
const MAX_INPUT_LENGTH = 4000
const TEXTAREA_MAX_HEIGHT = 200
const DEBOUNCE_DELAY = 300
const MAX_DISPLAY_SESSIONS = 50

// Типы
interface QuickPrompt {
  text: string
  category?: string
}

// Быстрые подсказки
const QUICK_PROMPTS: QuickPrompt[] = [
  { text: "Расскажи о возможностях искусственного интеллекта", category: "technology" },
  { text: "Напиши план развития для стартапа", category: "business" },
  { text: "Объясни квантовые вычисления простыми словами", category: "education" },
  { text: "Помоги составить резюме для IT-специалиста", category: "career" },
  { text: "Какие технологии будут актуальны через 5 лет?", category: "future" },
  { text: "Напиши код для простого веб-сервера на Node.js", category: "programming" }
]

// Хук для дебаунса
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [input, setInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [autoSpeech, setAutoSpeech] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [temperature, setTemperature] = useState(0.7)
  const [isImporting, setIsImporting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const {
    sessions,
    currentSession,
    isLoading,
    isInitialized,
    createNewChat,
    deleteSession,
    sendMessage,
    clearMessages,
    setCurrentSessionId,
    editMessage,
    cancelRequest,
    exportSession,
    importSession,
    getSessionStats
  } = useGigaChat()

  const {
    isReady: isSpeechReady,
    isSpeaking,
    availableVoices: speechVoices,
    speak: speakText,
    stop: stopSpeech
  } = useSaluteSpeech()

  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY)

  // Автоматическая прокрутка к новым сообщениям
  const scrollToBottom = useCallback(() => {
    try {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      })
    } catch (error) {
      // Fallback для браузеров которые не поддерживают smooth scroll
      messagesEndRef.current?.scrollIntoView()
    }
  }, [])

  useEffect(() => {
    if (currentSession?.messages?.length) {
      scrollToBottom()
    }
  }, [currentSession?.messages, scrollToBottom])

  // Автоматический размер textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, TEXTAREA_MAX_HEIGHT)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [input])

  // Остановка речи при смене сессии или очистке
  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [currentSession?.id, stopSpeech])

  // Валидация температуры
  const handleTemperatureChange = useCallback((value: number) => {
    const validatedValue = Math.max(0, Math.min(1, value))
    setTemperature(validatedValue)
  }, [])

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return
    
    try {
      await sendMessage(input, {
        temperature,
        streaming: useStreaming
      })
      setInput('')
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error)
      
      // Более специфичные сообщения об ошибках
      let errorMessage = 'Произошла ошибка при отправке сообщения. Попробуйте еще раз.'
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('Network')) {
          errorMessage = 'Ошибка сети. Проверьте подключение к интернету.'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Превышено время ожидания ответа. Попробуйте еще раз.'
        } else if (error.message.includes('authentication') || error.message.includes('401')) {
          errorMessage = 'Ошибка авторизации. Проверьте настройки API.'
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Превышен лимит запросов. Попробуйте через несколько минут.'
        }
      }
      
      alert(errorMessage)
    } finally {
      // Сброс высоты textarea и возврат фокуса
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    }
  }, [input, isLoading, sendMessage, temperature, useStreaming])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleImportSession = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const success = await importSession(file)
      if (success) {
        console.log('Сессия успешно импортирована')
        // Можно добавить toast-уведомление
      } else {
        alert('Ошибка импорта сессии. Проверьте формат файла.')
      }
    } catch (error) {
      console.error('Ошибка импорта:', error)
      alert('Произошла ошибка при импорте файла')
    } finally {
      event.target.value = ''
      setIsImporting(false)
    }
  }, [importSession])

  const formatDate = useCallback((date: Date) => {
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffMinutes = Math.floor(diffTime / (1000 * 60))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffMinutes < 1) return 'только что'
    if (diffMinutes < 60) return `${diffMinutes} мин назад`
    if (diffHours < 24) return `${diffHours} ч назад`
    if (diffDays === 1) return 'вчера'
    if (diffDays <= 7) return `${diffDays} дн назад`
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: diffDays > 365 ? 'long' : 'short',
      year: diffDays > 365 ? 'numeric' : undefined
    })
  }, [])

  // Фильтрация сессий по поиску
  const filteredSessions = useMemo(() => 
    sessions.filter(session =>
      session.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.messages.some(msg => 
        msg.content.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    ),
    [sessions, debouncedSearchTerm]
  )

  // Ограничение отображаемых сессий
  const displaySessions = useMemo(() => 
    filteredSessions.slice(0, MAX_DISPLAY_SESSIONS),
    [filteredSessions]
  )

  const sessionStats = useMemo(() => 
    currentSession ? getSessionStats(currentSession.id) : null,
    [currentSession, getSessionStats]
  )

  const handleQuickPromptClick = useCallback((prompt: string) => {
    setInput(prompt)
    // Задержка для гарантии что textarea обновилась
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }, [])

  const handleDeleteSession = useCallback((sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (window.confirm('Вы уверены, что хотите удалить этот чат?')) {
      deleteSession(sessionId)
    }
  }, [deleteSession])

  const handleSessionKeyPress = useCallback((sessionId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setCurrentSessionId(sessionId)
      setSidebarOpen(false)
    }
  }, [setCurrentSessionId])

  // Остановка речи при закрытии приложения
  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [stopSpeech])

  // Закрытие sidebar при нажатии Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [sidebarOpen])

  // Показываем скелетон пока данные не загрузились
  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex-1 flex flex-col">
          <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4">
            <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse"></div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full animate-pulse mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-48 animate-pulse mx-auto"></div>
              <div className="h-3 bg-gray-200 rounded w-32 animate-pulse mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-white/90 backdrop-blur-sm border-r border-gray-200/50 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200/50">
            <div className="flex space-x-2 mb-3">
              <button
                onClick={() => createNewChat()}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                aria-label="Создать новый чат"
              >
                <Plus className="w-5 h-5" />
                <span>Новый чат</span>
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Импорт чата"
                aria-label="Импорт чата"
              >
                {isImporting ? <LoadingDots /> : <Upload className="w-5 h-5" />}
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportSession}
                accept=".json"
                className="hidden"
                aria-label="Выберите файл для импорта"
              />
            </div>
            
            {/* Поиск */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск чатов..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                aria-label="Поиск чатов"
              />
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              {displaySessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">
                    {searchTerm ? 'Чаты не найдены' : 'Чатов пока нет'}
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                    >
                      Очистить поиск
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {displaySessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer group transition-all duration-200 ${
                        session.id === currentSession?.id
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 shadow-sm'
                          : 'hover:bg-gray-50 border border-transparent hover:border-gray-200'
                      }`}
                      onClick={() => {
                        setCurrentSessionId(session.id)
                        setSidebarOpen(false)
                        stopSpeech() // Останавливаем речь при смене сессии
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => handleSessionKeyPress(session.id, e)}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          session.id === currentSession?.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {session.title || 'Новый чат'}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(session.updatedAt)}</span>
                            {session.messages.length > 0 && (
                              <span>• {session.messages.length} сообщ.</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            exportSession(session.id)
                          }}
                          className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Экспорт чата"
                          aria-label="Экспорт чата"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить чат"
                          aria-label="Удалить чат"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredSessions.length > MAX_DISPLAY_SESSIONS && (
                    <div className="text-center py-2">
                      <p className="text-xs text-gray-500">
                        Показано {MAX_DISPLAY_SESSIONS} из {filteredSessions.length} чатов
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200/50">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Открыть настройки"
              >
                <Settings className="w-4 h-4" />
                <span>Настройки</span>
              </button>
              
              {sessionStats && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <BarChart3 className="w-3 h-3" />
                  <span>{sessionStats.totalMessages} сообщ.</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Powered by <span className="font-semibold text-blue-600">GigaChat AI</span>
              </span>
              <div className="flex items-center space-x-1">
                {isSpeechReady ? (
                  <Mic className="w-3 h-3 text-green-500" />
                ) : (
                  <MicOff className="w-3 h-3 text-gray-400" />
                )}
                <span className={isSpeechReady ? 'text-green-600' : 'text-gray-400'}>
                  SaluteSpeech
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0 min-w-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 truncate max-w-xs lg:max-w-md">
                  {currentSession?.title || 'GigaChat AI'}
                </h1>
                {sessionStats && (
                  <p className="text-sm text-gray-500">
                    {sessionStats.totalMessages} сообщений • 
                    {sessionStats.satisfactionRate > 0 ? ` ${Math.round(sessionStats.satisfactionRate)}% 👍` : ' нет оценок'}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {isSpeaking && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm">
                  <div className="flex space-x-1">
                    <div className="w-1 h-3 bg-blue-500 animate-pulse"></div>
                    <div className="w-1 h-3 bg-blue-500 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-3 bg-blue-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>Озвучка...</span>
                  <button
                    onClick={stopSpeech}
                    className="p-1 hover:bg-blue-200 rounded transition-colors"
                    aria-label="Остановить озвучку"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              {isLoading && (
                <button
                  onClick={cancelRequest}
                  className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center space-x-1"
                  aria-label="Отменить запрос"
                >
                  <X className="w-4 h-4" />
                  <span>Отмена</span>
                </button>
              )}
              
              {currentSession?.messages && currentSession.messages.length > 0 && (
                <>
                  <button
                    onClick={() => exportSession(currentSession.id)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Экспорт чата"
                    aria-label="Экспорт текущего чата"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Вы уверены, что хотите очистить историю сообщений?')) {
                        clearMessages()
                        stopSpeech()
                      }
                    }}
                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                  >
                    Очистить чат
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {!currentSession?.messages || currentSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <Crown className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Добро пожаловать в GigaChat
              </h2>
              <p className="text-lg text-gray-600 max-w-md mb-8">
                Начните общение с искусственным интеллектом. Задавайте вопросы, получайте помощь в решении задач или просто общайтесь на любые темы.
              </p>
              
              {/* Быстрые подсказки */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mb-8">
                {QUICK_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickPromptClick(prompt.text)}
                    className="p-4 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 text-left group"
                    aria-label={`Быстрая подсказка: ${prompt.text}`}
                  >
                    <p className="text-sm text-gray-700 group-hover:text-gray-900 line-clamp-3">
                      {prompt.text}
                    </p>
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Zap className="w-4 h-4 text-green-500" />
                  <span>Быстрые ответы</span>
                </div>
                <div className="flex items-center space-x-1">
                  {isSpeechReady ? (
                    <Volume2 className="w-4 h-4 text-blue-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={isSpeechReady ? 'text-blue-600' : 'text-gray-400'}>
                    SaluteSpeech
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Download className="w-4 h-4 text-purple-500" />
                  <span>Экспорт чатов</span>
                </div>
              </div>

              {!isSpeechReady && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    SaluteSpeech загружается... Озвучка будет доступна через несколько секунд.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto pb-4">
              {currentSession.messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  onEdit={editMessage}
                  autoSpeech={autoSpeech}
                />
              ))}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        

        {/* Input Area */}
        <div className="border-t border-gray-200/50 bg-white/80 backdrop-blur-sm p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex space-x-4">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_INPUT_LENGTH) {
                    setInput(e.target.value)
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder="Введите ваше сообщение..."
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white/50 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
                disabled={isLoading}
                style={{ minHeight: '56px', maxHeight: '200px' }}
                aria-label="Введите сообщение"
                aria-describedby="input-help"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none disabled:cursor-not-allowed self-end flex items-center space-x-2 min-w-[120px] justify-center"
                aria-label="Отправить сообщение"
              >
                {isLoading ? (
                  <LoadingDots />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Отправить</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p id="input-help" className="text-xs text-gray-500">
                Нажмите Enter для отправки, Shift+Enter для новой строки
              </p>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className={input.length > MAX_INPUT_LENGTH * 0.9 ? 'text-orange-500' : ''}>
                  {input.length}/{MAX_INPUT_LENGTH}
                </span>
                <div className="flex items-center space-x-1">
                  {autoSpeech ? (
                    <Volume2 className="w-4 h-4 text-blue-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={autoSpeech ? 'text-blue-600' : 'text-gray-400'}>
                    Авто-озвучка
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Модальное окно настроек */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Настройки чата</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Закрыть настройки"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Streaming ответы</p>
                  <p className="text-sm text-gray-500">Сообщения приходят по частям</p>
                </div>
                <button
                  onClick={() => setUseStreaming(!useStreaming)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useStreaming ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  aria-checked={useStreaming}
                  role="switch"
                  aria-label="Включить streaming ответы"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useStreaming ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Авто-озвучка</p>
                  <p className="text-sm text-gray-500">Автоматически озвучивать ответы AI</p>
                </div>
                <button
                  onClick={() => setAutoSpeech(!autoSpeech)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoSpeech ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  aria-checked={autoSpeech}
                  role="switch"
                  aria-label="Включить авто-озвучку"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoSpeech ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div>
                <label className="block font-medium text-gray-900 mb-2">
                  Температура: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  aria-label="Температура ответов"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Более точный</span>
                  <span>Более креативный</span>
                </div>
              </div>

              {/* Статус SaluteSpeech */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">SaluteSpeech</span>
                  {isSpeechReady ? (
                    <div className="flex items-center space-x-1 text-green-600">
                      <Mic className="w-4 h-4" />
                      <span className="text-sm">Готов</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-yellow-600">
                      <MicOff className="w-4 h-4" />
                      <span className="text-sm">Загрузка...</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {isSpeechReady 
                    ? 'Высококачественный синтез речи от Сбера' 
                    : 'Инициализация голосового синтезатора...'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  // Здесь можно добавить сохранение настроек
                  setShowSettings(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}