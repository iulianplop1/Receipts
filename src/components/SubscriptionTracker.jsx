import { useState } from 'react'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { updateSubscription, addSubscription, deleteSubscription } from '../lib/db'
import { getNextBillingDate } from '../lib/subscriptionUtils'
import { format } from 'date-fns'
import './SubscriptionTracker.css'

export default function SubscriptionTracker({ subscriptions, transactions, currency, onUpdate, userId }) {
  const [updating, setUpdating] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSubscription, setNewSubscription] = useState({
    name: '',
    amount: '',
    currency: 'USD',
    frequency: 'month',
    start_date: new Date().toISOString().split('T')[0]
  })
  const [adding, setAdding] = useState(false)

  // Detect potential subscriptions from transactions
  const potentialSubscriptions = transactions
    .filter(t => t.category === 'Subscriptions')
    .reduce((acc, t) => {
      const key = t.item.toLowerCase()
      if (!acc[key]) {
        acc[key] = { name: t.item, count: 0, total: 0, lastDate: t.date }
      }
      acc[key].count++
      acc[key].total += convertCurrency(t.amount, t.currency || 'USD', currency)
      if (new Date(t.date) > new Date(acc[key].lastDate)) {
        acc[key].lastDate = t.date
      }
      return acc
    }, {})

  const handleToggleSubscription = async (id, currentStatus) => {
    setUpdating(id)
    try {
      await updateSubscription(id, { active: !currentStatus })
      onUpdate()
    } catch (error) {
      console.error('Error updating subscription:', error)
      alert('Failed to update subscription')
    } finally {
      setUpdating(null)
    }
  }

  const handleAddSubscription = async (e) => {
    e.preventDefault()
    if (!newSubscription.name || !newSubscription.amount || !newSubscription.start_date) {
      alert('Please fill in all required fields')
      return
    }

    setAdding(true)
    try {
      // Calculate next billing date
      const nextBillingDate = getNextBillingDate(
        newSubscription.start_date,
        newSubscription.frequency
      )

      await addSubscription({
        user_id: userId,
        name: newSubscription.name,
        amount: parseFloat(newSubscription.amount),
        currency: newSubscription.currency,
        frequency: newSubscription.frequency,
        start_date: newSubscription.start_date,
        next_billing_date: nextBillingDate,
        active: true
      })
      setShowAddModal(false)
      setNewSubscription({ 
        name: '', 
        amount: '', 
        currency: 'USD', 
        frequency: 'month',
        start_date: new Date().toISOString().split('T')[0]
      })
      onUpdate()
    } catch (error) {
      console.error('Error adding subscription:', error)
      alert('Failed to add subscription')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteSubscription = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subscription?')) {
      return
    }
    setUpdating(id)
    try {
      await deleteSubscription(id)
      onUpdate()
    } catch (error) {
      console.error('Error deleting subscription:', error)
      alert('Failed to delete subscription')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="subscription-tracker-card">
      <div className="card-header">
        <h2>Subscriptions</h2>
        <button
          className="btn-add-subscription"
          onClick={() => setShowAddModal(true)}
        >
          + Add Subscription
        </button>
      </div>

      {subscriptions.length > 0 && (
        <div className="subscriptions-list">
            {subscriptions.map(sub => {
            const amount = convertCurrency(sub.amount, sub.currency || 'USD', currency)
            // Parse date string as local date to avoid timezone shift
            let nextBilling = 'Not set'
            let daysUntilBilling = null
            if (sub.next_billing_date) {
              const [year, month, day] = sub.next_billing_date.split('-').map(Number)
              const billingDate = new Date(year, month - 1, day)
              nextBilling = format(billingDate, 'MMM d, yyyy')
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              billingDate.setHours(0, 0, 0, 0)
              daysUntilBilling = Math.ceil((billingDate - today) / (1000 * 60 * 60 * 24))
            }
            return (
              <div key={sub.id} className="subscription-item">
                <div className="subscription-info">
                  <div className="subscription-name">{sub.name}</div>
                  <div className="subscription-details">
                    {formatCurrency(amount, currency)} / {sub.frequency || 'month'}
                  </div>
                  {sub.next_billing_date && (
                    <div className="subscription-billing-date">
                      Next billing: {nextBilling}
                      {daysUntilBilling !== null && (
                        <span className={`billing-days ${daysUntilBilling <= 7 ? 'soon' : ''}`}>
                          {daysUntilBilling > 0 
                            ? ` (${daysUntilBilling} days)`
                            : daysUntilBilling === 0
                            ? ' (Today!)'
                            : ` (${Math.abs(daysUntilBilling)} days ago)`
                          }
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="subscription-actions">
                  <button
                    className={`subscription-toggle ${sub.active ? 'active' : 'inactive'}`}
                    onClick={() => handleToggleSubscription(sub.id, sub.active)}
                    disabled={updating === sub.id}
                  >
                    {updating === sub.id ? '...' : sub.active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    className="subscription-delete"
                    onClick={() => handleDeleteSubscription(sub.id)}
                    disabled={updating === sub.id}
                    title="Delete subscription"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {Object.keys(potentialSubscriptions).length > 0 && subscriptions.length === 0 && (
        <div className="potential-subscriptions">
          <p className="potential-title">Potential Subscriptions Detected:</p>
          {Object.values(potentialSubscriptions).map((sub, index) => (
            <div key={index} className="potential-item">
              <div>
                <div className="subscription-name">{sub.name}</div>
                <div className="subscription-details">
                  {sub.count} transactions • {formatCurrency(sub.total, currency)} total
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Subscription Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content subscription-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            <h2>Add Subscription</h2>
            <form onSubmit={handleAddSubscription} className="subscription-form">
              <div className="form-field">
                <label>Service Name</label>
                <input
                  type="text"
                  value={newSubscription.name}
                  onChange={(e) => setNewSubscription({ ...newSubscription, name: e.target.value })}
                  placeholder="e.g., Netflix"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSubscription.amount}
                    onChange={(e) => setNewSubscription({ ...newSubscription, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Currency</label>
                  <select
                    value={newSubscription.currency}
                    onChange={(e) => setNewSubscription({ ...newSubscription, currency: e.target.value })}
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
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Frequency</label>
                  <select
                    value={newSubscription.frequency}
                    onChange={(e) => setNewSubscription({ ...newSubscription, frequency: e.target.value })}
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                    <option value="week">Weekly</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={newSubscription.start_date}
                    onChange={(e) => setNewSubscription({ ...newSubscription, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Subscription'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

