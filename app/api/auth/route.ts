import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import https from 'https'

// Создаем кастомный https агент для игнорирования ошибок SSL (только для разработки)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.SALUTE_SPEECH_CLIENT_ID
    const clientSecret = process.env.SALUTE_SPEECH_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('❌ Missing environment variables')
      return NextResponse.json(
        { 
          error: 'Configuration error',
          details: 'SALUTE_SPEECH_CLIENT_ID or SALUTE_SPEECH_CLIENT_SECRET is not set'
        },
        { status: 500 }
      )
    }

    console.log('🔑 Client ID:', clientId)
    console.log('🔑 Client Secret length:', clientSecret.length)

    // Создаем Authorization Key
    const credentials = `${clientId}:${clientSecret}`
    const AUTHORIZATION_KEY = Buffer.from(credentials).toString('base64')
    console.log('🔑 Generated Authorization Key (first 20 chars):', AUTHORIZATION_KEY.substring(0, 20) + '...')

    const rqUID = crypto.randomUUID()

    console.log('🔑 Requesting token from SaluteSpeech using axios...')

    // Используем axios с кастомным агентом
    const response = await axios.post(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      'scope=SALUTE_SPEECH_PERS',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': rqUID,
          'Authorization': `Basic ${AUTHORIZATION_KEY}`,
        },
        httpsAgent: httpsAgent,
        timeout: 10000, // 10 секунд таймаут
      }
    )

    console.log('🔑 Response status:', response.status)
    console.log('✅ Token received successfully')
    
    return NextResponse.json(response.data)

  } catch (error: any) {
    console.error('🔑 Auth proxy error details:')
    
    if (error.response) {
      // Сервер ответил с ошибкой
      console.error('Status:', error.response.status)
      console.error('Data:', error.response.data)
      console.error('Headers:', error.response.headers)
      
      return NextResponse.json(
        { 
          error: `API Error: ${error.response.status}`,
          details: error.response.data
        },
        { status: error.response.status }
      )
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      console.error('No response received:', error.message)
      
      return NextResponse.json(
        { 
          error: 'Network error',
          details: 'No response from SaluteSpeech API. Possible network issue or SSL problem.'
        },
        { status: 500 }
      )
    } else {
      // Другая ошибка
      console.error('Error:', error.message)
      
      return NextResponse.json(
        { 
          error: 'Request failed',
          details: error.message
        },
        { status: 500 }
      )
    }
  }
}