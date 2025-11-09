import { useState } from 'react'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { upsertBudget } from '../lib/db'
import { calculateMonthlySubscriptionCost } from '../lib/subscriptionUtils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
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

export default function BudgetOverview({ transactions, budgets, currency, onBudgetUpdate, userId, subscriptions = [] }) {
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // Calculate spending by category from transactions
  const spendingByCategory = transactions.reduce((acc, t) => {
    const amount = convertCurrency(t.amount, t.currency || 'USD', currency)
    acc[t.category] = (acc[t.category] || 0) + amount
    return acc
  }, {})

  // Add subscription costs to Subscriptions category
  const monthlySubscriptionCost = calculateMonthlySubscriptionCost(subscriptions, currency)
  if (monthlySubscriptionCost > 0) {
    spendingByCategory['Subscriptions'] = (spendingByCategory['Subscriptions'] || 0) + monthlySubscriptionCost
  }

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
        <button
          className="btn-link-small"
          onClick={() => setShowAddBudget(!showAddBudget)}
        >
          {showAddBudget ? 'Cancel' : '+ Add Budget'}
        </button>
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
            <h3 className="chart-title">Weekly Spending</h3>
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

