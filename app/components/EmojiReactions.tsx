import { useState } from 'react'

const EMOJI_REACTIONS = [
  { emoji: '👍', label: 'Отлично' },
  { emoji: '👎', label: 'Плохо' },
  { emoji: '❤️', label: 'Нравится' },
  { emoji: '😂', label: 'Смешно' },
  { emoji: '😮', label: 'Удивительно' },
  { emoji: '😢', label: 'Грустно' }
]

interface EmojiReactionsProps {
  messageId: string
  onReaction: (messageId: string, emoji: string) => void
}

export function EmojiReactions({ messageId, onReaction }: EmojiReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Добавить реакцию"
      >
        🙂
      </button>

      {showPicker && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
          <div className="grid grid-cols-3 gap-1">
            {EMOJI_REACTIONS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => {
                  onReaction(messageId, emoji)
                  setShowPicker(false)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-lg"
                title={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}