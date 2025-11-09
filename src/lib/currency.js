// Currency conversion utility
// In production, you'd use a real currency API like exchangerate-api.com

const CURRENCY_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150.0,
  CAD: 1.35,
  AUD: 1.52,
  CHF: 0.88,
  CNY: 7.20,
  DKK: 6.85,
}

export function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount
  
  const fromRate = CURRENCY_RATES[fromCurrency] || 1.0
  const toRate = CURRENCY_RATES[toCurrency] || 1.0
  
  // Convert to USD first, then to target currency
  const usdAmount = amount / fromRate
  return usdAmount * toRate
}

export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export function getCurrencySymbol(currency = 'USD') {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    DKK: 'kr',
  }
  return symbols[currency] || '$'
}

