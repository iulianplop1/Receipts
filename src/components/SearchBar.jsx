import { useState } from 'react'
import { naturalLanguageSearch } from '../lib/gemini'
import './SearchBar.css'

export default function SearchBar({ transactions }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim() || transactions.length === 0) return

    setSearching(true)
    try {
      const searchResult = await naturalLanguageSearch(query, transactions)
      setResult(searchResult)
    } catch (error) {
      console.error('Search error:', error)
      setResult({ answer: 'Sorry, I encountered an error processing your query.' })
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="search-bar-card">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything: 'How much did I spend on groceries last month?'"
          className="search-input"
        />
        <button
          type="submit"
          className="search-button"
          disabled={searching || !query.trim()}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {result && (
        <div className="search-result">
          <p className="search-answer">{result.answer}</p>
        </div>
      )}
    </div>
  )
}

