import { Message } from '@/lib/types'
import { 
  Check, 
  Clock, 
  AlertCircle, 
  Copy, 
  CheckCheck, 
  Edit3,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface ChatMessageProps {
  message: Message
  onEdit?: (messageId: string, newContent: string) => void
  isMobile?: boolean
}

export function ChatMessage({ message, onEdit, isMobile = false }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEditing, editedContent])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Ошибка копирования:', err)
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
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
      setIsSpeaking(true)
    }
  }

  const handleEdit = () => {
    if (isEditing && editedContent !== message.content) {
      onEdit?.(message.id, editedContent)
    }
    setIsEditing(!isEditing)
  }

  const cancelEdit = () => {
    setEditedContent(message.content)
    setIsEditing(false)
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
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

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
              <span>{formatTimestamp(message.timestamp)}</span>
              
              <div className="flex items-center space-x-1">
                {!isUser && (
                  <button
                    onClick={toggleSpeech}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title={isSpeaking ? "Остановить" : "Озвучить"}
                  >
                    {isSpeaking ? (
                      <VolumeX className="w-3 h-3" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                )}

                <button
                  onClick={copyToClipboard}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Копировать"
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
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
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
}