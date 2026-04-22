/**
 * Export data to CSV format
 */
export function exportToCSV(data, filename = 'export') {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Handle values that might contain commas or quotes
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export data to JSON format
 */
export function exportToJSON(data, filename = 'export') {
  if (!data) {
    alert('No data to export')
    return
  }

  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.json`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export all user data (transactions, budgets, subscriptions)
 */
export function exportAllData(transactions, budgets, subscriptions, format = 'json') {
  const exportData = {
    exportDate: new Date().toISOString(),
    transactions: transactions || [],
    budgets: budgets || [],
    subscriptions: subscriptions || []
  }

  if (format === 'csv') {
    // Export each type as separate CSV files
    if (transactions.length > 0) {
      exportToCSV(transactions, 'transactions')
    }
    if (budgets.length > 0) {
      exportToCSV(budgets, 'budgets')
    }
    if (subscriptions.length > 0) {
      exportToCSV(subscriptions, 'subscriptions')
    }
  } else {
    exportToJSON(exportData, 'budget-tracker-export')
  }
}

