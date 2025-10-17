import { NextRequest, NextResponse } from 'next/server';

/**
 * Login API Route Handler
 *
 * Proxies login requests to the backend and properly forwards Set-Cookie headers.
 * This is necessary because Next.js rewrites don't preserve cookies correctly.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Create Next.js response with the data
    const nextResponse = NextResponse.json(data, { status: response.status });

    // Forward all Set-Cookie headers from backend to browser
    // Note: Headers.forEach() will iterate over all set-cookie headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        nextResponse.headers.append('Set-Cookie', value);
      }
    });

    return nextResponse;
  } catch (error) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
