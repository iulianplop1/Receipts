import { useState } from 'react'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { format } from 'date-fns'
import { deleteTransaction } from '../lib/db'
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

export default function TransactionList({ transactions, currency, onUpdate }) {
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')

  const categories = [...new Set(transactions.map(t => t.category))]

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true
    return t.category === filter
  })

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date) - new Date(a.date)
    }
    if (sortBy === 'amount') {
      return b.amount - a.amount
    }
    return 0
  })

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

  const totalSpent = sortedTransactions.reduce((sum, t) => {
    return sum + convertCurrency(t.amount, t.currency || 'USD', currency)
  }, 0)

  return (
    <div className="transaction-list-card">
      <div className="card-header">
        <h2>Transactions</h2>
        <div className="card-controls">
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
            Total: {formatCurrency(totalSpent, currency)}
          </div>
          <div className="transaction-list">
            {sortedTransactions.map(transaction => {
              const amount = convertCurrency(
                transaction.amount,
                transaction.currency || 'USD',
                currency
              )
              const categoryColor = CATEGORY_COLORS[transaction.category] || CATEGORY_COLORS.Other

              return (
                <div key={transaction.id} className="transaction-item">
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
                          {format(new Date(transaction.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="transaction-amount">
                    {formatCurrency(amount, currency)}
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(transaction.id)}
                      aria-label="Delete transaction"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

