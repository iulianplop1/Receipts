import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getTransactions, getBudgets, getSubscriptions } from '../lib/db'
import { generateInsights } from '../lib/gemini'
import { exportAllData } from '../lib/export'
import TransactionList from './TransactionList'
import BudgetOverview from './BudgetOverview'
import InsightsCard from './InsightsCard'
import AddExpenseButton from './AddExpenseButton'
import SearchBar from './SearchBar'
import SubscriptionTracker from './SubscriptionTracker'
import './Dashboard.css'

export default function Dashboard({ user }) {
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  useEffect(() => {
    loadData()
  }, [user])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportMenu && !event.target.closest('.export-menu-container')) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  const loadData = async () => {
    try {
      setLoading(true)
      const [txns, bdgs, subs] = await Promise.all([
        getTransactions(user.id),
        getBudgets(user.id),
        getSubscriptions(user.id),
      ])
      
      setTransactions(txns)
      setBudgets(bdgs)
      setSubscriptions(subs)
      
      // Set loading to false first to show the page quickly
      setLoading(false)

      // Generate insights asynchronously after initial render (non-blocking)
      if (txns.length > 0) {
        // Use setTimeout to defer insights generation to next event loop
        setTimeout(async () => {
          try {
            const insightsData = await generateInsights(txns)
            setInsights(insightsData.insights || [])
          } catch (error) {
            console.error('Error generating insights:', error)
            // Don't block the UI if insights fail
          }
        }, 0)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const handleTransactionAdded = () => {
    loadData()
    setShowAddModal(false)
  }

  const handleExport = (format) => {
    exportAllData(transactions, budgets, subscriptions, format)
    setShowExportMenu(false)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Budget Tracker</h1>
          <p className="header-subtitle">Welcome back, {user.email}</p>
        </div>
        <div className="header-actions">
          <div className="export-menu-container">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary export-btn"
              title="Export data"
            >
              📥 Export
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleExport('json')} className="export-option">
                  Export as JSON
                </button>
                <button onClick={() => handleExport('csv')} className="export-option">
                  Export as CSV
                </button>
              </div>
            )}
          </div>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="currency-select"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
            <option value="DKK">DKK</option>
          </select>
          <button onClick={handleSignOut} className="btn-secondary">
            Sign Out
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-main">
          <SearchBar transactions={transactions} />
          
          {insights.length > 0 && (
            <InsightsCard insights={insights} />
          )}

          <BudgetOverview
            transactions={transactions}
            budgets={budgets}
            currency={selectedCurrency}
            onBudgetUpdate={loadData}
            userId={user.id}
          />

          <SubscriptionTracker
            subscriptions={subscriptions}
            transactions={transactions}
            currency={selectedCurrency}
            onUpdate={loadData}
            userId={user.id}
          />

          <TransactionList
            transactions={transactions}
            currency={selectedCurrency}
            onUpdate={loadData}
          />
        </div>
      </div>

      <AddExpenseButton
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleTransactionAdded}
        userId={user.id}
      />
      
      <button
        className="fab"
        onClick={() => setShowAddModal(true)}
        aria-label="Add expense"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  )
}

