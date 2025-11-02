import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, temperature = 0.7 } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Mock response для тестирования
    const mockResponse = `Это тестовый ответ на ваше сообщение: "${message}". 
    В реальном приложении здесь будет ответ от GigaChat AI. 
    Температура: ${temperature}`;

    // Имитация задержки сети
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      response: mockResponse,
      usage: {
        prompt_tokens: message.length,
        completion_tokens: mockResponse.length,
        total_tokens: message.length + mockResponse.length
      }
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

export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    message: 'GigaChat proxy is working',
    timestamp: new Date().toISOString()
  });
}