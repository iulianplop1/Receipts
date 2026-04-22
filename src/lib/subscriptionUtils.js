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

  // For monthly subscriptions, charge once per month if the period covers any part of that month
  const frequency = subscription.frequency || 'month'
  
  if (frequency === 'month') {
    // Check if the period covers at least one day of a month - if so, charge for that month
    // For a monthly subscription, we charge the full monthly amount if the period overlaps with that month
    // This ensures that if a subscription started Oct 1 and we're calculating for October, November, or December,
    // each month gets charged once
    
    // Get the start and end months
    const startMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
    const endMonth = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
    
    // If start and end are in the same month, charge once
    if (startMonth.getTime() === endMonth.getTime()) {
      return convertCurrency(subscription.amount, subscription.currency || 'USD', targetCurrency)
    }
    
    // Calculate months difference - this gives us how many months to charge
    const monthsDiff = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                       (endMonth.getMonth() - startMonth.getMonth())
    
    // Charge for each month covered (at least 1)
    const periods = Math.max(1, monthsDiff + 1)
    const totalCost = subscription.amount * periods
    return convertCurrency(totalCost, subscription.currency || 'USD', targetCurrency)
  } else {
    // For other frequencies (week, year), use the existing calculation
    const periods = getBillingPeriods(periodStart, periodEnd, frequency)
    const totalCost = subscription.amount * Math.max(1, periods)
    return convertCurrency(totalCost, subscription.currency || 'USD', targetCurrency)
  }
}

/**
 * Calculate total subscription costs for a specific month
 * @param {Array} subscriptions - Array of subscription objects
 * @param {string} currency - Target currency
 * @param {Date} monthDate - Date object representing the month (defaults to current month)
 * @returns {number} Total subscription cost for the month
 */
export function calculateMonthlySubscriptionCost(subscriptions, currency, monthDate = null) {
  const targetDate = monthDate || new Date()
  const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
  const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0)
  // Set end of month to end of day
  endOfMonth.setHours(23, 59, 59, 999)

  return subscriptions.reduce((total, sub) => {
    // Check if subscription was active during this month
    let subStart
    if (sub.start_date) {
      const [year, month, day] = sub.start_date.split('-').map(Number)
      subStart = new Date(year, month - 1, day)
    } else {
      subStart = new Date(sub.created_at)
    }
    
    // If subscription hasn't started yet this month, skip it
    if (subStart > endOfMonth) return total
    
    // Check if subscription has ended before this month
    let subEnd = null
    if (sub.next_billing_date) {
      const [year, month, day] = sub.next_billing_date.split('-').map(Number)
      subEnd = new Date(year, month - 1, day)
      // If subscription ended before this month started, skip it
      if (subEnd < startOfMonth) return total
    }
    
    // For monthly subscriptions, charge the full monthly amount if active during this month
    if ((sub.frequency || 'month') === 'month') {
      // If subscription was active at any point during this month, charge the full monthly amount
      return total + convertCurrency(sub.amount, sub.currency || 'USD', currency)
    } else {
      // For other frequencies, use the period calculation
      return total + calculateSubscriptionCost(sub, startOfMonth, endOfMonth, currency)
    }
  }, 0)
}

/**
 * Calculate subscription costs for all months from start_date to current month
 * This ensures subscriptions are properly allocated to past months when added retroactively
 * @param {Object} subscription - Subscription object
 * @param {string} currency - Target currency
 * @returns {Array} Array of { month: Date, cost: number } objects
 */
export function calculateSubscriptionCostsByMonth(subscription, currency) {
  if (!subscription.active) return []
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Parse start_date
  let subStart
  if (subscription.start_date) {
    const [year, month, day] = subscription.start_date.split('-').map(Number)
    subStart = new Date(year, month - 1, day)
  } else {
    subStart = new Date(subscription.created_at)
  }
  
  // Parse end_date if exists
  let subEnd = null
  if (subscription.next_billing_date) {
    const [year, month, day] = subscription.next_billing_date.split('-').map(Number)
    subEnd = new Date(year, month - 1, day)
  }
  
  // If subscription hasn't started yet, return empty
  if (subStart > today) return []
  
  // Calculate costs for each month from start to today (or end date)
  const costsByMonth = []
  const current = new Date(subStart.getFullYear(), subStart.getMonth(), 1)
  const endDate = subEnd && subEnd < today ? subEnd : today
  
  while (current <= endDate) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)
    
    // Only include months where subscription was active
    const periodStart = subStart > monthStart ? subStart : monthStart
    const periodEnd = subEnd && subEnd < monthEnd ? subEnd : monthEnd
    
    if (periodStart <= periodEnd) {
      const cost = calculateSubscriptionCost(subscription, periodStart, periodEnd, currency)
      if (cost > 0) {
        costsByMonth.push({
          month: new Date(current.getFullYear(), current.getMonth(), 1),
          cost: cost
        })
      }
    }
    
    // Move to next month
    current.setMonth(current.getMonth() + 1)
  }
  
  return costsByMonth
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

