"use client";

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CreditCard, Lock } from "lucide-react";

/**
 * Stripe Card Element Component
 *
 * This component renders a secure Stripe card input field.
 * In production, you would:
 * 1. Install: npm install @stripe/stripe-js @stripe/react-stripe-js
 * 2. Load Stripe.js with your publishable key
 * 3. Use Stripe Elements for PCI-compliant card collection
 *
 * For now, this is a placeholder that simulates the Stripe Elements UI
 * while maintaining the same API interface for easy migration.
 */

interface StripeCardElementProps {
  onCardReady?: (ready: boolean) => void;
  onCardChange?: (event: { complete: boolean; error?: { message: string } }) => void;
}

export const StripeCardElement: React.FC<StripeCardElementProps> = ({
  onCardReady,
  onCardChange,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCvc] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate Stripe Elements ready event
    onCardReady?.(true);
  }, [onCardReady]);

  useEffect(() => {
    // Validate card data
    const isComplete =
      cardNumber.replace(/\s/g, "").length >= 13 &&
      cardExpiry.length >= 4 &&
      cardCvc.length >= 3;

    onCardChange?.({
      complete: isComplete,
      error: cardError ? { message: cardError } : undefined,
    });
  }, [cardNumber, cardExpiry, cardCvc, cardError, onCardChange]);

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted;
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)} / ${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  };

  const validateLuhn = (num: string): boolean => {
    const cleaned = num.replace(/\s/g, "");
    if (!/^\d+$/.test(cleaned)) return false;

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  };

  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\s/g, "").substring(0, 16);
    setCardNumber(cleaned);

    if (cleaned.length >= 13) {
      if (!validateLuhn(cleaned)) {
        setCardError("Invalid card number");
      } else {
        setCardError(null);
      }
    } else {
      setCardError(null);
    }
  };

  const handleExpiryChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").substring(0, 4);
    setCardExpiry(cleaned);

    if (cleaned.length === 4) {
      const month = parseInt(cleaned.substring(0, 2), 10);
      const year = parseInt(cleaned.substring(2, 4), 10);
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;

      if (month < 1 || month > 12) {
        setCardError("Invalid expiration month");
      } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        setCardError("Card has expired");
      } else {
        setCardError(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
        <div className="flex items-start gap-2">
          <Lock className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Secure Payment Information
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
              Your card data is encrypted and tokenized. We never store your full card number.
            </p>
          </div>
        </div>
      </div>

      {cardError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{cardError}</AlertDescription>
        </Alert>
      )}

      <div
        className={`border rounded-lg p-4 transition-all ${
          isFocused
            ? "border-primary ring-2 ring-primary/20"
            : cardError
              ? "border-destructive"
              : "border-input"
        }`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Card Information</span>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="stripeCardNumber" className="text-xs text-muted-foreground">
              Card Number
            </Label>
            <input
              id="stripeCardNumber"
              type="text"
              className="w-full bg-transparent border-0 outline-none text-base pt-1"
              placeholder="1234 5678 9012 3456"
              value={formatCardNumber(cardNumber)}
              onChange={(e) => handleCardNumberChange(e.target.value)}
              maxLength={19}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stripeCardExpiry" className="text-xs text-muted-foreground">
                Expiration
              </Label>
              <input
                id="stripeCardExpiry"
                type="text"
                className="w-full bg-transparent border-0 outline-none text-base pt-1"
                placeholder="MM / YY"
                value={formatExpiry(cardExpiry)}
                onChange={(e) => handleExpiryChange(e.target.value)}
                maxLength={7}
              />
            </div>

            <div>
              <Label htmlFor="stripeCardCvc" className="text-xs text-muted-foreground">
                CVC
              </Label>
              <input
                id="stripeCardCvc"
                type="password"
                className="w-full bg-transparent border-0 outline-none text-base pt-1"
                placeholder="123"
                value={cardCvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").substring(0, 4))}
                maxLength={4}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Lock className="h-3 w-3" />
        <span>
          Powered by secure tokenization. Card details are encrypted in transit and at rest.
        </span>
      </div>
    </div>
  );
};

/**
 * Hook to create a Stripe token from the card element
 *
 * In production with real Stripe.js:
 * const stripe = useStripe();
 * const elements = useElements();
 * const { token } = await stripe.createToken(elements.getElement(CardElement));
 *
 * For now, returns a simulated token for development
 */
export const useStripeCardToken = () => {
  const createToken = async (): Promise<{ token: string; error?: string }> => {
    try {
      // In production, this would call stripe.createToken()
      // For now, generate a simulated Stripe token format
      const simulatedToken = `tok_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      return { token: simulatedToken };
    } catch (error) {
      return {
        token: "",
        error: error instanceof Error ? error.message : "Failed to create token",
      };
    }
  };

  return { createToken };
};

/**
 * Instructions for production Stripe.js implementation:
 *
 * 1. Install packages:
 *    npm install @stripe/stripe-js @stripe/react-stripe-js
 *
 * 2. Create a Stripe provider wrapper (app-level):
 *    import { loadStripe } from '@stripe/stripe-js';
 *    import { Elements } from '@stripe/react-stripe-js';
 *
 *    const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
 *
 *    <Elements stripe={stripePromise}>
 *      <YourApp />
 *    </Elements>
 *
 * 3. Replace this component with real Stripe CardElement:
 *    import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
 *
 * 4. Update createToken to use real Stripe:
 *    const stripe = useStripe();
 *    const elements = useElements();
 *    const { token, error } = await stripe.createToken(elements.getElement(CardElement));
 *
 * 5. Set environment variable:
 *    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
 */
