import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

// Конфигурация
const MAX_MESSAGE_LENGTH = 4000;
const REQUEST_TIMEOUT = 30000; // 30 секунд
const TOKEN_CACHE_TTL = 30 * 60 * 1000; // 30 минут

// Глобальный кэш для токена
let tokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

// HTTPS агент с отключенной проверкой SSL для Vercel
const agent = new https.Agent({
  rejectUnauthorized: false, // ОТКЛЮЧАЕМ проверку SSL
  keepAlive: true,
  maxSockets: 50,
  timeout: REQUEST_TIMEOUT,
  secureProtocol: 'TLSv1_2_method',
});

const CLIENT_ID = process.env.GIGACHAT_CLIENT_ID;
const CLIENT_SECRET = process.env.GIGACHAT_CLIENT_SECRET;

// Валидация конфигурации
function validateConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GigaChat API credentials are not configured');
  }
}

// Улучшенная функция для выполнения HTTPS запросов
function makeHttpsRequest(options: https.RequestOptions, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode || 500,
            statusText: res.statusMessage || 'Unknown error',
            headers: res.headers,
            data: data ? JSON.parse(data) : null,
            ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300
          };
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Таймаут
    req.setTimeout(REQUEST_TIMEOUT);

    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

// Получение access token с кэшированием
async function getAccessToken(): Promise<string> {
  // Проверяем валидный кэшированный токен
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  validateConfig();
  
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const rqUID = uuidv4();
  
  try {
    const tokenResponse = await makeHttpsRequest({
      hostname: 'ngw.devices.sberbank.ru',
      port: 9443,
      path: '/api/v2/oauth',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': rqUID,
      },
      agent,
    }, 'scope=GIGACHAT_API_PERS');

    if (!tokenResponse.ok) {
      console.error('GigaChat authentication failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        rqUID
      });
      
      throw new Error(`Authentication failed: ${tokenResponse.status}`);
    }

    const tokenData = tokenResponse.data;
    
    // Кэшируем токен с запасом в 1 минуту
    const expiresIn = (tokenData.expires_in - 60) * 1000; // конвертируем в ms и вычитаем запас
    tokenCache = {
      token: tokenData.access_token,
      expiresAt: Date.now() + expiresIn
    };

    console.log('Access token obtained successfully');
    return tokenData.access_token;

  } catch (error) {
    console.error('Token request error:', error);
    throw error;
  }
}

// Валидация входных данных
function validateInput(message: string, temperature: number): { isValid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Valid message is required' };
  }

  if (message.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { 
      isValid: false, 
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` 
    };
  }

  if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
    return { 
      isValid: false, 
      error: 'Temperature must be a number between 0 and 2' 
    };
  }

  return { isValid: true };
}

export async function POST(request: NextRequest) {
  let requestId = uuidv4();
  
  console.log(`[${requestId}] Processing chat request`);

  try {
    // Проверяем размер тела запроса
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    const body = await request.json().catch(() => null);
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { message, temperature = 0.7 } = body;

    // Валидация входных данных
    const validation = validateInput(message, temperature);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Getting access token...`);
    const accessToken = await getAccessToken();

    console.log(`[${requestId}] Sending message to GigaChat...`);
    
    try {
      const chatResponse = await makeHttpsRequest({
        hostname: 'gigachat.devices.sberbank.ru',
        port: 443,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        agent,
      }, JSON.stringify({
        model: 'GigaChat',
        messages: [
          {
            role: 'user',
            content: message.trim(),
          },
        ],
        temperature: Math.max(0, Math.min(2, temperature)),
        max_tokens: 1024,
        top_p: 0.9,
        stream: false,
      }));

      if (!chatResponse.ok) {
        console.error(`[${requestId}] GigaChat API request failed:`, {
          status: chatResponse.status,
          statusText: chatResponse.statusText,
          requestId
        });
        
        if (chatResponse.status === 401) {
          // Инвалидируем кэш токена при 401 ошибке
          tokenCache = null;
          return NextResponse.json(
            { error: 'Authentication failed. Please check your API credentials.' },
            { status: 401 }
          );
        }
        
        if (chatResponse.status === 429) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
          );
        }

        if (chatResponse.status >= 500) {
          return NextResponse.json(
            { error: 'GigaChat service is temporarily unavailable. Please try again later.' },
            { status: 503 }
          );
        }
        
        return NextResponse.json(
          { error: `GigaChat API error: ${chatResponse.status}` },
          { status: chatResponse.status }
        );
      }

      const chatData = chatResponse.data;
      
      if (!chatData.choices?.[0]?.message?.content) {
        console.error(`[${requestId}] Invalid response format:`, chatData);
        throw new Error('Invalid response format from GigaChat');
      }

      const response = chatData.choices[0].message.content;
      console.log(`[${requestId}] Successfully received response from GigaChat`);

      return NextResponse.json({ 
        response,
        usage: chatData.usage,
        requestId 
      });

    } catch (fetchError) {
      console.error(`[${requestId}] Fetch error:`, fetchError);
      throw fetchError;
    }

  } catch (error) {
    console.error(`[${requestId}] Error in chat API:`, error);
    
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('credentials are not configured')) {
        errorMessage = 'Service configuration error';
        statusCode = 500;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.';
        statusCode = 504;
      } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
        errorMessage = 'SSL connection error. Please try again.';
        statusCode = 502;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
        statusCode = 503;
      } else if (error.message.includes('401') || error.message.includes('authenticate')) {
        errorMessage = 'Authentication failed. Please check your API credentials.';
        statusCode = 401;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}

// Health check endpoint
export async function GET() {
  const isConfigured = !!(CLIENT_ID && CLIENT_SECRET);
  
  return NextResponse.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    configured: isConfigured,
    tokenCached: !!(tokenCache && tokenCache.expiresAt > Date.now()),
    limits: {
      maxMessageLength: MAX_MESSAGE_LENGTH,
      requestTimeout: REQUEST_TIMEOUT
    }
  });
}

// Очистка кэша токена (для тестирования)
export async function DELETE() {
  tokenCache = null;
  return NextResponse.json({ 
    status: 'Token cache cleared',
    timestamp: new Date().toISOString()
  });
}