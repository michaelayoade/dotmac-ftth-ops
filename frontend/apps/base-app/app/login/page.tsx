'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';
import { useBranding } from '@/hooks/useBranding';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { branding } = useBranding();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setLoading(true);

    try {
      logger.info('Starting login process', { email: data.email });

      const response = await apiClient.post('/auth/login', {
        email: data.email,
        password: data.password,
      });
      logger.debug('Login response received', { status: response.status });

      if (response.status === 200) {
        logger.info('Login successful, cookies should be set by server');
        await new Promise(resolve => setTimeout(resolve, 500));
        logger.info('Redirecting to dashboard');
        router.push('/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Login failed';
      logger.error('Login error', err instanceof Error ? err : new Error(String(err)));
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-sm text-muted-foreground hover:text-muted-foreground mb-4">
            ← Back to home
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground">
            Sign in to your {branding.productName} account
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300 font-medium">Test Credentials:</p>
              <p className="text-xs text-blue-200 mt-1">admin / admin123</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-card/50 backdrop-blur border border-border rounded-lg p-8 space-y-6" data-testid="login-form">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm" data-testid="error-message">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className={`w-full px-3 py-2 bg-accent border ${
                errors.email ? 'border-red-500' : 'border-border'
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="user@example.com"
              data-testid="email-input"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className={`w-full px-3 py-2 bg-accent border ${
                errors.password ? 'border-red-500' : 'border-border'
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="••••••••"
              data-testid="password-input"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-accent text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] focus:ring-offset-background"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-muted-foreground">
                Remember me
              </label>
            </div>

            <Link href="/forgot-password" className="text-sm text-brand hover:text-[var(--brand-primary-hover)]">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed btn-brand"
            data-testid="submit-button"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-brand hover:text-[var(--brand-primary-hover)] font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
