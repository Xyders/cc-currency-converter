import { parse } from 'csv-parse/sync';
import { ExchangeRate, CurrencyInfo } from '../types/index.js';
import { RATES_CSV } from '../data/rates.js';

interface CsvRow {
  'Record Date': string;
  'Country - Currency Description': string;
  'Exchange Rate': number;
  'Effective Date': string;
  'ISO code': string;
}

export class CurrencyService {
  private rates: Map<string, ExchangeRate> | null = null;
  private currencies: CurrencyInfo[] | null = null;

  private async loadRates(): Promise<void> {
    if (this.rates !== null) return;

    try {
      const records = parse(RATES_CSV, {
        columns: true,
        skip_empty_lines: true,
        cast: (value: string, context: any) => {
          if (context.column === 'Exchange Rate') {
            return parseFloat(value);
          }
          return value;
        },
      }) as CsvRow[];

      this.rates = new Map();
      this.currencies = [];

      // Add USD with rate 1 (base currency)
      const usdRate: ExchangeRate = {
        recordDate: '2025-12-31',
        countryCurrencyDescription: 'United States-Dollar',
        exchangeRate: 1,
        effectiveDate: '2025-12-31',
        isoCode: 'USD',
      };
      this.rates.set('USD', usdRate);
      this.currencies.push({
        isoCode: 'USD',
        description: 'United States-Dollar',
        exchangeRate: 1,
      });

      const seenCodes = new Set<string>();
      // Add USD to seen set
      seenCodes.add('USD');

      for (const record of records) {
        const isoCode = record['ISO code'].toUpperCase();
        const exchangeRate: ExchangeRate = {
          recordDate: record['Record Date'],
          countryCurrencyDescription: record['Country - Currency Description'],
          exchangeRate: record['Exchange Rate'],
          effectiveDate: record['Effective Date'],
          isoCode: record['ISO code'],
        };
        this.rates.set(isoCode, exchangeRate);

        // Add to currencies list only if not already seen
        if (!seenCodes.has(isoCode)) {
          seenCodes.add(isoCode);
          this.currencies.push({
            isoCode: exchangeRate.isoCode,
            description: exchangeRate.countryCurrencyDescription,
            exchangeRate: exchangeRate.exchangeRate,
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse CSV data:', error);
      throw new Error('Failed to load exchange rates');
    }
  }

  async getRate(from: string, to: string): Promise<number> {
    await this.loadRates();
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    // Validate currencies exist
    if (!this.rates!.has(fromUpper)) {
      throw new Error(`Invalid source currency code: ${from}`);
    }
    if (!this.rates!.has(toUpper)) {
      throw new Error(`Invalid target currency code: ${to}`);
    }

    // Only USD ↔ other currency conversions are allowed
    if (fromUpper !== 'USD' && toUpper !== 'USD') {
      throw new Error('Only conversions involving USD are supported. USD must be either source or target currency.');
    }

    const fromRate = this.rates!.get(fromUpper)!.exchangeRate;
    const toRate = this.rates!.get(toUpper)!.exchangeRate;

    // If converting from USD to foreign: rate = foreign rate (units per 1 USD)
    // If converting from foreign to USD: rate = 1 / foreign rate
    if (fromUpper === 'USD') {
      return toRate;
    } else {
      return 1 / fromRate;
    }
  }

  async convert(amount: number, from: string, to: string): Promise<{ rate: number; converted: number }> {
    if (amount <= 0 || isNaN(amount)) {
      throw new Error('Amount must be a positive number greater than 0');
    }

    const rate = await this.getRate(from, to);
    const converted = amount * rate;

    return { rate, converted };
  }

  async listCurrencies(): Promise<CurrencyInfo[]> {
    await this.loadRates();
    return this.currencies!;
  }

  async isValidCurrency(code: string): Promise<boolean> {
    await this.loadRates();
    return this.rates!.has(code.toUpperCase());
  }
}

// Singleton instance
export const currencyService = new CurrencyService();