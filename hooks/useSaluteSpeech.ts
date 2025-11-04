// hooks/useSaluteSpeech.ts
import { useState, useRef, useCallback, useEffect } from 'react'

interface SaluteSpeechState {
  isSpeaking: boolean
  isLoading: boolean
  error: string | null
  isReady: boolean
  debugLog: string[]
}

export function useSaluteSpeech() {
  const [state, setState] = useState<SaluteSpeechState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
    isReady: false,
    debugLog: []
  })

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const addDebugLog = useCallback((message: string) => {
    console.log('🔊 SaluteSpeech:', message)
    setState(prev => ({
      ...prev,
      debugLog: [...prev.debugLog.slice(-9), `${new Date().toISOString().split('T')[1]}: ${message}`]
    }))
  }, [])

  // Получение токена
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      addDebugLog('🔄 Requesting access token...')

      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.access_token) {
        throw new Error('No access token received')
      }

      addDebugLog('✅ Token received successfully')
      setAccessToken(data.access_token)
      setState(prev => ({ ...prev, isReady: true, error: null }))
      return data.access_token

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get token'
      addDebugLog(`❌ Token error: ${errorMessage}`)
      setState(prev => ({ ...prev, error: errorMessage, isReady: false }))
      return null
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [addDebugLog])

  // Синтез речи - адаптирован под ваш рабочий endpoint
  const synthesizeSpeech = useCallback(async (text: string): Promise<ArrayBuffer | null> => {
    try {
      addDebugLog(`🎵 Starting synthesis for text: "${text.substring(0, 50)}..."`)
      
      let currentToken = accessToken
      
      if (!currentToken) {
        addDebugLog('🔄 No token available, getting new one...')
        const newToken = await getAccessToken()
        if (!newToken) {
          throw new Error('No access token available')
        }
        currentToken = newToken
      }

      // Используем ваш рабочий endpoint с правильными headers
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          // Content-Type будет установлен автоматически для text/plain
        },
        body: text, // Отправляем чистый текст, как в вашем рабочем коде
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        if (response.status === 401) {
          addDebugLog('🔄 Token expired, refreshing...')
          const newToken = await getAccessToken()
          if (newToken) {
            setAccessToken(newToken)
            return synthesizeSpeech(text)
          }
        }
        
        throw new Error(errorData.details || errorData.error || `TTS failed: ${response.status}`)
      }

      // Получаем аудио данные как ArrayBuffer
      const audioData = await response.arrayBuffer()
      addDebugLog(`✅ Synthesis successful, audio size: ${audioData.byteLength} bytes`)
      return audioData

    } catch (error) {
      addDebugLog(`❌ Synthesis error: ${error}`)
      throw error
    }
  }, [accessToken, getAccessToken, addDebugLog])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setState(prev => ({ ...prev, isSpeaking: false }))
    addDebugLog('⏹️ Speech stopped')
  }, [addDebugLog])

  const speak = useCallback(async (text: string) => {
    if (!text?.trim()) {
      setState(prev => ({ ...prev, error: 'Empty text provided' }))
      return
    }

    // Останавливаем текущее воспроизведение
    stop()

    try {
      setState(prev => ({ ...prev, isLoading: true, isSpeaking: true, error: null }))
      addDebugLog('🎤 Starting speech...')

      const audioData = await synthesizeSpeech(text.trim())
      
      if (!audioData) {
        throw new Error('Speech synthesis returned null')
      }

      // Создаем blob URL для WAV аудио
      const audioBlob = new Blob([audioData], { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Создаем и настраиваем аудио элемент
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      // Обработчики событий
      audio.onended = () => {
        addDebugLog('⏹️ Audio playback ended')
        setState(prev => ({ ...prev, isSpeaking: false }))
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = (e) => {
        console.error('🔊 Audio playback error:', e)
        addDebugLog('❌ Audio playback failed')
        setState(prev => ({ ...prev, error: 'Audio playback failed', isSpeaking: false }))
        URL.revokeObjectURL(audioUrl)
      }

      audio.oncanplaythrough = () => {
        addDebugLog('✅ Audio can play through')
      }

      // Начинаем воспроизведение
      addDebugLog('▶️ Starting audio playback...')
      await audio.play()
      addDebugLog('🎉 Audio playback started successfully')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to speak text'
      addDebugLog(`❌ Speak error: ${errorMessage}`)
      setState(prev => ({ ...prev, error: errorMessage, isSpeaking: false }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [synthesizeSpeech, stop])

  const refreshToken = useCallback(async () => {
    addDebugLog('🔄 Manually refreshing token...')
    await getAccessToken()
  }, [getAccessToken, addDebugLog])

  // Инициализация при монтировании
  useEffect(() => {
    getAccessToken()
  }, [getAccessToken])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  return {
    isSpeaking: state.isSpeaking,
    isLoading: state.isLoading,
    error: state.error,
    isReady: state.isReady,
    debugLog: state.debugLog,
    speak,
    stop,
    refreshToken,
  }
}