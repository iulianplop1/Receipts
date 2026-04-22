import { convertCurrency } from './currency'

/**
 * Calculate income for a given period
 * @param {Object} income - Income object
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @param {string} targetCurrency - Currency to convert to
 * @returns {number} Total income for the period
 */
export function calculateIncomeAmount(income, startDate, endDate, targetCurrency) {
  if (!income.active) return 0

  // Parse dates as local dates to avoid timezone issues
  let incomeStart
  if (income.start_date) {
    const [year, month, day] = income.start_date.split('-').map(Number)
    incomeStart = new Date(year, month - 1, day)
  } else {
    incomeStart = new Date(income.created_at)
  }
  
  let incomeEnd = null
  if (income.end_date) {
    const [year, month, day] = income.end_date.split('-').map(Number)
    incomeEnd = new Date(year, month - 1, day)
  }

  // If income hasn't started yet, return 0
  if (incomeStart > endDate) return 0

  // Calculate the effective period
  const periodStart = incomeStart > startDate ? incomeStart : startDate
  const periodEnd = incomeEnd && incomeEnd < endDate ? incomeEnd : endDate

  if (periodStart >= periodEnd) return 0

  // For monthly income (salary), charge once per month if the period covers any part of that month
  const frequency = income.frequency || 'month'
  
  if (frequency === 'month') {
    // Get the start and end months
    const startMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
    const endMonth = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
    
    // If start and end are in the same month, charge once
    if (startMonth.getTime() === endMonth.getTime()) {
      return convertCurrency(income.amount, income.currency || 'USD', targetCurrency)
    }
    
    // Calculate months difference
    const monthsDiff = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                       (endMonth.getMonth() - startMonth.getMonth())
    
    // Charge for each month covered (at least 1)
    const periods = Math.max(1, monthsDiff + 1)
    const totalAmount = income.amount * periods
    return convertCurrency(totalAmount, income.currency || 'USD', targetCurrency)
  } else {
    // For other frequencies (week, year), calculate based on periods
    const diffTime = periodEnd - periodStart
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    let periods = 1
    switch (frequency) {
      case 'week':
        periods = Math.ceil(diffDays / 7)
        break
      case 'year':
        periods = Math.ceil(diffDays / 365)
        break
      default:
        periods = Math.ceil(diffDays / 30.44) // Default to monthly
    }
    
    const totalAmount = income.amount * Math.max(1, periods)
    return convertCurrency(totalAmount, income.currency || 'USD', targetCurrency)
  }
}

/**
 * Calculate total income for a specific month
 * @param {Array} incomeList - Array of income objects
 * @param {string} currency - Target currency
 * @param {Date} monthDate - Date object representing the month (defaults to current month)
 * @returns {number} Total income for the month
 */
export function calculateMonthlyIncome(incomeList, currency, monthDate = null) {
  const targetDate = monthDate || new Date()
  const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
  const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0)
  endOfMonth.setHours(23, 59, 59, 999)

  return incomeList.reduce((total, inc) => {
    // Check if income was active during this month
    let incStart
    if (inc.start_date) {
      const [year, month, day] = inc.start_date.split('-').map(Number)
      incStart = new Date(year, month - 1, day)
    } else {
      incStart = new Date(inc.created_at)
    }
    
    // If income hasn't started yet this month, skip it
    if (incStart > endOfMonth) return total
    
    // Check if income has ended before this month
    let incEnd = null
    if (inc.end_date) {
      const [year, month, day] = inc.end_date.split('-').map(Number)
      incEnd = new Date(year, month - 1, day)
      // If income ended before this month started, skip it
      if (incEnd < startOfMonth) return total
    }
    
    // For monthly income (salary), charge the full monthly amount if active during this month
    if ((inc.frequency || 'month') === 'month') {
      // If income was active at any point during this month, add the full monthly amount
      return total + convertCurrency(inc.amount, inc.currency || 'USD', currency)
    } else {
      // For other frequencies, use the period calculation
      return total + calculateIncomeAmount(inc, startOfMonth, endOfMonth, currency)
    }
  }, 0)
}

/**
 * Get next income payment date based on frequency
 */
export function getNextIncomeDate(startDate, frequency, currentDate = null) {
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

