import './InsightsCard.css'

export default function InsightsCard({ insights }) {
  if (!insights || insights.length === 0) return null

  const getIcon = (type) => {
    switch (type) {
      case 'spending_increase':
        return '📈'
      case 'spending_decrease':
        return '📉'
      case 'new_subscription':
        return '🔄'
      case 'budget_warning':
        return '⚠️'
      default:
        return '💡'
    }
  }

  const getColor = (type) => {
    switch (type) {
      case 'spending_increase':
      case 'budget_warning':
        return 'var(--warning)'
      case 'spending_decrease':
        return 'var(--success)'
      default:
        return 'var(--primary)'
    }
  }

  return (
    <div className="insights-card">
      <h2 className="insights-title">AI Insights</h2>
      <div className="insights-list">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="insight-item"
            style={{ borderLeftColor: getColor(insight.type) }}
          >
            <span className="insight-icon">{getIcon(insight.type)}</span>
            <p className="insight-message">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

