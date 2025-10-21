/**
 * Payment Data Validation Hook
 * Handles validation of payment-related data
 */

import { useCallback } from "react";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface UsePaymentValidationReturn {
  validatePaymentData: (data: any) => ValidationResult;
  validateAmount: (amount: number) => ValidationResult;
  validateCurrency: (currency: string) => ValidationResult;
  validateCustomerId: (customerId: string) => ValidationResult;
  validateCardData: (cardData: any) => ValidationResult;
}

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
const CARD_NUMBER_REGEX = /^\d{13,19}$/;
const CVV_REGEX = /^\d{3,4}$/;

export function usePaymentValidation(): UsePaymentValidationReturn {
  const validateAmount = useCallback((amount: number): ValidationResult => {
    const errors: string[] = [];

    if (typeof amount !== "number") {
      errors.push("Amount must be a number");
    } else if (amount <= 0) {
      errors.push("Amount must be greater than 0");
    } else if (amount > 999999999) {
      errors.push("Amount exceeds maximum limit");
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const validateCurrency = useCallback((currency: string): ValidationResult => {
    const errors: string[] = [];

    if (!currency) {
      errors.push("Currency is required");
    } else if (!SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push(`Unsupported currency: ${currency}`);
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const validateCustomerId = useCallback((customerId: string): ValidationResult => {
    const errors: string[] = [];

    if (!customerId) {
      errors.push("Customer ID is required");
    } else if (typeof customerId !== "string") {
      errors.push("Customer ID must be a string");
    } else if (customerId.length < 1) {
      errors.push("Customer ID cannot be empty");
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const validateCardData = useCallback((cardData: any): ValidationResult => {
    const errors: string[] = [];

    if (!cardData) {
      errors.push("Card data is required");
      return { isValid: false, errors };
    }

    if (!cardData.number || !CARD_NUMBER_REGEX.test(cardData.number.replace(/\s/g, ""))) {
      errors.push("Invalid card number");
    }

    if (!cardData.exp_month || cardData.exp_month < 1 || cardData.exp_month > 12) {
      errors.push("Invalid expiration month");
    }

    if (!cardData.exp_year || cardData.exp_year < new Date().getFullYear()) {
      errors.push("Invalid expiration year");
    }

    if (!cardData.cvc || !CVV_REGEX.test(cardData.cvc)) {
      errors.push("Invalid CVV");
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const validatePaymentData = useCallback(
    (data: any): ValidationResult => {
      const allErrors: string[] = [];

      if (!data) {
        return { isValid: false, errors: ["Payment data is required"] };
      }

      const amountValidation = validateAmount(data.amount);
      allErrors.push(...amountValidation.errors);

      const currencyValidation = validateCurrency(data.currency);
      allErrors.push(...currencyValidation.errors);

      const customerValidation = validateCustomerId(data.customer_id);
      allErrors.push(...customerValidation.errors);

      return { isValid: allErrors.length === 0, errors: allErrors };
    },
    [validateAmount, validateCurrency, validateCustomerId],
  );

  return {
    validatePaymentData,
    validateAmount,
    validateCurrency,
    validateCustomerId,
    validateCardData,
  };
}
