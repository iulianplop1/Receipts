import { useState, useRef } from 'react'
import { analyzeReceipt, parseTextInput, parseTranscribedAudio } from '../lib/gemini'
import { addTransaction } from '../lib/db'
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
  
  const fileInputRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptionRef = useRef('')
  const audioBlobRef = useRef(null) // Store blob in ref to prevent loss

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')

    try {
      const result = await analyzeReceipt(file)
      // Handle both old format (array) and new format (object with date and items)
      const items = result.items || result
      const receiptDate = result.date || new Date().toISOString().split('T')[0]
      
      setReviewItems(items.map(item => ({ 
        ...item, 
        currency: 'USD',
        date: receiptDate // Use date from receipt
      })))
      setMode('review')
    } catch (err) {
      setError('Failed to analyze receipt. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTextSubmit = async (text) => {
    if (!text.trim()) return

    setLoading(true)
    setError('')

    try {
      const result = await parseTextInput(text)
      setReviewItems(result.items.map(item => ({ ...item, currency: 'USD' })))
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
            
            if (result && result.items && result.items.length > 0) {
              setReviewItems(result.items.map(item => ({ ...item, currency: 'USD' })))
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
                setReviewItems(result.items.map(item => ({ ...item, currency: 'USD' })))
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
              setReviewItems(result.items.map(item => ({ ...item, currency: 'USD' })))
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
          setReviewItems(result.items.map(item => ({ ...item, currency: 'USD' })))
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
    updated[index] = { ...updated[index], [field]: value }
    setReviewItems(updated)
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError('')

    try {
      for (const item of reviewItems) {
        // Use date from item if available, otherwise use today
        const itemDate = item.date 
          ? new Date(item.date).toISOString() 
          : new Date().toISOString()
        
        await addTransaction({
          user_id: userId,
          item: item.item,
          amount: parseFloat(item.amount),
          category: item.category,
          currency: item.currency || 'USD',
          date: itemDate,
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
                <span className="mode-label">Scan Receipt</span>
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
            
            <div className="review-items">
              {reviewItems.map((item, index) => (
                <div key={index} className="review-item">
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
                      value={item.currency || 'USD'}
                      onChange={(e) => handleReviewEdit(index, 'currency', e.target.value)}
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
                      value={item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
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

