# Currency Converter API - Product Requirements Document

## 1. Overview
This document outlines the requirements for building a Currency Converter API endpoint that enables currency conversion using Treasury reporting exchange rates.

## 2. Objectives
- Provide a RESTful API endpoint for currency conversion
- Support USD-based currency conversions using official exchange rate data
- Implement a lightweight, efficient conversion service

## 3. Functional Requirements

### 3.1 API Endpoint
- **Endpoint Name**: `/convert`
- **HTTP Method**: GET
- **Input Parameters** (URL query parameters):
  - `amount` (number): The monetary value to convert
  - `from` (string): Source currency ISO code (e.g., "USD", "EUR")
  - `to` (string): Target currency ISO code (e.g., "CAD", "JPY")

### 3.2 Data Source
- Exchange rate data will be sourced from a CSV file located in the `data` folder
- CSV contains exchange rates mapping USD to various currencies with their ISO codes
- Data source: https://fiscaldata.treasury.gov/datasets/treasury-reporting-rates-exchange/

### 3.3 Conversion Logic
- **Direct Conversion Only**: The system supports conversions where USD is either the source or target currency
- **Supported Conversion Patterns**:
  - USD → Target Currency (e.g., USD to EUR)
  - Target Currency → USD (e.g., EUR to USD)
- **Not Supported**: Transitive conversions between non-USD currencies (e.g., CAD to EUR)
- **Rationale**: The dataset only provides exchange rates from USD to other currencies

### 3.4 Implementation
- TypeScript function to handle conversion logic
- Parse CSV data to retrieve exchange rates
- Validate that at least one currency in the conversion pair is USD
- Calculate and return the converted amount

## 4. Non-Functional Requirements
- Clean, maintainable TypeScript code
- Proper error handling for invalid currency codes or unsupported conversions
- Efficient CSV parsing and lookup

## 5. Out of Scope
- Transitive currency conversions (non-USD pairs)
- Historical exchange rate lookups
- Real-time exchange rate updates

## 6. Future Considerations
- Support for transitive currency conversions between non-USD pairs
- Multiple data source integration
- Caching mechanism for exchange rates

## 7. API Security Requirements
- I need to integrate the following Akamai service binding logic to Cloudflare workers. Please:
  - Update the `wrangler.toml` to bind a service named `akamaiService` to the target worker `akamai-service`
  - Need to create binding in both preview (my PR env) and production environments, make sure `wrangler.toml` is correct on this point
  - Convert the JS logic to TS and update the Env interface.
- I have 3 raw code snippets for Akamai integration. Please insert them into my fetch handler exactly as they are, following this specific placement:
  - Placement of Snippet 1 (`prd/main function1.js`): Insert it at the very beginning of the fetch function (before any other logic)
  - Core Logic: After Snippet 1, keep my original const response = await fetch(request)
  - Placement of Snippet 2 (`prd/main function2.js`): Insert it immediately after the fetch call but before the return response
  - Placement of Snippet 3 (`prd/beginning of the code.js`): insert it at the beginning of the code

Important: > * Do not refactor the code; use the raw snippets provided.
    Ensure ctx.waitUntil(akamaiPromise); is included as shown in Snippet 2.

Also, please provide the implementation for the `getAkamaiConfig` and `shouldSendBody` helper functions at the end of the file so the code is runnable.
