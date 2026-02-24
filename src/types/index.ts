export interface ExchangeRate {
  recordDate: string;
  countryCurrencyDescription: string;
  exchangeRate: number;
  effectiveDate: string;
  isoCode: string;
}

export interface ConversionRequest {
  amount: number;
  from: string;
  to: string;
}

export interface ConversionResponse {
  amount: number;
  from: string;
  to: string;
  rate: number;
  converted: number;
  timestamp: string;
}

export interface CurrencyInfo {
  isoCode: string;
  description: string;
  exchangeRate: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
}