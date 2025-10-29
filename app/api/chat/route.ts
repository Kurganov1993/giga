import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = '9b551490-5bc0-441f-892b-ad2e93fe491e'
const CLIENT_SECRET = '7739daa8-f3c4-43d1-a372-69b8542b0071'

async function getAccessToken() {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
  
  const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: 'scope=GIGACHAT_API_PERS',
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function sendMessageToGigaChat(message: string, accessToken: string) {
  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    throw new Error(`GigaChat API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Получаем access token
    const accessToken = await getAccessToken()
    
    // Отправляем сообщение в GigaChat
    const response = await sendMessageToGigaChat(message, accessToken)

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}