import { useState, useMemo } from 'react'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { calculateMonthlySubscriptionCost } from '../lib/subscriptionUtils'
import { format } from 'date-fns'
import { deleteTransaction, updateTransaction } from '../lib/db'
import './TransactionList.css'

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

export default function TransactionList({ transactions, currency, onUpdate, subscriptions = [] }) {
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [viewingImage, setViewingImage] = useState(null)

  const categories = [...new Set(transactions.map(t => t.category))]

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

  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(t => {
      // Category filter
      if (filter !== 'all' && t.category !== filter) return false
      
      // Period filter
      if (periodFilter !== 'all') {
        const [periodType, periodValue] = periodFilter.split(':')
        
        if (periodType === 'year') {
          const year = parseInt(periodValue)
          const tDate = new Date(t.date)
          if (tDate.getFullYear() !== year) return false
        } else if (periodType === 'month') {
          const [year, month] = periodValue.split('-').map(Number)
          const tDate = new Date(t.date)
          const tYear = tDate.getFullYear()
          const tMonth = tDate.getMonth() + 1
          if (tYear !== year || tMonth !== month) return false
        }
      }
      
      return true
    })

    // Sort
    return [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date) - new Date(a.date)
      }
      if (sortBy === 'amount') {
        return b.amount - a.amount
      }
      if (sortBy === 'month') {
        const aDate = new Date(a.date)
        const bDate = new Date(b.date)
        const aMonth = `${aDate.getFullYear()}-${String(aDate.getMonth() + 1).padStart(2, '0')}`
        const bMonth = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}`
        return bMonth.localeCompare(aMonth)
      }
      return 0
    })
  }, [transactions, filter, periodFilter, sortBy])

  const sortedTransactions = filteredTransactions

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(id)
        onUpdate()
      } catch (error) {
        console.error('Error deleting transaction:', error)
        alert('Failed to delete transaction')
      }
    }
  }

  const handleEdit = (transaction) => {
    setEditingId(transaction.id)
    // Handle date conversion properly to avoid timezone issues
    let dateStr = ''
    if (transaction.date) {
      const date = new Date(transaction.date)
      // Use local date to avoid timezone shift
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      dateStr = `${year}-${month}-${day}`
    } else {
      dateStr = new Date().toISOString().split('T')[0]
    }
    
    setEditForm({
      item: transaction.item,
      amount: transaction.amount,
      category: transaction.category,
      date: dateStr,
      currency: transaction.currency || 'USD'
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSaveEdit = async (id) => {
    try {
      // Convert date string to ISO string at local midnight to avoid timezone shift
      const dateStr = editForm.date
      const [year, month, day] = dateStr.split('-').map(Number)
      const localDate = new Date(year, month - 1, day)
      const isoString = localDate.toISOString()
      
      await updateTransaction(id, {
        item: editForm.item,
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        date: isoString,
        currency: editForm.currency
      })
      setEditingId(null)
      setEditForm({})
      onUpdate()
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Failed to update transaction')
    }
  }

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  // Calculate total from transactions
  const transactionTotal = sortedTransactions.reduce((sum, t) => {
    return sum + convertCurrency(t.amount, t.currency || 'USD', currency)
  }, 0)

  // Add subscription costs for current month
  const monthlySubscriptionCost = calculateMonthlySubscriptionCost(subscriptions, currency)
  const totalSpent = transactionTotal + monthlySubscriptionCost

  return (
    <div className="transaction-list-card">
      <div className="card-header">
        <h2>Transactions</h2>
        <div className="card-controls">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="filter-select"
          >
            {availablePeriods.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="month">Sort by Month</option>
          </select>
        </div>
      </div>

      {sortedTransactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions yet. Add your first expense!</p>
        </div>
      ) : (
        <>
          <div className="total-spent">
            <div className="total-breakdown">
              <div>Transactions: {formatCurrency(transactionTotal, currency)}</div>
              {monthlySubscriptionCost > 0 && (
                <div className="subscription-cost">
                  Subscriptions (this month): {formatCurrency(monthlySubscriptionCost, currency)}
                </div>
              )}
              <div className="total-amount">Total: {formatCurrency(totalSpent, currency)}</div>
            </div>
          </div>
          <div className="transaction-list">
            {sortedTransactions.map(transaction => {
              const amount = convertCurrency(
                transaction.amount,
                transaction.currency || 'USD',
                currency
              )
              const categoryColor = CATEGORY_COLORS[transaction.category] || CATEGORY_COLORS.Other

              const isEditing = editingId === transaction.id

              return (
                <div key={transaction.id} className="transaction-item">
                  {isEditing ? (
                    <div className="edit-form">
                      <div className="edit-form-row">
                        <input
                          type="text"
                          value={editForm.item}
                          onChange={(e) => handleEditFormChange('item', e.target.value)}
                          placeholder="Item name"
                          className="edit-input"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) => handleEditFormChange('amount', e.target.value)}
                          placeholder="Amount"
                          className="edit-input"
                        />
                      </div>
                      <div className="edit-form-row">
                        <select
                          value={editForm.category}
                          onChange={(e) => handleEditFormChange('category', e.target.value)}
                          className="edit-select"
                        >
                          <option>Groceries</option>
                          <option>Restaurants</option>
                          <option>Transportation</option>
                          <option>Shopping</option>
                          <option>Entertainment</option>
                          <option>Bills</option>
                          <option>Healthcare</option>
                          <option>Education</option>
                          <option>Personal Care</option>
                          <option>Subscriptions</option>
                          <option>Other</option>
                        </select>
                        <select
                          value={editForm.currency || 'USD'}
                          onChange={(e) => handleEditFormChange('currency', e.target.value)}
                          className="edit-select"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="JPY">JPY</option>
                          <option value="CAD">CAD</option>
                          <option value="AUD">AUD</option>
                          <option value="DKK">DKK</option>
                        </select>
                      </div>
                      <div className="edit-form-row">
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(e) => handleEditFormChange('date', e.target.value)}
                          className="edit-input"
                        />
                      </div>
                      <div className="edit-form-actions">
                        <button
                          className="save-btn"
                          onClick={() => handleSaveEdit(transaction.id)}
                        >
                          Save
                        </button>
                        <button
                          className="cancel-btn"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="transaction-main">
                        <div
                          className="category-indicator"
                          style={{ backgroundColor: categoryColor }}
                        />
                        <div className="transaction-info">
                          <div className="transaction-name">{transaction.item}</div>
                          <div className="transaction-meta">
                            <span className="transaction-category">{transaction.category}</span>
                            <span className="transaction-date">
                              {(() => {
                                // Parse date as local to avoid timezone shift
                                const date = new Date(transaction.date)
                                const year = date.getFullYear()
                                const month = date.getMonth()
                                const day = date.getDate()
                                return format(new Date(year, month, day), 'MMM d, yyyy')
                              })()}
                            </span>
                          </div>
                        </div>
                        {transaction.receipt_image_url && (
                          <button
                            className="receipt-thumbnail-btn"
                            onClick={() => setViewingImage(transaction.receipt_image_url)}
                            title="View receipt"
                          >
                            <img
                              src={transaction.receipt_image_url}
                              alt="Receipt"
                              className="receipt-thumbnail"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          </button>
                        )}
                      </div>
                      <div className="transaction-amount">
                        {formatCurrency(amount, currency)}
                        <div className="transaction-actions">
                          <button
                            className="edit-btn"
                            onClick={() => handleEdit(transaction)}
                            aria-label="Edit transaction"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => handleDelete(transaction.id)}
                            aria-label="Delete transaction"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Receipt Image Modal */}
      {viewingImage && (
        <div className="image-modal-overlay" onClick={() => setViewingImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setViewingImage(null)}>×</button>
            <img src={viewingImage} alt="Receipt" className="receipt-full-image" />
          </div>
        </div>
      )}
    </div>
  )
}

