'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { register as registerUser } from '@/lib/auth';
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth';
import { useBranding } from '@/hooks/useBranding';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { branding } = useBranding();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    setLoading(true);

    try {
      // Register the user; backend issues HttpOnly auth cookies
      await registerUser({
        email: data.email,
        password: data.password,
        name: data.name,
      });

      // Server sets HttpOnly cookies; navigate once ready
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create your account</h1>
          <p className="text-muted-foreground">Join the {branding.productName}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-card/50 backdrop-blur border border-border rounded-lg p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-2">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className={`w-full px-3 py-2 bg-accent border ${
                errors.name ? 'border-red-500' : 'border-border'
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="John Doe"
              data-testid="name-input"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              required
              className={`w-full px-3 py-2 bg-accent border ${
                errors.email ? 'border-red-500' : 'border-border'
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="you@example.com"
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
              autoComplete="new-password"
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
            <p className="text-xs text-foreground0 mt-1">
              Must contain uppercase, lowercase, and number
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted-foreground mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className={`w-full px-3 py-2 bg-accent border ${
                errors.confirmPassword ? 'border-red-500' : 'border-border'
              } rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent`}
              placeholder="••••••••"
              data-testid="confirm-password-input"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 disabled:bg-muted disabled:cursor-not-allowed font-medium rounded-lg transition-colors btn-brand"
            data-testid="submit-button"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-brand hover:text-[var(--brand-primary-hover)]">
              Sign in
            </Link>
          </p>
        </form>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-muted-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
