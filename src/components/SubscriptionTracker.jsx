import { useState } from 'react'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { updateSubscription } from '../lib/db'
import { format } from 'date-fns'
import './SubscriptionTracker.css'

export default function SubscriptionTracker({ subscriptions, transactions, currency, onUpdate }) {
  const [updating, setUpdating] = useState(null)

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

  if (subscriptions.length === 0 && Object.keys(potentialSubscriptions).length === 0) {
    return null
  }

  return (
    <div className="subscription-tracker-card">
      <div className="card-header">
        <h2>Subscriptions</h2>
      </div>

      {subscriptions.length > 0 && (
        <div className="subscriptions-list">
          {subscriptions.map(sub => {
            const amount = convertCurrency(sub.amount, sub.currency || 'USD', currency)
            return (
              <div key={sub.id} className="subscription-item">
                <div className="subscription-info">
                  <div className="subscription-name">{sub.name}</div>
                  <div className="subscription-details">
                    {formatCurrency(amount, currency)} / {sub.frequency || 'month'}
                  </div>
                </div>
                <button
                  className={`subscription-toggle ${sub.active ? 'active' : 'inactive'}`}
                  onClick={() => handleToggleSubscription(sub.id, sub.active)}
                  disabled={updating === sub.id}
                >
                  {updating === sub.id ? '...' : sub.active ? 'Active' : 'Inactive'}
                </button>
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
    </div>
  )
}

