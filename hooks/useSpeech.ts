import { useState, useRef, useCallback, useEffect } from 'react'

// Типы для Web Speech API
interface SpeechSynthesisVoice {
  voiceURI: string
  name: string
  lang: string
  localService: boolean
  default: boolean
}

interface SpeechSynthesisErrorEvent extends Event {
  error: string
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Проверка поддержки браузером
  useEffect(() => {
    const supported = 'speechSynthesis' in window
    setIsSupported(supported)

    if (supported) {
      // Загрузка доступных голосов
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        setAvailableVoices(voices)
      }

      // Некоторые браузеры загружают голоса асинхронно
      window.speechSynthesis.onvoiceschanged = loadVoices
      loadVoices() // Пытаемся загрузить сразу

      // Очистка при размонтировании
      return () => {
        window.speechSynthesis.onvoiceschanged = null
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Автоматическая очистка при размонтировании
  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Поиск подходящего голоса для языка
  const getVoiceForLang = useCallback((lang: string): SpeechSynthesisVoice | null => {
    if (!availableVoices.length) return null

    // Сначала ищем точное совпадение
    let voice = availableVoices.find(v => v.lang === lang)
    
    // Если не нашли, ищем по основному языку (например, ru вместо ru-RU)
    if (!voice) {
      const mainLang = lang.split('-')[0]
      voice = availableVoices.find(v => v.lang.startsWith(mainLang))
    }
    
    // Если все еще не нашли, используем голос по умолчанию
    if (!voice) {
      voice = availableVoices.find(v => v.default) || availableVoices[0]
    }
    
    return voice || null
  }, [availableVoices])

  const speak = useCallback((text: string, lang: string = 'ru-RU') => {
    // Проверяем поддержку
    if (!isSupported) {
      console.warn('Speech synthesis is not supported in this browser')
      return
    }

    // Валидация входных данных
    if (!text || typeof text !== 'string') {
      console.error('Invalid text for speech synthesis')
      return
    }

    // Ограничение длины текста (избегаем слишком длинных текстов)
    const sanitizedText = text.trim().slice(0, 10000)
    if (!sanitizedText) {
      console.error('Text is empty after sanitization')
      return
    }

    // Если уже говорим, останавливаем и начинаем заново
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setIsPaused(false)
    }

    try {
      const utterance = new SpeechSynthesisUtterance(sanitizedText)
      utterance.lang = lang
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 1

      // Выбираем подходящий голос
      const voice = getVoiceForLang(lang)
      if (voice) {
        utterance.voice = voice
      }

      // Обработчики событий
      utterance.onstart = () => {
        setIsSpeaking(true)
        setIsPaused(false)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        setIsPaused(false)
        utteranceRef.current = null
      }

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        console.error('Speech synthesis error:', event.error)
        setIsSpeaking(false)
        setIsPaused(false)
        utteranceRef.current = null
      }

      utterance.onpause = () => {
        setIsPaused(true)
      }

      utterance.onresume = () => {
        setIsPaused(false)
      }

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)

    } catch (error) {
      console.error('Error starting speech synthesis:', error)
      setIsSpeaking(false)
      setIsPaused(false)
    }
  }, [isSpeaking, isSupported, getVoiceForLang])

  const stop = useCallback(() => {
    if (!isSupported) return

    try {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setIsPaused(false)
      utteranceRef.current = null
    } catch (error) {
      console.error('Error stopping speech synthesis:', error)
    }
  }, [isSupported])

  const pause = useCallback(() => {
    if (!isSupported || !isSpeaking || isPaused) return

    try {
      window.speechSynthesis.pause()
      setIsPaused(true)
    } catch (error) {
      console.error('Error pausing speech synthesis:', error)
    }
  }, [isSupported, isSpeaking, isPaused])

  const resume = useCallback(() => {
    if (!isSupported || !isSpeaking || !isPaused) return

    try {
      window.speechSynthesis.resume()
      setIsPaused(false)
    } catch (error) {
      console.error('Error resuming speech synthesis:', error)
    }
  }, [isSupported, isSpeaking, isPaused])

  const toggle = useCallback((text: string, lang: string = 'ru-RU') => {
    if (isSpeaking) {
      stop()
    } else {
      speak(text, lang)
    }
  }, [isSpeaking, speak, stop])

  // Получение статуса синтеза речи
  const getStatus = useCallback(() => {
    if (!isSupported) return 'unsupported'
    if (isPaused) return 'paused'
    if (isSpeaking) return 'speaking'
    return 'idle'
  }, [isSupported, isSpeaking, isPaused])

  return {
    // Состояние
    isSpeaking,
    isPaused,
    isSupported,
    availableVoices,
    
    // Основные действия
    speak,
    stop,
    pause,
    resume,
    toggle,
    
    // Дополнительные методы
    getStatus,
    
    // Информация
    isReady: isSupported && availableVoices.length > 0
  }
}