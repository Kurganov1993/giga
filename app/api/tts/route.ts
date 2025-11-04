import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import https from 'https'

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader) {
      console.error('❌ No Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const text = await request.text()
    
    if (!text?.trim()) {
      console.error('❌ No text provided')
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    console.log('🎵 Synthesizing speech for text:', text.substring(0, 50) + '...')
    console.log('🔑 Using token:', authHeader.substring(0, 20) + '...')

    // Используем правильный Content-Type: application/text
    const response = await axios.post(
      'https://smartspeech.sber.ru/rest/v1/text:synthesize',
      text,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/text', // ИЗМЕНЕНО: было text/plain
          'Accept': 'audio/wav',
        },
        httpsAgent: httpsAgent,
        timeout: 30000,
        responseType: 'arraybuffer'
      }
    )

    console.log('✅ TTS success, audio size:', response.data.byteLength)

    return new Response(response.data, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': response.data.byteLength.toString(),
      },
    })

  } catch (error: any) {
    console.error('❌ TTS proxy error details:')
    
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Headers:', error.response.headers)
      
      let errorDetails = 'Unknown error'
      try {
        const errorText = Buffer.from(error.response.data).toString('utf-8')
        errorDetails = errorText
        console.error('Error response:', errorText)
      } catch (e) {
        console.error('Error data (binary):', error.response.data)
      }
      
      return NextResponse.json(
        { 
          error: `TTS API Error: ${error.response.status}`,
          details: errorDetails
        },
        { status: error.response.status }
      )
    } else if (error.request) {
      console.error('No response received:', error.message)
      
      return NextResponse.json(
        { 
          error: 'TTS network error',
          details: 'No response from TTS API'
        },
        { status: 500 }
      )
    } else {
      console.error('Error:', error.message)
      
      return NextResponse.json(
        { 
          error: 'TTS request failed',
          details: error.message
        },
        { status: 500 }
      )
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}