import { NextRequest, NextResponse } from 'next/server';

const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';
const AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

const CLIENT_ID = process.env.GIGACHAT_CLIENT_ID;
const CLIENT_SECRET = process.env.GIGACHAT_CLIENT_SECRET;

// Кэш токена в памяти
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GigaChat credentials not configured');
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': `req-${Date.now()}`,
    },
    body: 'scope=GIGACHAT_API_PERS',
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const { message, temperature = 0.7 } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const response = await fetch(`${GIGACHAT_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: [{ role: 'user', content: message }],
        temperature: Math.max(0, Math.min(2, temperature)),
        max_tokens: 1024,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        tokenCache = null;
      }
      throw new Error(`GigaChat API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format');
    }

    return NextResponse.json({
      response: data.choices[0].message.content,
      usage: data.usage,
    });

  } catch (error: any) {
    console.error('GigaChat proxy error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}