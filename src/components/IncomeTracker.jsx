import { useState } from 'react'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { updateIncome, addIncome, deleteIncome } from '../lib/db'
import { getNextIncomeDate } from '../lib/incomeUtils'
import { format } from 'date-fns'
import './IncomeTracker.css'

export default function IncomeTracker({ incomeList, currency, onUpdate, userId }) {
  const [updating, setUpdating] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newIncome, setNewIncome] = useState({
    name: '',
    amount: '',
    currency: 'DKK',
    frequency: 'month',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  })
  const [adding, setAdding] = useState(false)

  const handleToggleIncome = async (id, currentStatus) => {
    setUpdating(id)
    try {
      await updateIncome(id, { active: !currentStatus })
      onUpdate()
    } catch (error) {
      console.error('Error updating income:', error)
      alert('Failed to update income')
    } finally {
      setUpdating(null)
    }
  }

  const handleAddIncome = async (e) => {
    e.preventDefault()
    if (!newIncome.name || !newIncome.amount || !newIncome.start_date) {
      alert('Please fill in all required fields')
      return
    }

    setAdding(true)
    try {
      await addIncome({
        user_id: userId,
        name: newIncome.name,
        amount: parseFloat(newIncome.amount),
        currency: newIncome.currency,
        frequency: newIncome.frequency,
        start_date: newIncome.start_date,
        end_date: newIncome.end_date || null,
        active: true
      })
      setShowAddModal(false)
      setNewIncome({ 
        name: '', 
        amount: '', 
        currency: 'DKK', 
        frequency: 'month',
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
      })
      onUpdate()
    } catch (error) {
      console.error('Error adding income:', error)
      alert('Failed to add income')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteIncome = async (id) => {
    if (!window.confirm('Are you sure you want to delete this income source?')) {
      return
    }
    setUpdating(id)
    try {
      await deleteIncome(id)
      onUpdate()
    } catch (error) {
      console.error('Error deleting income:', error)
      alert('Failed to delete income')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="income-tracker-card">
      <div className="card-header">
        <h2>Income</h2>
        <button
          className="btn-add-income"
          onClick={() => setShowAddModal(true)}
        >
          + Add Income
        </button>
      </div>

      {incomeList.length > 0 && (
        <div className="income-list">
          {incomeList.map(inc => {
            const amount = convertCurrency(inc.amount, inc.currency || 'USD', currency)
            let startDate = 'Not set'
            if (inc.start_date) {
              const [year, month, day] = inc.start_date.split('-').map(Number)
              const start = new Date(year, month - 1, day)
              startDate = format(start, 'MMM d, yyyy')
            }
            return (
              <div key={inc.id} className="income-item">
                <div className="income-info">
                  <div className="income-name">{inc.name}</div>
                  <div className="income-details">
                    {formatCurrency(amount, currency)} / {inc.frequency || 'month'}
                  </div>
                  {inc.start_date && (
                    <div className="income-start-date">
                      Started: {startDate}
                    </div>
                  )}
                  {inc.end_date && (
                    <div className="income-end-date">
                      Ended: {format(new Date(inc.end_date), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
                <div className="income-actions">
                  <button
                    className={`income-toggle ${inc.active ? 'active' : 'inactive'}`}
                    onClick={() => handleToggleIncome(inc.id, inc.active)}
                    disabled={updating === inc.id}
                  >
                    {updating === inc.id ? '...' : inc.active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    className="income-delete"
                    onClick={() => handleDeleteIncome(inc.id)}
                    disabled={updating === inc.id}
                    title="Delete income"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {incomeList.length === 0 && (
        <div className="empty-state">
          <p>No income sources yet. Add your salary or other recurring income!</p>
        </div>
      )}

      {/* Add Income Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content income-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            <h2>Add Income</h2>
            <form onSubmit={handleAddIncome} className="income-form">
              <div className="form-field">
                <label>Income Source Name</label>
                <input
                  type="text"
                  value={newIncome.name}
                  onChange={(e) => setNewIncome({ ...newIncome, name: e.target.value })}
                  placeholder="e.g., Salary, Freelance"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newIncome.amount}
                    onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Currency</label>
                  <select
                    value={newIncome.currency}
                    onChange={(e) => setNewIncome({ ...newIncome, currency: e.target.value })}
                  >
                    <option value="DKK">DKK</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Frequency</label>
                  <select
                    value={newIncome.frequency}
                    onChange={(e) => setNewIncome({ ...newIncome, frequency: e.target.value })}
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
                    value={newIncome.start_date}
                    onChange={(e) => setNewIncome({ ...newIncome, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-field">
                <label>End Date (Optional)</label>
                <input
                  type="date"
                  value={newIncome.end_date}
                  onChange={(e) => setNewIncome({ ...newIncome, end_date: e.target.value })}
                  placeholder="Leave empty if ongoing"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Income'}
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

