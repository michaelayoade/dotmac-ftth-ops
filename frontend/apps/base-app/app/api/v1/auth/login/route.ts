import { NextRequest, NextResponse } from 'next/server';

/**
 * Login API Route Handler
 *
 * Proxies login requests to the backend and properly forwards Set-Cookie headers.
 * This is necessary because Next.js rewrites don't preserve cookies correctly.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body with validation
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body', detail: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: 'Missing required fields', detail: 'Username and password are required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'default';

    console.log(`[Login] Proxying login request to ${backendUrl}/api/v1/auth/login`);

    // Make request to backend
    let response;
    try {
      response = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(body),
      });
    } catch (fetchError) {
      console.error('Backend fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Backend unavailable', detail: 'Could not connect to authentication service' },
        { status: 503 }
      );
    }

    // Parse backend response with error handling
    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Backend returned non-JSON response (likely HTML error page)
        const textResponse = await response.text();
        console.error('Backend returned non-JSON response:', textResponse.substring(0, 200));
        return NextResponse.json(
          {
            error: 'Backend error',
            detail: 'Authentication service returned invalid response',
            status: response.status
          },
          { status: 502 }
        );
      }

      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse backend response:', jsonError);
      return NextResponse.json(
        { error: 'Invalid backend response', detail: 'Authentication service response was malformed' },
        { status: 502 }
      );
    }

    // Create Next.js response with the data
    const nextResponse = NextResponse.json(data, { status: response.status });

    // Forward all Set-Cookie headers from backend to browser
    // Use getSetCookie() to properly retrieve all Set-Cookie headers
    const cookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : response.headers
            .get('Set-Cookie')
            ?.split(/,(?=\s*[^;=]+=\s*[^;=]+)/)
            .map(cookie => cookie.trim()) || [];

    if (cookies.length > 0) {
      console.log(`[Login] Forwarding ${cookies.length} cookie(s) from backend`);
      const host = request.headers.get('host')?.split(':')[0] || 'localhost';
      const isSecureContext = request.nextUrl.protocol === 'https:';

      cookies.forEach((cookie) => {
        let rewritten = cookie;

        // Ensure domain matches frontend host (or remove entirely for host-only cookie)
        if (/domain=/i.test(rewritten)) {
          rewritten = rewritten.replace(/Domain=[^;]+/gi, `Domain=${host}`);
        }

        // Remove Secure attribute when running over HTTP to allow browser to store the cookie
        if (!isSecureContext) {
          rewritten = rewritten.replace(/;\s*Secure/gi, '');
        }

        // Deduplicate whitespace
        rewritten = rewritten.replace(/\s{2,}/g, ' ').trim();

        console.log('[Login] Rewriting cookie header:', rewritten);
        nextResponse.headers.append('Set-Cookie', rewritten);
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
