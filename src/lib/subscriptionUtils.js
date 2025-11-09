import { convertCurrency } from './currency'

/**
 * Calculate the number of billing periods between two dates based on frequency
 */
function getBillingPeriods(startDate, endDate, frequency) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = end - start
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  switch (frequency) {
    case 'week':
      return Math.ceil(diffDays / 7)
    case 'month':
      return Math.ceil(diffDays / 30.44) // Average days per month
    case 'year':
      return Math.ceil(diffDays / 365)
    default:
      return Math.ceil(diffDays / 30.44) // Default to monthly
  }
}

/**
 * Calculate subscription cost for a given period
 * @param {Object} subscription - Subscription object
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @param {string} targetCurrency - Currency to convert to
 * @returns {number} Total cost for the period
 */
export function calculateSubscriptionCost(subscription, startDate, endDate, targetCurrency) {
  if (!subscription.active) return 0

  // Parse dates as local dates to avoid timezone issues
  let subStart
  if (subscription.start_date) {
    const [year, month, day] = subscription.start_date.split('-').map(Number)
    subStart = new Date(year, month - 1, day)
  } else {
    subStart = new Date(subscription.created_at)
  }
  
  let subEnd = null
  if (subscription.next_billing_date) {
    const [year, month, day] = subscription.next_billing_date.split('-').map(Number)
    subEnd = new Date(year, month - 1, day)
  }

  // If subscription hasn't started yet, return 0
  if (subStart > endDate) return 0

  // Calculate the effective period
  const periodStart = subStart > startDate ? subStart : startDate
  const periodEnd = subEnd && subEnd < endDate ? subEnd : endDate

  if (periodStart >= periodEnd) return 0

  // Calculate billing periods
  const periods = getBillingPeriods(periodStart, periodEnd, subscription.frequency || 'month')
  
  // Calculate total cost
  const totalCost = subscription.amount * Math.max(1, periods)
  
  // Convert to target currency
  return convertCurrency(totalCost, subscription.currency || 'USD', targetCurrency)
}

/**
 * Calculate total subscription costs for current month
 */
export function calculateMonthlySubscriptionCost(subscriptions, currency) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return subscriptions.reduce((total, sub) => {
    return total + calculateSubscriptionCost(sub, startOfMonth, endOfMonth, currency)
  }, 0)
}

/**
 * Calculate total subscription costs for all time (based on start_date to now)
 */
export function calculateTotalSubscriptionCost(subscriptions, currency) {
  const now = new Date()
  const startOfTime = new Date(0) // Very old date

  return subscriptions.reduce((total, sub) => {
    return total + calculateSubscriptionCost(sub, startOfTime, now, currency)
  }, 0)
}

/**
 * Get next billing date based on frequency
 */
export function getNextBillingDate(startDate, frequency, currentDate = null) {
  // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
  const [year, month, day] = startDate.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const current = currentDate ? new Date(currentDate) : new Date()
  const next = new Date(start)

  while (next <= current) {
    switch (frequency) {
      case 'week':
        next.setDate(next.getDate() + 7)
        break
      case 'month':
        next.setMonth(next.getMonth() + 1)
        break
      case 'year':
        next.setFullYear(next.getFullYear() + 1)
        break
      default:
        next.setMonth(next.getMonth() + 1)
    }
  }

  // Return as YYYY-MM-DD string using local date
  const nextYear = next.getFullYear()
  const nextMonth = String(next.getMonth() + 1).padStart(2, '0')
  const nextDay = String(next.getDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}

