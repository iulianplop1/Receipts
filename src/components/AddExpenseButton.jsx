import { useState, useRef, useMemo } from 'react'
import { analyzeReceipt, parseTextInput, parseTranscribedAudio } from '../lib/gemini'
import { addTransaction } from '../lib/db'
import { uploadReceiptImage } from '../lib/storage'
import RecordRTC from 'recordrtc'
import './AddExpenseButton.css'

export default function AddExpenseButton({ show, onClose, onAdd, userId }) {
  const [mode, setMode] = useState('select') // select, photo, audio, text, review
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reviewItems, setReviewItems] = useState([])
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [receiptFiles, setReceiptFiles] = useState([]) // [{ id, file, name, index }]
  const [bulkDate, setBulkDate] = useState('')
  
  const fileInputRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptionRef = useRef('')
  const audioBlobRef = useRef(null) // Store blob in ref to prevent loss

  const receiptSummaries = useMemo(() => summarizeReviewItemsByReceipt(reviewItems), [reviewItems])

  const handlePhotoUpload = async (e) => {
    const filesArray = Array.from(e.target.files || [])
    if (filesArray.length === 0) return

    const filesWithMeta = createReceiptFileEntries(filesArray)

    setLoading(true)
    setError('')

    try {
      const collectedItems = []

      for (const fileEntry of filesWithMeta) {
        const { file } = fileEntry
        try {
          const result = await analyzeReceipt(file)
          const rawItems = Array.isArray(result?.items)
            ? result.items
            : Array.isArray(result)
              ? result
              : []

          const receiptDate = normalizeDateValue(result?.date || '')
          const normalizedItems = transformReceiptItems(rawItems, receiptDate, fileEntry)

          if (normalizedItems.length === 0) {
            console.warn(`No valid items found in ${file.name}`)
          }

          collectedItems.push(...normalizedItems)
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError)
          // Continue with other files even if one fails
        }
      }
      
      if (collectedItems.length === 0) {
        setError('No valid items found in the receipts. Please make sure the images contain valid purchase items.')
        setLoading(false)
        return
      }
      
      setReceiptFiles(filesWithMeta)
      setReviewItems(collectedItems)
      setBulkDate(collectedItems[0]?.date || getTodayDateString())
      setMode('review')
    } catch (err) {
      const errorMsg = err.message || 'Failed to analyze receipt. Please try again.'
      if (errorMsg.includes('overloaded')) {
        setError('The AI service is currently busy. Please wait a moment and try again.')
      } else {
        setError(errorMsg)
      }
      console.error(err)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setLoading(false)
    }
  }

  const handleTextSubmit = async (text) => {
    if (!text.trim()) return

    setLoading(true)
    setError('')

    try {
      const result = await parseTextInput(text)
      const preparedItems = transformReceiptItems(result?.items || [], getTodayDateString())

      if (preparedItems.length === 0) {
        setError('No valid items were found in the provided text. Please include at least one item with a positive amount.')
        return
      }

      setReceiptFiles([])
      setReviewItems(preparedItems)
      setBulkDate(preparedItems[0]?.date || getTodayDateString())
      setMode('review')
    } catch (err) {
      setError('Failed to parse text. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    try {
      setError('')
      setRecordingTime(0)
      transcriptionRef.current = ''
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      streamRef.current = stream
      
      // Create recorder using RecordRTC (works in all browsers)
      // Let RecordRTC choose the best format for the browser
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm;codecs=opus', // Prefer WebM Opus for best compatibility
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        timeSlice: 1000,
        // Fallback options for better cross-browser support
        audioBitsPerSecond: 128000,
        desiredSampRate: 48000, // 48kHz for better quality
        bufferSize: 4096
      })
      
      recorderRef.current = recorder
      recorder.startRecording()
      
      // Start Web Speech API if available (Chrome/Edge) for transcription
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
          // Accumulate all results
          let transcript = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' '
          }
          transcriptionRef.current += transcript
        }

        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error)
          // Don't stop recording on error, just log it
        }

        recognition.onend = () => {
          // If we still have the stream, restart recognition (it auto-stops after silence)
          if (streamRef.current && streamRef.current.active) {
            try {
              recognition.start()
            } catch (e) {
              // Recognition might already be started or stopped
              console.log('Recognition restart skipped:', e.message)
            }
          }
        }

        recognitionRef.current = recognition
        recognition.start()
      }
      
      setRecording(true)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
    } catch (err) {
      setError('Failed to access microphone. Please check permissions and try again.')
      console.error(err)
      setRecording(false)
    }
  }

  const stopRecording = async () => {
    if (!recorderRef.current || !recording) return
    
    try {
      setLoading(true)
      setError('')
      
      // Stop Web Speech API if active
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      
      // Stop the recorder
      recorderRef.current.stopRecording(async () => {
        // Get the audio blob
        const blob = recorderRef.current.getBlob()
        console.log('Audio blob created:', blob.type, blob.size, 'bytes')
        
        // Store in both state and ref
        setAudioBlob(blob)
        audioBlobRef.current = blob
        setRecording(false)
        
        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
        
        // Process transcription
        await processTranscription()
      })
    } catch (err) {
      setError('Failed to stop recording. Please try again.')
      console.error(err)
      setRecording(false)
      setLoading(false)
    }
  }

  const processTranscription = async () => {
    try {
      let transcription = transcriptionRef.current.trim()
      
      // Get blob from ref if state is lost
      const blobToUse = audioBlob || audioBlobRef.current
      
      console.log('Processing transcription:', {
        hasAudioBlob: !!audioBlob,
        hasBlobRef: !!audioBlobRef.current,
        blobToUse: !!blobToUse,
        blobType: blobToUse?.type,
        blobSize: blobToUse?.size,
        hasTranscription: !!transcription
      })
      
      // Use Gemini's audio transcription - works on all browsers!
      if (blobToUse) {
        try {
          // Import Gemini audio transcription function
          const { transcribeAndParseAudioWithGemini, parseTranscribedAudio } = await import('../lib/gemini')
          
          console.log('Starting Gemini audio transcription...')
          
          // Try Gemini audio transcription first (transcribes and parses in one step)
          try {
            const result = await transcribeAndParseAudioWithGemini(blobToUse)
            console.log('Gemini transcription result:', result)
            
            if (result && Array.isArray(result.items) && result.items.length > 0) {
              const preparedItems = transformReceiptItems(result.items, getTodayDateString())
              
              if (preparedItems.length === 0) {
                throw new Error('No items extracted from audio')
              }

              setReceiptFiles([])
              setReviewItems(preparedItems)
              setBulkDate(preparedItems[0]?.date || getTodayDateString())
              setMode('review')
              setAudioBlob(null)
              audioBlobRef.current = null
              setLoading(false)
              return
            } else {
              throw new Error('No items extracted from audio')
            }
          } catch (geminiError) {
            console.error('Gemini audio transcription failed:', geminiError)
            console.error('Error details:', {
              message: geminiError.message,
              stack: geminiError.stack,
              name: geminiError.name
            })
            
            // Fallback: If we have Web Speech API transcription, use it
            if (transcription && transcription.trim()) {
              console.log('Trying Web Speech API transcription as fallback...')
              try {
                const result = await parseTranscribedAudio(transcription)
                const preparedItems = transformReceiptItems(result?.items || [], getTodayDateString())
                
                if (preparedItems.length === 0) {
                  throw new Error('No items extracted from audio transcription')
                }

                setReceiptFiles([])
                setReviewItems(preparedItems)
                setBulkDate(preparedItems[0]?.date || getTodayDateString())
                setMode('review')
                setAudioBlob(null)
                audioBlobRef.current = null
                setLoading(false)
                return
              } catch (parseError) {
                console.error('Error parsing Web Speech transcription:', parseError)
              }
            }
            
            // Both methods failed - show helpful error
            const errorMsg = geminiError.message || 'Transcription failed'
            setError(`Audio transcription failed: ${errorMsg}. Please check the browser console for details, or type your expense manually.`)
            setMode('text')
            setLoading(false)
            return
          }
        } catch (importError) {
          console.error('Error importing transcription:', importError)
          
          // Fallback: If we have Web Speech API transcription, use it
          if (transcription && transcription.trim()) {
            try {
              const { parseTranscribedAudio } = await import('../lib/gemini')
              const result = await parseTranscribedAudio(transcription)
              const preparedItems = transformReceiptItems(result?.items || [], getTodayDateString())

              if (preparedItems.length === 0) {
                throw new Error('No items extracted from audio transcription')
              }

              setReceiptFiles([])
              setReviewItems(preparedItems)
              setBulkDate(preparedItems[0]?.date || getTodayDateString())
              setMode('review')
              setAudioBlob(null)
              audioBlobRef.current = null
              setLoading(false)
              return
            } catch (parseError) {
              console.error('Error parsing Web Speech transcription:', parseError)
            }
          }
          
          setError('Transcription service unavailable. Please type your expense.')
          setMode('text')
          setLoading(false)
        }
      } else if (transcription && transcription.trim()) {
        // No audio blob but we have Web Speech API transcription
        try {
          const { parseTranscribedAudio } = await import('../lib/gemini')
          const result = await parseTranscribedAudio(transcription)
          const preparedItems = transformReceiptItems(result?.items || [], getTodayDateString())

          if (preparedItems.length === 0) {
            throw new Error('No items extracted from audio transcription')
          }

          setReceiptFiles([])
          setReviewItems(preparedItems)
          setBulkDate(preparedItems[0]?.date || getTodayDateString())
          setMode('review')
          setAudioBlob(null)
          audioBlobRef.current = null
          setLoading(false)
        } catch (parseError) {
          console.error('Error parsing Web Speech transcription:', parseError)
          setError('Failed to parse transcription. Please type your expense manually.')
          setMode('text')
          setLoading(false)
        }
      } else {
        console.error('No audio blob or transcription available')
        setError('No audio recorded. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      console.error('Unexpected error in processTranscription:', err)
      setError('Failed to process transcription. Please try typing your expense instead.')
      setLoading(false)
    }
  }

  const handleReviewEdit = (index, field, value) => {
    const updated = [...reviewItems]
    let nextValue = value

    if (field === 'date') {
      nextValue = value ? normalizeDateValue(value) : ''
    }

    updated[index] = { ...updated[index], [field]: nextValue }
    setReviewItems(updated)
  }

  const applyBulkDateToItems = (value) => {
    const normalized = normalizeDateValue(value || bulkDate || getTodayDateString())
    setReviewItems(prev => prev.map(item => ({ ...item, date: normalized })))
    return normalized
  }

  const handleBulkDateChange = (value) => {
    if (!value) {
      setBulkDate('')
      return
    }

    const normalized = applyBulkDateToItems(value)
    setBulkDate(normalized)
  }

  const handleBulkDateApply = () => {
    if (!bulkDate) {
      const normalized = applyBulkDateToItems(getTodayDateString())
      setBulkDate(normalized)
      return
    }

    applyBulkDateToItems(bulkDate)
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError('')

    try {
      const uploadedReceiptUrls = new Map()

      for (const item of reviewItems) {
        const normalizedDate = normalizeDateValue(item.date || bulkDate || getTodayDateString())

        const [year, month, day] = normalizedDate.split('-').map(Number)
        const localDate = new Date(year, month - 1, day)
        const itemDate = localDate.toISOString()

        const parsedAmount = parseFloat(item.amount)
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          setError('Each item must have a positive amount before saving.')
          return
        }

        let receiptImageUrl = null
        const receiptKey = getReceiptFileKey(item)
        const receiptFile = getReceiptFileForItem(item, receiptFiles)

        if (receiptKey && receiptFile) {
          if (uploadedReceiptUrls.has(receiptKey)) {
            receiptImageUrl = uploadedReceiptUrls.get(receiptKey)
          } else {
            try {
              const uploadedUrl = await uploadReceiptImage(receiptFile, userId)
              uploadedReceiptUrls.set(receiptKey, uploadedUrl)
              receiptImageUrl = uploadedUrl
            } catch (uploadError) {
              console.warn('Receipt image upload failed (transaction will still be saved):', uploadError.message)
            }
          }
        }

        await addTransaction({
          user_id: userId,
          item: item.item,
          amount: parsedAmount,
          category: item.category || 'Other',
          currency: item.currency || 'DKK',
          date: itemDate,
          receipt_image_url: receiptImageUrl,
        })
      }
      handleClose()
      onAdd()
    } catch (err) {
      setError('Failed to save transactions. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Stop recording if active
    if (recording && recorderRef.current) {
      recorderRef.current.stopRecording()
    }
    
    // Stop Web Speech API if active
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    
    // Stop stream if active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    setMode('select')
    setReviewItems([])
    setError('')
    setRecording(false)
    setAudioBlob(null)
    audioBlobRef.current = null
    setRecordingTime(0)
    transcriptionRef.current = ''
    setReceiptFiles([])
    setBulkDate('')
    onClose()
  }
  
  // Format recording time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!show) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>×</button>

        {mode === 'select' && (
          <div className="add-expense-select">
            <h2>Add Expense</h2>
            <p className="modal-subtitle">Choose how you want to add an expense</p>
            
            <div className="mode-buttons">
              <button
                className="mode-button"
                onClick={() => {
                  fileInputRef.current?.click()
                }}
              >
                <span className="mode-icon">📸</span>
                <span className="mode-label">Scan Receipt(s)</span>
              </button>
              
              <button
                className="mode-button"
                onClick={() => setMode('audio')}
              >
                <span className="mode-icon">🎤</span>
                <span className="mode-label">Record Audio</span>
              </button>
              
              <button
                className="mode-button"
                onClick={() => setMode('text')}
              >
                <span className="mode-icon">✍️</span>
                <span className="mode-label">Type Text</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {mode === 'text' && (
          <div className="add-expense-text">
            <h2>Type Your Expense</h2>
            <p className="modal-subtitle">Example: "coffee 4.50" or "spent 2 dollars on a banana"</p>
            
            <TextInputForm onSubmit={handleTextSubmit} loading={loading} />
            
            {error && <div className="error-message">{error}</div>}
            
            <button className="btn-secondary" onClick={() => setMode('select')}>
              Back
            </button>
          </div>
        )}

        {mode === 'audio' && (
          <div className="add-expense-audio">
            <h2>Record Audio</h2>
            <p className="modal-subtitle">Say something like "I spent 2 dollars on a banana"</p>
            
            <div className="audio-recorder">
              {!recording && !audioBlob && (
                <button
                  className="record-button"
                  onClick={startRecording}
                  disabled={loading}
                >
                  🎤 Start Recording
                </button>
              )}
              
              {recording && (
                <div className="recording-status">
                  <div className="recording-indicator"></div>
                  <p>Recording... {formatTime(recordingTime)}</p>
                  <p className="recording-hint">Speak your expense clearly, then click Stop</p>
                  <button
                    className="stop-button"
                    onClick={stopRecording}
                  >
                    Stop Recording
                  </button>
                </div>
              )}
              
              {audioBlob && !recording && (
                <div className="audio-preview">
                  <p>✅ Audio recorded successfully!</p>
                  <p className="audio-hint">Processing transcription...</p>
                  {loading && (
                    <div className="processing-spinner">
                      <div className="spinner-small"></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}
            
            <button className="btn-secondary" onClick={() => setMode('select')}>
              Back
            </button>
          </div>
        )}

        {mode === 'review' && (
          <div className="add-expense-review">
            <h2>Review & Confirm</h2>
            <p className="modal-subtitle">We found {reviewItems.length} item(s). Please review and confirm.</p>

            <div className="bulk-date-controls">
              <div className="bulk-date-meta">
                <label htmlFor="bulk-date-input">Receipt date for all items</label>
                <small>Update once and sync every line item</small>
              </div>
              <div className="bulk-date-actions">
                <input
                  id="bulk-date-input"
                  type="date"
                  value={bulkDate || ''}
                  onChange={(e) => handleBulkDateChange(e.target.value)}
                />
                <button
                  type="button"
                  className="bulk-date-apply"
                  onClick={handleBulkDateApply}
                >
                  Apply
                </button>
              </div>
            </div>

            {receiptSummaries.length > 0 && (
              <div className="receipt-summary-grid">
                {receiptSummaries.map((receipt) => (
                  <div key={receipt.key} className="receipt-summary-card">
                    <div className="receipt-summary-header">
                      <span className="receipt-chip">
                        📄 {receipt.name}
                      </span>
                      <span className="receipt-hint">Grouped by matching line items</span>
                    </div>
                    <div className="receipt-summary-table">
                      <div className="receipt-summary-row receipt-summary-head">
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Unit price</span>
                        <span>Total</span>
                      </div>
                      {receipt.entries.map((entry) => (
                        <div key={`${receipt.key}-${entry.name}-${entry.currency}`} className="receipt-summary-row">
                          <span>{entry.name}</span>
                          <span>x{entry.quantity}</span>
                          <span>{formatAmountDisplay(entry.unitPrice, entry.currency)}</span>
                          <span>{formatAmountDisplay(entry.total, entry.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="review-items">
              {reviewItems.map((item, index) => (
                <div key={index} className="review-item">
                  {item.receiptFileName && (
                    <div className="review-item-header">
                      <span className="receipt-chip" title={item.receiptFileName}>
                        📎 {item.receiptFileName}
                      </span>
                    </div>
                  )}
                  <div className="review-field">
                    <label>Item</label>
                    <input
                      type="text"
                      value={item.item}
                      onChange={(e) => handleReviewEdit(index, 'item', e.target.value)}
                    />
                  </div>
                  
                  <div className="review-field">
                    <label>Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => handleReviewEdit(index, 'amount', e.target.value)}
                    />
                  </div>
                  
                  <div className="review-field">
                    <label>Currency</label>
                    <select
                      value={item.currency || 'DKK'}
                      onChange={(e) => handleReviewEdit(index, 'currency', e.target.value)}
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
                  
                  <div className="review-field">
                    <label>Category</label>
                    <select
                      value={item.category}
                      onChange={(e) => handleReviewEdit(index, 'category', e.target.value)}
                    >
                      <option>Groceries</option>
                      <option>Restaurants</option>
                      <option>Transportation</option>
                      <option>Shopping</option>
                      <option>Entertainment</option>
                      <option>Bills</option>
                      <option>Healthcare</option>
                      <option>Education</option>
                      <option>Personal Care</option>
                      <option>Subscriptions</option>
                      <option>Other</option>
                    </select>
                  </div>
                  
                  <div className="review-field">
                    <label>Date</label>
                    <input
                      type="date"
                      value={item.date || bulkDate || getTodayDateString()}
                      onChange={(e) => handleReviewEdit(index, 'date', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="review-actions">
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={loading || reviewItems.length === 0}
              >
                {loading ? 'Saving...' : 'Confirm & Save'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setMode('select')}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && mode !== 'review' && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Processing...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TextInputForm({ onSubmit, loading }) {
  const [text, setText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (text.trim()) {
      onSubmit(text)
      setText('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="text-input-form">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="coffee 4.50"
        className="text-input"
        rows={3}
        disabled={loading}
      />
      <button
        type="submit"
        className="btn-primary"
        disabled={loading || !text.trim()}
      >
        {loading ? 'Processing...' : 'Parse & Add'}
      </button>
    </form>
  )
}

function getTodayDateString() {
  return new Date().toISOString().split('T')[0]
}

function normalizeDateValue(value) {
  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().split('T')[0]
  }

  if (typeof value === 'number') {
    const dateFromNumber = new Date(value)
    if (!isNaN(dateFromNumber)) {
      return dateFromNumber.toISOString().split('T')[0]
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return getTodayDateString()
    }

    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) {
      const [yearRaw, monthRaw, dayPart] = trimmed.split('-')
      const year = yearRaw.padStart(4, '0')
      const month = monthRaw.padStart(2, '0')
      const day = dayPart.split('T')[0].padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const parsed = new Date(trimmed)
    if (!isNaN(parsed)) {
      return parsed.toISOString().split('T')[0]
    }
  }

  return getTodayDateString()
}

const CATEGORY_OPTIONS = [
  'Groceries',
  'Restaurants',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills',
  'Healthcare',
  'Education',
  'Personal Care',
  'Subscriptions',
  'Other',
]

function normalizeReceiptItem(rawItem = {}, fallbackDate, receiptSource) {
  const amountValue = parseFloat(rawItem.amount)
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0
  const {
    receiptFileId,
    receiptFileIndex,
    receiptFileName,
  } = extractReceiptMeta(receiptSource)

  return {
    item: sanitizeItemName(rawItem.item || rawItem.name || rawItem.description),
    amount: hasValidAmount ? amountValue.toFixed(2) : '',
    category: normalizeCategoryValue(rawItem.category),
    currency: normalizeCurrencyValue(rawItem.currency),
    date: normalizeDateValue(rawItem.date || fallbackDate || ''),
    receiptFileId,
    receiptFileIndex,
    receiptFileName,
  }
}

function transformReceiptItems(rawItems, fallbackDate, receiptSource = null) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return []
  }

  return rawItems
    .filter(item => {
      const amountValue = parseFloat(item?.amount)
      return Number.isFinite(amountValue) && amountValue > 0
    })
    .map(item => normalizeReceiptItem(item, fallbackDate, receiptSource))
}

function sanitizeItemName(value) {
  if (!value) return 'Item'
  const text = String(value).trim()
  return text.length > 0 ? text : 'Item'
}

function normalizeCategoryValue(value) {
  if (!value) return 'Other'
  const candidate = String(value).trim()
  if (!candidate) return 'Other'

  const match = CATEGORY_OPTIONS.find(
    category => category.toLowerCase() === candidate.toLowerCase()
  )

  return match || 'Other'
}

function normalizeCurrencyValue(value) {
  if (!value) return 'DKK'
  const candidate = String(value).trim().toUpperCase().slice(0, 3)
  return candidate.length === 3 ? candidate : 'DKK'
}

function extractReceiptMeta(receiptSource) {
  if (!receiptSource) {
    return { receiptFileId: null, receiptFileIndex: null, receiptFileName: null }
  }

  if (typeof receiptSource === 'number') {
    return { receiptFileId: null, receiptFileIndex: receiptSource, receiptFileName: null }
  }

  if (typeof receiptSource === 'string') {
    return { receiptFileId: receiptSource, receiptFileIndex: null, receiptFileName: null }
  }

  if (typeof receiptSource === 'object') {
    return {
      receiptFileId: receiptSource.id || null,
      receiptFileIndex: typeof receiptSource.index === 'number' ? receiptSource.index : null,
      receiptFileName: receiptSource.name || receiptSource.file?.name || null,
    }
  }

  return { receiptFileId: null, receiptFileIndex: null, receiptFileName: null }
}

function createReceiptFileEntries(files = []) {
  const timestamp = Date.now()
  const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : null

  return files.map((file, index) => ({
    id: cryptoRef?.randomUUID ? cryptoRef.randomUUID() : `${timestamp}-${index}-${Math.random().toString(36).slice(2, 9)}`,
    index,
    name: file.name,
    file,
  }))
}

function getReceiptFileKey(item) {
  if (item?.receiptFileId) {
    return `id-${item.receiptFileId}`
  }

  if (typeof item?.receiptFileIndex === 'number') {
    return `index-${item.receiptFileIndex}`
  }

  return null
}

function getReceiptFileForItem(item, receiptFiles = []) {
  if (!item || !Array.isArray(receiptFiles) || receiptFiles.length === 0) {
    return null
  }

  if (item.receiptFileId) {
    const match = receiptFiles.find(entry => entry && entry.id === item.receiptFileId)
    if (match) {
      return match.file || match
    }
  }

  if (typeof item.receiptFileIndex === 'number') {
    const entry = receiptFiles[item.receiptFileIndex]
    if (!entry) return null
    return entry.file || entry
  }

  return null
}

function summarizeReviewItemsByReceipt(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }

  const receiptMap = new Map()

  items.forEach((item, index) => {
    const receiptKey = getReceiptGroupKey(item)
    const amount = parseFloat(item?.amount)

    if (!receiptKey || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    if (!receiptMap.has(receiptKey)) {
      receiptMap.set(receiptKey, {
        key: receiptKey,
        name: item.receiptFileName || `Receipt ${receiptMap.size + 1}`,
        order: index,
        groups: new Map(),
      })
    }

    const receiptEntry = receiptMap.get(receiptKey)
    const itemName = sanitizeItemName(item.item)
    const currency = normalizeCurrencyValue(item.currency)
    const groupKey = `${itemName}-${currency}`

    if (!receiptEntry.groups.has(groupKey)) {
      receiptEntry.groups.set(groupKey, {
        name: itemName,
        currency,
        quantity: 0,
        total: 0,
      })
    }

    const group = receiptEntry.groups.get(groupKey)
    group.quantity += 1
    group.total += amount
  })

  return Array.from(receiptMap.values())
    .sort((a, b) => a.order - b.order)
    .map((receipt) => ({
      key: receipt.key,
      name: receipt.name,
      entries: Array.from(receipt.groups.values()).map((entry) => ({
        ...entry,
        unitPrice: entry.quantity > 0 ? Number((entry.total / entry.quantity).toFixed(2)) : entry.total,
        total: Number(entry.total.toFixed(2)),
      })),
    }))
}

function getReceiptGroupKey(item) {
  if (item?.receiptFileId) {
    return `id-${item.receiptFileId}`
  }
  if (typeof item?.receiptFileIndex === 'number') {
    return `index-${item.receiptFileIndex}`
  }
  return null
}

function formatAmountDisplay(amount, currency = 'DKK') {
  if (!Number.isFinite(amount)) {
    return '-'
  }
  return `${amount.toFixed(2)} ${currency}`
}

