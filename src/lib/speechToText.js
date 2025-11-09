// Cross-browser audio transcription service
// Uses Web Speech API when available, otherwise provides fallback options

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDRkO31dq3n5R5KUFVbLgEXQF9yXrx455c'

/**
 * Transcribe audio using Web Speech API (Chrome/Edge only)
 */
export function transcribeWithWebSpeech() {
  return new Promise((resolve, reject) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      reject(new Error('Web Speech API not supported in this browser'))
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    
    let transcript = ''

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' '
      }
    }

    recognition.onerror = (event) => {
      reject(new Error(`Speech recognition error: ${event.error}`))
    }

    recognition.onend = () => {
      resolve(transcript.trim())
    }

    recognition.start()
    
    // Return a function to stop recognition
    return () => {
      recognition.stop()
    }
  })
}

/**
 * Transcribe audio using a free service (AssemblyAI or similar)
 * Note: For production, you'd want to use a proper service with API key
 */
export async function transcribeWithFreeService(audioBlob) {
  // For now, we'll use a client-side approach
  // In production, you'd want to use AssemblyAI, Deepgram, or Google Cloud Speech-to-Text
  // which require backend integration or API keys
  
  throw new Error('Free transcription service not available. Please use Chrome or Edge browser for automatic transcription, or type your expense manually.')
}

/**
 * Transcribe audio using Google Speech-to-Text API
 * Note: This requires a Google Cloud Speech-to-Text API key (separate from Gemini)
 * If the API key doesn't have Speech-to-Text access, this will fail
 */
export async function transcribeWithGoogleSpeechToText(audioBlob) {
  if (!API_KEY) {
    throw new Error('API key not configured for speech-to-text')
  }

  try {
    // Convert audio blob to base64
    const base64Audio = await blobToBase64(audioBlob)
    // Remove data URL prefix (data:audio/webm;base64,)
    const base64Data = base64Audio.split(',')[1] || base64Audio

    // Determine audio format and encoding from blob
    let encoding = 'WEBM_OPUS' // Default for most browsers
    let sampleRateHertz = 48000 // Default for WebM Opus
    
    if (audioBlob.type) {
      const mimeType = audioBlob.type.toLowerCase()
      if (mimeType.includes('webm') || mimeType.includes('opus')) {
        encoding = 'WEBM_OPUS'
        sampleRateHertz = 48000
      } else if (mimeType.includes('wav') || mimeType.includes('wave')) {
        encoding = 'LINEAR16'
        sampleRateHertz = 44100
      } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
        encoding = 'MP3'
        sampleRateHertz = 44100
      } else if (mimeType.includes('ogg') || mimeType.includes('opus')) {
        encoding = 'OGG_OPUS'
        sampleRateHertz = 48000
      } else if (mimeType.includes('flac')) {
        encoding = 'FLAC'
        sampleRateHertz = 44100
      }
    } else if (base64Audio.includes('audio/wav') || base64Audio.includes('audio/wave')) {
      encoding = 'LINEAR16'
      sampleRateHertz = 44100
    } else if (base64Audio.includes('audio/mp3') || base64Audio.includes('audio/mpeg')) {
      encoding = 'MP3'
      sampleRateHertz = 44100
    }

    // Use Google Speech-to-Text API
    // Note: This requires Speech-to-Text API to be enabled in Google Cloud Console
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            encoding: encoding,
            sampleRateHertz: sampleRateHertz,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
            alternativeLanguageCodes: ['en-GB', 'en-AU'],
          },
          audio: {
            content: base64Data,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `Speech-to-Text API error: ${response.statusText}`
      console.error('Speech-to-Text API error:', errorMessage)
      // If it's an API key or permission error, provide helpful message
      if (response.status === 403 || response.status === 401) {
        throw new Error('Speech-to-Text API access denied. Please ensure the Speech-to-Text API is enabled in Google Cloud Console and your API key has the necessary permissions.')
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      throw new Error('No transcription results returned. Please try speaking more clearly.')
    }

    // Combine all transcriptions
    const transcript = data.results
      .map(result => result.alternatives[0]?.transcript || '')
      .filter(text => text.trim())
      .join(' ')

    if (!transcript.trim()) {
      throw new Error('Empty transcription result. Please try speaking more clearly.')
    }

    return transcript.trim()
  } catch (error) {
    console.error('Google Speech-to-Text error:', error)
    throw error
  }
}

/**
 * Transcribe audio using Whisper API (OpenAI) - requires API key
 * This is a fallback option if Google Speech-to-Text doesn't work
 */
export async function transcribeWithWhisper(audioBlob) {
  // This would require OpenAI API key
  // Implementation would go here if needed
  throw new Error('Whisper API not implemented - requires OpenAI API key')
}

/**
 * Main transcription function that tries multiple methods
 * Prioritizes Web Speech API (if available during recording), then tries Google Speech-to-Text
 */
export async function transcribeAudio(audioBlob, options = {}) {
  const { useGoogleSTT = true, useWebSpeech = false } = options
  
  // Try Google Speech-to-Text API (works on all browsers if API is enabled)
  if (useGoogleSTT) {
    try {
      return await transcribeWithGoogleSpeechToText(audioBlob)
    } catch (error) {
      console.log('Google Speech-to-Text failed:', error.message)
      // If it's a permission/API error, provide helpful message
      if (error.message.includes('access denied') || error.message.includes('403') || error.message.includes('401')) {
        throw new Error('Speech-to-Text API is not available. Please use Chrome or Edge browser for automatic transcription, or type your expense manually.')
      }
      // Fall through to try other methods if available
    }
  }
  
  // Note: Web Speech API works with live mic, not audio blobs
  // So we can't use it here directly - it's handled in the recording component
  
  throw new Error('No transcription method available. Please use Chrome or Edge browser for automatic transcription, or type your expense manually.')
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Check if Web Speech API is available
 */
export function isWebSpeechAvailable() {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

/**
 * Check if browser supports audio recording
 */
export function isAudioRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

