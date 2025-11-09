import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getTransactions, getBudgets, getSubscriptions } from '../lib/db'
import { generateInsights } from '../lib/gemini'
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

  useEffect(() => {
    loadData()
  }, [user])

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

      // Generate insights
      if (txns.length > 0) {
        const insightsData = await generateInsights(txns)
        setInsights(insightsData.insights || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
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

