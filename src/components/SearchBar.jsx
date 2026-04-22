import { useState, useMemo } from 'react'
import { naturalLanguageSearch } from '../lib/gemini'
import { formatCurrency, convertCurrency } from '../lib/currency'
import { format } from 'date-fns'
import './SearchBar.css'

export default function SearchBar({ transactions, subscriptions = [], budgets = [], currency = 'USD', onTransactionSelect }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState(null)
  const [searchMode, setSearchMode] = useState('purchases') // 'purchases' or 'ai'
  const [showResults, setShowResults] = useState(false)

  // Search transactions by item name, category, or amount
  const searchTransactions = useMemo(() => {
    if (!query.trim()) return []
    
    const searchTerm = query.toLowerCase().trim()
    return transactions.filter(t => {
      const itemMatch = t.item?.toLowerCase().includes(searchTerm)
      const categoryMatch = t.category?.toLowerCase().includes(searchTerm)
      const amountMatch = String(t.amount).includes(searchTerm)
      
      return itemMatch || categoryMatch || amountMatch
    }).slice(0, 10) // Limit to 10 results
  }, [query, transactions])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    if (searchMode === 'purchases') {
      setShowResults(true)
      return
    }

    // AI search mode
    setSearching(true)
    setShowResults(false)
    try {
      const searchResult = await naturalLanguageSearch(query, transactions, subscriptions, budgets, currency)
      setResult(searchResult)
    } catch (error) {
      console.error('Search error:', error)
      setResult({ answer: 'Sorry, I encountered an error processing your query.' })
    } finally {
      setSearching(false)
    }
  }

  const handleTransactionClick = (transaction) => {
    if (onTransactionSelect) {
      onTransactionSelect(transaction)
    }
    setQuery('')
    setShowResults(false)
  }

  return (
    <div className="search-bar-card">
      <div className="search-mode-toggle">
        <button
          type="button"
          className={`mode-btn ${searchMode === 'purchases' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('purchases')
            setResult(null)
            setShowResults(false)
          }}
        >
          🔍 Search Purchases
        </button>
        <button
          type="button"
          className={`mode-btn ${searchMode === 'ai' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('ai')
            setShowResults(false)
          }}
        >
          🤖 Ask AI
        </button>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (searchMode === 'purchases') {
                setShowResults(e.target.value.trim().length > 0)
              }
            }}
            placeholder={
              searchMode === 'purchases'
                ? "Search purchases by name, category, or amount..."
                : "Ask anything: 'How much did I spend on groceries last month?'"
            }
            className="search-input"
          />
          {query && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setQuery('')
                setShowResults(false)
                setResult(null)
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {searchMode === 'ai' && (
          <button
            type="submit"
            className="search-button"
            disabled={searching || !query.trim()}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        )}
      </form>

      {/* Purchase Search Results */}
      {searchMode === 'purchases' && showResults && (
        <div className="search-results">
          {searchTransactions.length > 0 ? (
            <>
              <div className="results-header">
                <span className="results-count">{searchTransactions.length} result{searchTransactions.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="transaction-results">
                {searchTransactions.map(transaction => {
                  const amount = convertCurrency(transaction.amount, transaction.currency || 'USD', currency)
                  const date = new Date(transaction.date)
                  return (
                    <div
                      key={transaction.id}
                      className="transaction-result-item"
                      onClick={() => handleTransactionClick(transaction)}
                    >
                      <div className="result-item-info">
                        <div className="result-item-name">{transaction.item}</div>
                        <div className="result-item-meta">
                          <span className="result-category">{transaction.category}</span>
                          <span className="result-date">{format(date, 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      <div className="result-item-amount">
                        {formatCurrency(amount, currency)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : query.trim() ? (
            <div className="no-results">
              <p>No purchases found matching "{query}"</p>
            </div>
          ) : null}
        </div>
      )}

      {/* AI Search Results */}
      {searchMode === 'ai' && result && (
        <div className="search-result">
          <p className="search-answer">{result.answer}</p>
        </div>
      )}
    </div>
  )
}

