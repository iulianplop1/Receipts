import { useState, useMemo } from 'react'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { upsertBudget } from '../lib/db'
import { calculateMonthlySubscriptionCost } from '../lib/subscriptionUtils'
import { calculateMonthlyIncome } from '../lib/incomeUtils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format } from 'date-fns'
import './BudgetOverview.css'

const CATEGORY_COLORS = {
  Groceries: '#10B981',
  Restaurants: '#F59E0B',
  Transportation: '#3B82F6',
  Shopping: '#8B5CF6',
  Entertainment: '#EC4899',
  Bills: '#6366F1',
  Healthcare: '#EF4444',
  Education: '#14B8A6',
  'Personal Care': '#F97316',
  Subscriptions: '#06B6D4',
  Other: '#6B7280',
}

export default function BudgetOverview({ transactions, budgets, currency, onBudgetUpdate, userId, subscriptions = [], incomeList = [] }) {
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // Default to current month in YYYY-MM format
    const now = new Date()
    return `month:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Get available periods from transactions
  const availablePeriods = useMemo(() => {
    const periods = []
    const months = new Set()
    const years = new Set()
    
    transactions.forEach(t => {
      const date = new Date(t.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const yearKey = `${date.getFullYear()}`
      months.add(monthKey)
      years.add(yearKey)
    })
    
    // Add current month
    const now = new Date()
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    years.add(`${now.getFullYear()}`)
    
    // Add "All Time" option
    periods.push({ value: 'all', label: 'All Time' })
    
    // Add years
    Array.from(years).sort().reverse().forEach(year => {
      periods.push({ value: `year:${year}`, label: `Year ${year}` })
    })
    
    // Add months
    Array.from(months).sort().reverse().forEach(month => {
      const [year, monthNum] = month.split('-').map(Number)
      const monthDate = new Date(year, monthNum - 1, 1)
      periods.push({ value: `month:${month}`, label: format(monthDate, 'MMMM yyyy') })
    })
    
    return periods
  }, [transactions])

  // Filter transactions by selected period
  const filteredTransactions = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === 'all') return transactions
    
    const [periodType, periodValue] = selectedPeriod.split(':')
    
    if (periodType === 'year') {
      const year = parseInt(periodValue)
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
      
      return transactions.filter(t => {
        const tDate = new Date(t.date)
        return tDate >= startOfYear && tDate <= endOfYear
      })
    } else if (periodType === 'month') {
      const [year, month] = periodValue.split('-').map(Number)
      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)
      
      return transactions.filter(t => {
        const tDate = new Date(t.date)
        return tDate >= startOfMonth && tDate <= endOfMonth
      })
    }
    
    return transactions
  }, [transactions, selectedPeriod])

  // Calculate spending by category from filtered transactions
  const spendingByCategory = useMemo(() => {
    const spending = filteredTransactions.reduce((acc, t) => {
      const amount = convertCurrency(t.amount, t.currency || 'USD', currency)
      acc[t.category] = (acc[t.category] || 0) + amount
      return acc
    }, {})

    // Add subscription costs to Subscriptions category for selected period
    if (selectedPeriod && selectedPeriod !== 'all') {
      const [periodType, periodValue] = selectedPeriod.split(':')
      
      if (periodType === 'month') {
        const [year, month] = periodValue.split('-').map(Number)
        const monthDate = new Date(year, month - 1, 1)
        const monthlySubscriptionCost = calculateMonthlySubscriptionCost(subscriptions, currency, monthDate)
        if (monthlySubscriptionCost > 0) {
          spending['Subscriptions'] = (spending['Subscriptions'] || 0) + monthlySubscriptionCost
        }
      } else if (periodType === 'year') {
        const year = parseInt(periodValue)
        // Calculate subscription costs for all months in the year
        let yearlySubscriptionCost = 0
        for (let month = 0; month < 12; month++) {
          const monthDate = new Date(year, month, 1)
          yearlySubscriptionCost += calculateMonthlySubscriptionCost(subscriptions, currency, monthDate)
        }
        if (yearlySubscriptionCost > 0) {
          spending['Subscriptions'] = (spending['Subscriptions'] || 0) + yearlySubscriptionCost
        }
      }
    } else if (selectedPeriod === 'all') {
      // For "all time", calculate subscription costs for all months from earliest transaction to now
      if (transactions.length > 0) {
        const earliestDate = new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))
        const now = new Date()
        let allTimeSubscriptionCost = 0
        
        const current = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1)
        while (current <= now) {
          allTimeSubscriptionCost += calculateMonthlySubscriptionCost(subscriptions, currency, current)
          current.setMonth(current.getMonth() + 1)
        }
        
        if (allTimeSubscriptionCost > 0) {
          spending['Subscriptions'] = (spending['Subscriptions'] || 0) + allTimeSubscriptionCost
        }
      }
    }
    
    return spending
  }, [filteredTransactions, subscriptions, currency, selectedPeriod, transactions])

  // Calculate income for selected period
  const periodIncome = useMemo(() => {
    let income = 0
    
    if (selectedPeriod && selectedPeriod !== 'all') {
      const [periodType, periodValue] = selectedPeriod.split(':')
      
      if (periodType === 'month') {
        const [year, month] = periodValue.split('-').map(Number)
        const monthDate = new Date(year, month - 1, 1)
        income = calculateMonthlyIncome(incomeList, currency, monthDate)
      } else if (periodType === 'year') {
        const year = parseInt(periodValue)
        for (let month = 0; month < 12; month++) {
          const monthDate = new Date(year, month, 1)
          income += calculateMonthlyIncome(incomeList, currency, monthDate)
        }
      }
    } else if (selectedPeriod === 'all') {
      if (transactions.length > 0 || incomeList.length > 0) {
        const earliestDate = incomeList.length > 0 && transactions.length > 0
          ? new Date(Math.min(
              Math.min(...transactions.map(t => new Date(t.date).getTime())),
              Math.min(...incomeList.map(i => i.start_date ? new Date(i.start_date).getTime() : new Date(i.created_at).getTime()))
            ))
          : transactions.length > 0
          ? new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))
          : incomeList.length > 0
          ? new Date(Math.min(...incomeList.map(i => i.start_date ? new Date(i.start_date).getTime() : new Date(i.created_at).getTime())))
          : new Date()
        
        const now = new Date()
        const current = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1)
        while (current <= now) {
          income += calculateMonthlyIncome(incomeList, currency, current)
          current.setMonth(current.getMonth() + 1)
        }
      }
    }
    
    return income
  }, [incomeList, currency, selectedPeriod, transactions])

  // Calculate statistics for selected period
  const periodStats = useMemo(() => {
    const totalSpent = Object.values(spendingByCategory).reduce((sum, val) => sum + val, 0)
    
    let subscriptionCost = 0
    if (selectedPeriod && selectedPeriod !== 'all') {
      const [periodType, periodValue] = selectedPeriod.split(':')
      
      if (periodType === 'month') {
        const [year, month] = periodValue.split('-').map(Number)
        const monthDate = new Date(year, month - 1, 1)
        subscriptionCost = calculateMonthlySubscriptionCost(subscriptions, currency, monthDate)
      } else if (periodType === 'year') {
        const year = parseInt(periodValue)
        for (let month = 0; month < 12; month++) {
          const monthDate = new Date(year, month, 1)
          subscriptionCost += calculateMonthlySubscriptionCost(subscriptions, currency, monthDate)
        }
      }
    } else if (selectedPeriod === 'all') {
      if (transactions.length > 0) {
        const earliestDate = new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))
        const now = new Date()
        const current = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1)
        while (current <= now) {
          subscriptionCost += calculateMonthlySubscriptionCost(subscriptions, currency, current)
          current.setMonth(current.getMonth() + 1)
        }
      }
    }
    
    const transactionTotal = totalSpent - subscriptionCost
    const netAmount = periodIncome - totalSpent
    
    return {
      totalSpent,
      transactionTotal,
      subscriptionCost,
      transactionCount: filteredTransactions.length,
      income: periodIncome,
      netAmount
    }
  }, [spendingByCategory, subscriptions, currency, selectedPeriod, filteredTransactions, transactions, periodIncome])

  // Combine with budgets
  const budgetData = Object.entries(spendingByCategory).map(([category, spent]) => {
    const budget = budgets.find(b => b.category === category)
    const limit = budget ? convertCurrency(budget.amount, budget.currency || 'USD', currency) : null
    const percentage = limit ? (spent / limit) * 100 : null

    return {
      category,
      spent,
      limit,
      percentage: percentage ? Math.min(percentage, 100) : null,
      overBudget: percentage && percentage > 100,
    }
  }).sort((a, b) => b.spent - a.spent)

  const handleAddBudget = async (e) => {
    e.preventDefault()
    if (!newCategory || !newAmount) return

    try {
      await upsertBudget({
        user_id: userId,
        category: newCategory,
        amount: parseFloat(newAmount),
        currency: currency,
      })
      setNewCategory('')
      setNewAmount('')
      setShowAddBudget(false)
      onBudgetUpdate()
    } catch (error) {
      console.error('Error adding budget:', error)
      alert('Failed to add budget')
    }
  }

  return (
    <div className="budget-overview-card">
      <div className="card-header">
        <h2>Budget Overview</h2>
        <div className="header-controls">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="period-select"
          >
            {availablePeriods.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
          <button
            className="btn-link-small"
            onClick={() => setShowAddBudget(!showAddBudget)}
          >
            {showAddBudget ? 'Cancel' : '+ Add Budget'}
          </button>
        </div>
      </div>

      {/* Period Statistics */}
      <div className="period-statistics">
        {periodStats.income > 0 && (
          <div className="stat-item income-stat">
            <span className="stat-label">Income:</span>
            <span className="stat-value income-value">{formatCurrency(periodStats.income, currency)}</span>
          </div>
        )}
        <div className="stat-item">
          <span className="stat-label">Total Spent:</span>
          <span className="stat-value">{formatCurrency(periodStats.totalSpent, currency)}</span>
        </div>
        {periodStats.income > 0 && (
          <div className={`stat-item net-stat ${periodStats.netAmount >= 0 ? 'positive' : 'negative'}`}>
            <span className="stat-label">Net:</span>
            <span className="stat-value">{formatCurrency(periodStats.netAmount, currency)}</span>
          </div>
        )}
        <div className="stat-item">
          <span className="stat-label">Transactions:</span>
          <span className="stat-value">{periodStats.transactionCount}</span>
        </div>
        {periodStats.subscriptionCost > 0 && (
          <div className="stat-item">
            <span className="stat-label">Subscriptions:</span>
            <span className="stat-value">{formatCurrency(periodStats.subscriptionCost, currency)}</span>
          </div>
        )}
      </div>

      {showAddBudget && (
        <form onSubmit={handleAddBudget} className="add-budget-form">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            required
            className="form-input"
          >
            <option value="">Select Category</option>
            {Object.keys(spendingByCategory).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Budget amount"
            required
            className="form-input"
          />
          <button type="submit" className="btn-primary-small">Add</button>
        </form>
      )}

      {budgetData.length === 0 ? (
        <div className="empty-state">
          <p>No spending data yet. Add transactions to see your budget!</p>
        </div>
      ) : (
        <>
          <div className="budget-progress-list">
            {budgetData.slice(0, 5).map(item => {
              if (!item.limit) return null
              
              return (
                <div key={item.category} className="budget-item">
                  <div className="budget-header">
                    <span className="budget-category">{item.category}</span>
                    <span className={`budget-status ${item.overBudget ? 'over' : ''}`}>
                      {formatCurrency(item.spent, currency)} / {formatCurrency(item.limit, currency)}
                    </span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className={`progress-bar ${item.overBudget ? 'over' : ''}`}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                  {item.overBudget && (
                    <div className="over-budget-warning">
                      Over budget by {formatCurrency(item.spent - item.limit, currency)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="budget-chart">
            <h3 className="chart-title">Category Spending</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={budgetData.slice(0, 6)}>
                <XAxis
                  dataKey="category"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => formatCurrency(value, currency)}
                  contentStyle={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: '8px' }}
                />
                <Bar dataKey="spent" radius={[8, 8, 0, 0]}>
                  {budgetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Other} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

