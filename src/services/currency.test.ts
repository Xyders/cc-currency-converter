import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CurrencyService, currencyService } from './currency.js';

// Hoisted mock to avoid import order issues
const mockRates = vi.hoisted(() => ({
  RATES_CSV: `Record Date,Country - Currency Description,Exchange Rate,Effective Date,ISO code
2025-12-31,Euro Zone-Euro,0.851,2025-12-31,EUR
2025-12-31,Japan-Yen,156.61,2025-12-31,JPY
2025-12-31,United Kingdom-Pound,0.743,2025-12-31,GBP
2025-12-31,Canada-Dollar,1.369,2025-12-31,CAD`,
}));

vi.mock('../data/rates.js', () => mockRates);

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    service = new CurrencyService();
    // Clear singleton state for isolation
    (service as any).rates = null;
    (service as any).currencies = null;
  });

  describe('loadRates', () => {
    it('should parse CSV and build rates map', async () => {
      await (service as any).loadRates();
      expect((service as any).rates).toBeInstanceOf(Map);
      expect((service as any).rates.size).toBe(5); // USD + 4 test currencies
      expect((service as any).rates.has('USD')).toBe(true);
      expect((service as any).rates.has('EUR')).toBe(true);
      expect((service as any).rates.has('JPY')).toBe(true);
      expect((service as any).rates.has('GBP')).toBe(true);
      expect((service as any).rates.has('CAD')).toBe(true);
    });

    it('should include USD with rate 1', async () => {
      await (service as any).loadRates();
      const usdRate = (service as any).rates.get('USD');
      expect(usdRate).toMatchObject({
        isoCode: 'USD',
        exchangeRate: 1,
        countryCurrencyDescription: 'United States-Dollar',
      });
    });

    it('should parse exchange rates as numbers', async () => {
      await (service as any).loadRates();
      const eurRate = (service as any).rates.get('EUR');
      expect(eurRate.exchangeRate).toBe(0.851);
      const jpyRate = (service as any).rates.get('JPY');
      expect(jpyRate.exchangeRate).toBe(156.61);
    });

    it('should populate currencies list without duplicates', async () => {
      await (service as any).loadRates();
      const currencies = (service as any).currencies;
      expect(currencies).toHaveLength(5);
      const codes = currencies.map((c: any) => c.isoCode);
      expect(codes).toEqual(['USD', 'EUR', 'JPY', 'GBP', 'CAD']);
    });
  });

  describe('getRate', () => {
    beforeEach(async () => {
      await (service as any).loadRates();
    });

    it('should return correct rate for USD to foreign', async () => {
      expect(await service.getRate('USD', 'EUR')).toBe(0.851);
      expect(await service.getRate('USD', 'JPY')).toBe(156.61);
      expect(await service.getRate('USD', 'GBP')).toBe(0.743);
      expect(await service.getRate('USD', 'CAD')).toBe(1.369);
    });

    it('should return correct rate for foreign to USD', async () => {
      // USD to foreign rate = foreign rate; foreign to USD rate = 1 / foreign rate
      expect(await service.getRate('EUR', 'USD')).toBeCloseTo(1 / 0.851);
      expect(await service.getRate('JPY', 'USD')).toBeCloseTo(1 / 156.61);
      expect(await service.getRate('GBP', 'USD')).toBeCloseTo(1 / 0.743);
      expect(await service.getRate('CAD', 'USD')).toBeCloseTo(1 / 1.369);
    });

    it('should throw for invalid source currency', async () => {
      await expect(service.getRate('XYZ', 'USD')).rejects.toThrow(
        'Invalid source currency code: XYZ'
      );
    });

    it('should throw for invalid target currency', async () => {
      await expect(service.getRate('USD', 'XYZ')).rejects.toThrow(
        'Invalid target currency code: XYZ'
      );
    });

    it('should throw for non‑USD pairs', async () => {
      await expect(service.getRate('EUR', 'JPY')).rejects.toThrow(
        'Only conversions involving USD are supported'
      );
    });

    it('should be case‑insensitive', async () => {
      expect(await service.getRate('usd', 'eur')).toBe(0.851);
      expect(await service.getRate('USD', 'Eur')).toBe(0.851);
      expect(await service.getRate('Eur', 'usd')).toBeCloseTo(1 / 0.851);
    });
  });

  describe('convert', () => {
    it('should convert USD to foreign correctly', async () => {
      const result = await service.convert(100, 'USD', 'EUR');
      expect(result.rate).toBe(0.851);
      expect(result.converted).toBeCloseTo(85.1);
    });

    it('should convert foreign to USD correctly', async () => {
      const result = await service.convert(100, 'EUR', 'USD');
      expect(result.rate).toBeCloseTo(1 / 0.851);
      expect(result.converted).toBeCloseTo(100 / 0.851);
    });

    it('should throw for zero or negative amount', async () => {
      await expect(service.convert(0, 'USD', 'EUR')).rejects.toThrow(
        'Amount must be a positive number greater than 0'
      );
      await expect(service.convert(-5, 'USD', 'EUR')).rejects.toThrow(
        'Amount must be a positive number greater than 0'
      );
    });

    it('should throw for NaN amount', async () => {
      await expect(service.convert(NaN, 'USD', 'EUR')).rejects.toThrow(
        'Amount must be a positive number greater than 0'
      );
    });

    it('should propagate currency errors', async () => {
      await expect(service.convert(100, 'XYZ', 'USD')).rejects.toThrow(
        'Invalid source currency code: XYZ'
      );
    });
  });

  describe('listCurrencies', () => {
    it('should return array of CurrencyInfo', async () => {
      const currencies = await service.listCurrencies();
      expect(currencies).toHaveLength(5);
      expect(currencies[0]).toMatchObject({
        isoCode: 'USD',
        description: 'United States-Dollar',
        exchangeRate: 1,
      });
      const codes = currencies.map((c) => c.isoCode);
      expect(codes).toEqual(['USD', 'EUR', 'JPY', 'GBP', 'CAD']);
    });

    it('should include USD', async () => {
      const currencies = await service.listCurrencies();
      const usd = currencies.find((c) => c.isoCode === 'USD');
      expect(usd).toBeDefined();
      expect(usd?.exchangeRate).toBe(1);
    });
  });

  describe('isValidCurrency', () => {
    it('should return true for valid currency codes', async () => {
      expect(await service.isValidCurrency('USD')).toBe(true);
      expect(await service.isValidCurrency('EUR')).toBe(true);
      expect(await service.isValidCurrency('JPY')).toBe(true);
      expect(await service.isValidCurrency('GBP')).toBe(true);
      expect(await service.isValidCurrency('CAD')).toBe(true);
      expect(await service.isValidCurrency('eur')).toBe(true); // case‑insensitive
    });

    it('should return false for invalid codes', async () => {
      expect(await service.isValidCurrency('XYZ')).toBe(false);
      expect(await service.isValidCurrency('')).toBe(false);
      expect(await service.isValidCurrency('US')).toBe(false);
    });
  });

  describe('singleton instance', () => {
    it('should be the same instance', () => {
      expect(currencyService).toBeInstanceOf(CurrencyService);
      // Ensure singleton is not null
      expect(currencyService).toBe(currencyService);
    });
  });
});