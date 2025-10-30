import { Message } from '@/lib/types'
import { 
  Check, 
  Clock, 
  AlertCircle, 
  Copy, 
  CheckCheck, 
  ThumbsUp, 
  ThumbsDown,
  Edit3,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface ChatMessageProps {
  message: Message
  onEdit?: (messageId: string, newContent: string) => void
  onFeedback?: (messageId: string, feedback: 'like' | 'dislike') => void
}

export function ChatMessage({ message, onEdit, onFeedback }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [userFeedback, setUserFeedback] = useState<'like' | 'dislike' | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Автоматический размер textarea при редактировании
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEditing, editedContent])

  // Очистка речи при размонтировании
  useEffect(() => {
    return () => {
      if (speechRef.current) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Ошибка копирования текста: ', err)
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = message.content
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    } else {
      const utterance = new SpeechSynthesisUtterance(message.content)
      utterance.lang = 'ru-RU'
      utterance.rate = 0.9
      utterance.pitch = 1
      
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      
      speechRef.current = utterance
      window.speechSynthesis.speak(utterance)
      setIsSpeaking(true)
    }
  }

  const handleEdit = () => {
    if (isEditing) {
      onEdit?.(message.id, editedContent)
      setIsEditing(false)
    } else {
      setIsEditing(true)
    }
  }

  const cancelEdit = () => {
    setEditedContent(message.content)
    setIsEditing(false)
  }

  const handleFeedback = (feedback: 'like' | 'dislike') => {
    setUserFeedback(feedback)
    onFeedback?.(message.id, feedback)
    
    // Анимация подтверждения
    setTimeout(() => {
      // Можно убрать или оставить фидбек видимым
    }, 2000)
  }

  const getStatusIcon = () => {
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
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const messageTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'только что'
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`
    
    return messageTime.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    })
  }

  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group relative`}>
      {/* Аватар для AI */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
        </div>
      )}
      
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 relative transition-all duration-200 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none shadow-lg hover:shadow-xl'
            : 'bg-white text-gray-800 rounded-bl-none border border-gray-200 shadow-md hover:shadow-lg'
        } ${
          message.status === 'error' ? 'border-red-300 bg-red-50' : ''
        }`}
      >
        {/* Контент сообщения */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full bg-transparent border border-gray-300 rounded-lg p-2 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div 
              className={`whitespace-pre-wrap break-words leading-relaxed ${
                message.status === 'error' ? 'text-red-700' : ''
              }`}
            >
              {message.content}
            </div>
            
            {/* Футер сообщения */}
            <div className={`flex items-center justify-between mt-2 ${
              isUser ? 'text-blue-200' : 'text-gray-500'
            }`}>
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-medium">
                  {formatTimestamp(message.timestamp)}
                </span>
                {getStatusIcon()}
              </div>
              
              {/* Кнопки действий */}
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {!isUser && (
                  <>
                    {/* Озвучка */}
                    <button
                      onClick={toggleSpeech}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      title={isSpeaking ? "Остановить озвучку" : "Озвучить сообщение"}
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Фидбек */}
                    {!userFeedback && (
                      <>
                        <button
                          onClick={() => handleFeedback('like')}
                          className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Понравился ответ"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback('dislike')}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Не понравился ответ"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {userFeedback && (
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        userFeedback === 'like' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {userFeedback === 'like' ? '👍' : '👎'}
                      </div>
                    )}
                  </>
                )}

                {/* Копирование */}
                <button
                  onClick={copyToClipboard}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title={copied ? "Скопировано!" : "Копировать сообщение"}
                >
                  {copied ? (
                    <CheckCheck className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Редактирование (только для пользователя) */}
                {isUser && onEdit && (
                  <button
                    onClick={handleEdit}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title="Редактировать сообщение"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Аватар для пользователя */}
      {isUser && (
        <div className="flex-shrink-0 ml-3 mt-1">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
            Я
          </div>
        </div>
      )}
    </div>
  )
}