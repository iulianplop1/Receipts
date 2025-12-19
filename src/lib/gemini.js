import { GoogleGenerativeAI } from '@google/generative-ai'
import { convertCurrency } from './currency'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDRkO31dq3n5R5KUFVbLgEXQF9yXrx455c'

if (!API_KEY) {
  throw new Error('Missing Gemini API key. Please set VITE_GEMINI_API_KEY in your .env file')
}

const genAI = new GoogleGenerativeAI(API_KEY)

// Function to list available models
async function listAvailableModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`)
    if (response.ok) {
      const data = await response.json()
      return data.models?.map(m => m.name.replace('models/', '')) || []
    }
  } catch (error) {
    console.log('Could not list models:', error)
  }
  return []
}

// Function to get available models and use the best one
// We'll test models in order of preference when they're first used
async function getAvailableModel() {
  // Try models in order of preference
  const modelNames = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ]
  
  // Try to get available models first
  try {
    const availableModels = await listAvailableModels()
    if (availableModels.length > 0) {
      console.log('Available models:', availableModels)
      // Use the first available model from our preferred list
      for (const preferred of modelNames) {
        if (availableModels.includes(preferred)) {
          return genAI.getGenerativeModel({ model: preferred })
        }
      }
      // If none of our preferred models are available, use the first available one
      return genAI.getGenerativeModel({ model: availableModels[0] })
    }
  } catch (error) {
    console.log('Could not fetch available models, using defaults')
  }
  
  // Fallback to default
  return genAI.getGenerativeModel({ model: modelNames[0] })
}

// Initialize model - will be set when first used
let model = null

/**
 * Resolve ambiguous dates by checking which interpretation is closer to today
 * For example, "10/11/25" could be Oct 10 or Nov 11 - we pick the one closer to today
 */
function resolveAmbiguousDate(dateStr) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentYearShort = currentYear % 100 // Last 2 digits (e.g., 25 for 2025)
  
  // Try to parse as DD/MM/YY or MM/DD/YY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    const [, part1, part2, yearPart] = slashMatch
    const num1 = parseInt(part1)
    const num2 = parseInt(part2)
    const yearNum = parseInt(yearPart)
    
    // If year matches current year (or last 2 digits match)
    const isCurrentYear = yearNum === currentYear || (yearPart.length === 2 && yearNum === currentYearShort)
    
    if (isCurrentYear && num1 <= 12 && num2 <= 12 && num1 !== num2) {
      // Both could be months, so it's ambiguous
      // Try both interpretations: DD/MM/YY and MM/DD/YY
      const fullYear = yearPart.length === 2 ? 2000 + yearNum : yearNum
      
      // Option 1: DD/MM/YY (day/month/year)
      let date1
      try {
        date1 = new Date(fullYear, num2 - 1, num1) // month is 0-indexed
      } catch (e) {
        date1 = null
      }
      
      // Option 2: MM/DD/YY (month/day/year)
      let date2
      try {
        date2 = new Date(fullYear, num1 - 1, num2) // month is 0-indexed
      } catch (e) {
        date2 = null
      }
      
      // Check which date is valid and closer to today
      if (date1 && date2) {
        const diff1 = Math.abs(today - date1)
        const diff2 = Math.abs(today - date2)
        
        // Return the one closer to today
        return diff1 < diff2 ? date1 : date2
      } else if (date1) {
        return date1
      } else if (date2) {
        return date2
      }
    }
  }
  
  // Try standard YYYY-MM-DD format
  const dashMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (dashMatch) {
    const [, year, month, day] = dashMatch.map(Number)
    return new Date(year, month - 1, day)
  }
  
  return null
}

export async function analyzeReceipt(imageFile) {
  const imageData = await fileToBase64(imageFile)
  const prompt = `Analyze this receipt image and extract ALL transactions. Pay close attention to quantities and calculate totals correctly.

IMPORTANT RULES:
1. If an item appears multiple times (e.g., "2x Apple" or "Apple x2"), create separate entries for EACH item with the individual price
2. If quantity is shown (e.g., "2 @ $1.50"), calculate: amount = quantity × unit_price
3. List EVERY item on the receipt, even if they're the same item
4. If you see "2 PS" or similar, that means 2 of that item - create 2 separate entries
5. CRITICAL: If an item has a discount, rabat, or reduction applied to it, calculate the FINAL price after discount. For example, if an item costs 20 DKK and has -8 DKK rabat, the final amount should be 12 DKK (20 - 8 = 12). Always use the final price after any discounts.
6. Only include items with positive final amounts (actual purchases) - do not include items with negative or zero amounts after discounts are applied

Return a JSON object with this exact structure:
{
  "date": "YYYY-MM-DD",
  "items": [
    {
      "item": "item name",
      "amount": 0.00,
      "category": "category name"
    }
  ]
}

IMPORTANT:
- Extract the purchase date from the receipt (look for date, transaction date, purchase date, etc.)
- The date must be a valid date from the receipt, not a random date
- If no date is found or the date seems invalid, use today's date in YYYY-MM-DD format
- The date should be the actual purchase date from the receipt, not today
- Do not extract dates that are clearly wrong (e.g., dates from many years in the past or future)

Categories should be: Groceries, Restaurants, Transportation, Shopping, Entertainment, Bills, Healthcare, Education, Personal Care, Subscriptions, Other.

Example 1: If receipt shows "Date: 2024-01-15" and "Apple 2 @ $1.50", return:
{
  "date": "2024-01-15",
  "items": [
    {"item": "Apple", "amount": 1.50, "category": "Groceries"},
    {"item": "Apple", "amount": 1.50, "category": "Groceries"}
  ]
}

Example 2: If receipt shows "Item: 20 DKK" and below it "-8 DKK rabat", return:
{
  "date": "2024-01-15",
  "items": [
    {"item": "Item", "amount": 12.00, "category": "Other"}
  ]
}
Note: The amount is 12 (20 - 8), not 20, because the discount must be subtracted.

Be accurate with amounts, item names, and dates. Always calculate the final price after discounts. If you can't determine a category, use "Other".`

  // First, try to get available models
  let availableModels = []
  try {
    availableModels = await listAvailableModels()
    console.log('Available models:', availableModels)
  } catch (error) {
    console.log('Could not list models, using defaults:', error)
  }

  // Try models in order - use correct model names
  // Start with available models if we got them, otherwise use defaults
  const defaultModelNames = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-pro-vision'
  ]
  
  // If we have available models, prioritize those that support vision
  const modelNames = availableModels.length > 0 
    ? availableModels.filter(m => m.includes('flash') || m.includes('pro') || m.includes('vision'))
    : defaultModelNames
  
  // If no filtered models, use all available or defaults
  const modelsToTry = modelNames.length > 0 ? modelNames : (availableModels.length > 0 ? availableModels : defaultModelNames)
  
  let lastError = null
  
  for (const modelName of modelsToTry) {
    try {
      // Remove 'models/' prefix if present
      const cleanModelName = modelName.replace('models/', '')
      console.log(`Trying model: ${cleanModelName}`)
      const testModel = genAI.getGenerativeModel({ model: cleanModelName })
      
      const result = await testModel.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData.split(',')[1],
            mimeType: imageFile.type
          }
        }
      ])
      
      const response = await result.response
      const text = response.text()
      // Try to match JSON object first (with date), then fall back to array
      const jsonObjectMatch = text.match(/\{[\s\S]*"items"[\s\S]*\}/);
      const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
      
      if (jsonObjectMatch) {
        model = testModel // Save working model for future use
        console.log(`Successfully using model: ${cleanModelName}`)
        const parsed = JSON.parse(jsonObjectMatch[0])
        // If it's an object with items array, return it
        if (parsed.items && Array.isArray(parsed.items)) {
          // Filter out items with negative amounts and validate date
          const filteredItems = parsed.items.filter(item => {
            // Only filter out items with negative or zero amounts
            const hasNegativeAmount = parseFloat(item.amount || 0) <= 0
            return !hasNegativeAmount
          })
          
          // Validate and fix date
          let receiptDate = parsed.date
          if (receiptDate) {
            const today = new Date()
            const maxPastDate = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate()) // 2 years ago
            const maxFutureDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()) // 1 year in future
            
            try {
              let dateObj = null
              
              // First try to resolve ambiguous dates (like 10/11/25)
              const resolvedDate = resolveAmbiguousDate(receiptDate)
              if (resolvedDate && !isNaN(resolvedDate.getTime())) {
                dateObj = resolvedDate
              } else {
                // Try standard YYYY-MM-DD format
                const [year, month, day] = receiptDate.split('-').map(Number)
                if (year && month && day) {
                  dateObj = new Date(year, month - 1, day)
                }
              }
              
              // Check if date is reasonable (not too far in past or future)
              if (dateObj && !isNaN(dateObj.getTime())) {
                if (dateObj < maxPastDate || dateObj > maxFutureDate) {
                  console.warn(`Date ${receiptDate} seems invalid (out of range), using today's date`)
                  receiptDate = today.toISOString().split('T')[0]
                } else {
                  receiptDate = dateObj.toISOString().split('T')[0]
                }
              } else {
                console.warn(`Invalid date format ${receiptDate}, using today's date`)
                receiptDate = today.toISOString().split('T')[0]
              }
            } catch (e) {
              console.warn(`Error parsing date ${receiptDate}, using today's date:`, e)
              receiptDate = today.toISOString().split('T')[0]
            }
          } else {
            receiptDate = new Date().toISOString().split('T')[0]
          }
          
          return {
            date: receiptDate,
            items: filteredItems
          }
        }
      }
      
      // Fallback to array format (for backward compatibility)
      if (jsonArrayMatch) {
        model = testModel
        console.log(`Successfully using model: ${cleanModelName} (array format)`)
        // Convert array to object format with today's date
        const items = JSON.parse(jsonArrayMatch[0])
        
        // Filter out items with negative amounts
        const filteredItems = items.filter(item => {
          const hasNegativeAmount = parseFloat(item.amount || 0) <= 0
          return !hasNegativeAmount
        })
        
        return {
          date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
          items: filteredItems
        }
      }
      
      throw new Error('Could not parse receipt data')
    } catch (error) {
      console.log(`Model ${modelName} failed:`, error.message)
      lastError = error
      
      // Check for overload/rate limit errors - try next model instead of failing immediately
      const errorMessage = error.message || ''
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('overloaded') || errorMessage.includes('resource exhausted')) {
        console.log(`Model ${modelName} is overloaded, trying next model...`)
        // Continue to next model
        continue
      }
      
      // Continue to next model for other errors too
      continue
    }
  }
  
  // If all models failed
  console.error('All models failed. Last error:', lastError)
  const errorMessage = lastError?.message || 'Unknown error'
  if (errorMessage.includes('404') || errorMessage.includes('not found')) {
    throw new Error(`API key may not have access to Gemini models, or the models are not available. Please check your API key permissions. Error: ${errorMessage}`)
  }
  if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('overloaded') || errorMessage.includes('resource exhausted')) {
    throw new Error('The AI service is currently overloaded. Please wait a moment and try again.')
  }
  throw new Error(`Failed to analyze receipt with any available model. Please check your API key. Last error: ${errorMessage}`)
}

// Transcribe audio using Web Speech API (client-side)
export function transcribeAudio(audioBlob) {
  return new Promise((resolve, reject) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      reject(new Error('Speech recognition not supported in this browser'))
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      resolve(transcript)
    }

    recognition.onerror = (event) => {
      reject(new Error(`Speech recognition error: ${event.error}`))
    }

    recognition.onend = () => {
      // Recognition ended
    }

    // Note: Web Speech API requires microphone access, not audio blob
    // This function should be called with live microphone stream
    // For blob-based transcription, you'd need a service like Google Speech-to-Text API
    recognition.start()
  })
}

/**
 * Transcribe and parse audio using Gemini's audio capabilities
 * This works with audio blobs directly - no separate transcription needed!
 */
export async function transcribeAndParseAudioWithGemini(audioBlob) {
  try {
    console.log('transcribeAndParseAudioWithGemini called with blob:', {
      type: audioBlob.type,
      size: audioBlob.size,
      hasBlob: !!audioBlob
    })
    
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Invalid audio blob: blob is empty or missing')
    }
    
    // Initialize model if not already done
    if (!model) {
      try {
        model = await getAvailableModel()
        console.log('Model initialized:', model)
      } catch (error) {
        console.error('Failed to get model:', error)
        throw new Error('Failed to initialize AI model. Please check your API key.')
      }
    }
    
    // Convert audio blob to base64
    console.log('Converting audio blob to base64...')
    const audioData = await blobToBase64(audioBlob)
    const base64Data = audioData.split(',')[1] || audioData
    
    if (!base64Data || base64Data.length === 0) {
      throw new Error('Failed to convert audio blob to base64')
    }
    
    console.log('Base64 conversion complete, length:', base64Data.length)
    
    // Determine MIME type - Gemini supports: audio/mpeg, audio/mp3, audio/wav, audio/webm
    let mimeType = 'audio/webm'
    if (audioBlob.type) {
      mimeType = audioBlob.type
      // Normalize MIME type for Gemini
      if (mimeType === 'audio/webm;codecs=opus') {
        mimeType = 'audio/webm'
      }
    } else if (audioData.includes('audio/wav')) {
      mimeType = 'audio/wav'
    } else if (audioData.includes('audio/mp3')) {
      mimeType = 'audio/mpeg'
    }
    
    console.log('Using MIME type:', mimeType)
    
    const prompt = `Listen to this audio recording of someone describing an expense. Transcribe what they said and extract all transaction information.

Return JSON with this structure:
{
  "transcription": "exact transcription of what was said",
  "items": [
    {
      "item": "item name",
      "amount": 0.00,
      "category": "category name"
    }
  ]
}

Categories: Groceries, Restaurants, Transportation, Shopping, Entertainment, Bills, Healthcare, Education, Personal Care, Subscriptions, Other.

IMPORTANT:
- If multiple items are mentioned, extract ALL of them
- If quantities are mentioned (e.g., "2 bananas"), create separate entries for each item
- Be accurate with amounts and item names

Example: If they say "I spent 2 dollars on a banana and 3 dollars on apples", return:
{
  "transcription": "I spent 2 dollars on a banana and 3 dollars on apples",
  "items": [
    {"item": "banana", "amount": 2.00, "category": "Groceries"},
    {"item": "apples", "amount": 3.00, "category": "Groceries"}
  ]
}`

    // Use Gemini's audio input capability
    console.log('Sending audio to Gemini API...')
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ])
    
    console.log('Got response from Gemini')
    const response = await result.response
    const text = response.text()
    console.log('Gemini response text:', text.substring(0, 200) + '...')
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        console.log('Successfully parsed JSON:', parsed)
        return parsed
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError)
        console.error('JSON string:', jsonMatch[0])
        throw new Error(`Failed to parse JSON response: ${parseError.message}`)
      }
    }
    
    console.error('No JSON found in response. Full text:', text)
    throw new Error('Could not parse audio response - no JSON found in response')
  } catch (error) {
    console.error('Error transcribing/parsing audio with Gemini:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    // Provide more helpful error messages
    if (error.message.includes('400') || error.message.includes('Invalid')) {
      throw new Error('Audio format not supported. Please try recording again or use a different browser.')
    } else if (error.message.includes('401') || error.message.includes('403')) {
      throw new Error('API key error. Please check your Gemini API key permissions.')
    } else if (error.message.includes('429')) {
      throw new Error('API rate limit exceeded. Please try again in a moment.')
    }
    
    throw error
  }
}

// Parse transcribed text using Gemini (fallback if we already have transcription)
export async function parseTranscribedAudio(transcription) {
  try {
    // Initialize model if not already done
    if (!model) {
      try {
        model = await getAvailableModel()
      } catch (error) {
        console.error('Failed to get model:', error)
        throw new Error('Failed to initialize AI model. Please check your API key.')
      }
    }
    
    const prompt = `Parse this transcribed audio about an expense and extract transaction information. Return JSON with this structure:
{
  "transcription": "${transcription}",
  "items": [
    {
      "item": "item name",
      "amount": 0.00,
      "category": "category name"
    }
  ]
}

Categories: Groceries, Restaurants, Transportation, Shopping, Entertainment, Bills, Healthcare, Education, Personal Care, Subscriptions, Other.

IMPORTANT:
- If multiple items are mentioned, extract ALL of them
- If quantities are mentioned (e.g., "2 bananas"), create separate entries for each item

Example: "I spent 2 dollars on a banana" should return:
{
  "transcription": "I spent 2 dollars on a banana",
  "items": [{"item": "banana", "amount": 2.00, "category": "Groceries"}]
}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    throw new Error('Could not parse audio transcription')
  } catch (error) {
    console.error('Error parsing transcription:', error)
    throw error
  }
}

export async function parseTextInput(inputText) {
  try {
    // Initialize model if not already done
    if (!model) {
      try {
        model = await getAvailableModel()
      } catch (error) {
        console.error('Failed to get model:', error)
        throw new Error('Failed to initialize AI model. Please check your API key.')
      }
    }
    
    const prompt = `Parse this expense text and extract transaction information. Return JSON with this structure:
{
  "items": [
    {
      "item": "item name",
      "amount": 0.00,
      "category": "category name"
    }
  ]
}

Categories: Groceries, Restaurants, Transportation, Shopping, Entertainment, Bills, Healthcare, Education, Personal Care, Subscriptions, Other.

Text: "${inputText}"

If multiple items are mentioned, extract all of them.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text()
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    throw new Error('Could not parse text input')
  } catch (error) {
    console.error('Error parsing text:', error)
    throw error
  }
}

export async function generateInsights(transactions) {
  try {
    // Initialize model if not already done
    if (!model) {
      model = await getAvailableModel()
    }
    
    const prompt = `Analyze these transactions and provide insights. Return JSON with this structure:
{
  "insights": [
    {
      "type": "spending_increase" | "spending_decrease" | "new_subscription" | "budget_warning",
      "message": "human readable insight message",
      "category": "category name if applicable",
      "percentage": 0 if applicable
    }
  ]
}

Transactions: ${JSON.stringify(transactions.slice(0, 50))}

Provide 2-3 most relevant insights.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return { insights: [] }
  } catch (error) {
    console.error('Error generating insights:', error)
    return { insights: [] }
  }
}

export async function naturalLanguageSearch(query, transactions, subscriptions = [], budgets = [], currency = 'USD') {
  try {
    // Initialize model if not already done
    if (!model) {
      model = await getAvailableModel()
    }
    
    // Calculate summary statistics for better context
    const totalTransactions = transactions.length
    const totalSpent = transactions.reduce((sum, t) => {
      const amount = convertCurrency(parseFloat(t.amount) || 0, t.currency || 'USD', currency)
      return sum + amount
    }, 0)
    
    // Group transactions by month with converted amounts
    const transactionsByMonth = {}
    transactions.forEach(t => {
      const date = new Date(t.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!transactionsByMonth[monthKey]) {
        transactionsByMonth[monthKey] = { transactions: [], total: 0 }
      }
      const convertedAmount = convertCurrency(parseFloat(t.amount) || 0, t.currency || 'USD', currency)
      transactionsByMonth[monthKey].transactions.push(t)
      transactionsByMonth[monthKey].total += convertedAmount
    })
    
    // Calculate spending by category with currency conversion
    const spendingByCategory = {}
    transactions.forEach(t => {
      const amount = convertCurrency(parseFloat(t.amount) || 0, t.currency || 'USD', currency)
      spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + amount
    })
    
    // Calculate subscription totals with currency conversion
    const subscriptionTotal = subscriptions.reduce((sum, sub) => {
      const amount = convertCurrency(parseFloat(sub.amount) || 0, sub.currency || 'USD', currency)
      return sum + amount
    }, 0)
    
    const prompt = `You are a financial assistant helping analyze personal budget and spending data. Answer the user's question accurately using ALL the provided data.

User Question: "${query}"

AVAILABLE DATA:

1. TRANSACTIONS (Total: ${totalTransactions} transactions):
${JSON.stringify(transactions.slice(0, 500))}${transactions.length > 500 ? `\n... and ${transactions.length - 500} more transactions` : ''}

2. TRANSACTION SUMMARY BY MONTH:
${JSON.stringify(Object.entries(transactionsByMonth).map(([month, data]) => ({
  month,
  count: data.transactions.length,
  total: data.total
})).slice(0, 12))}

3. SPENDING BY CATEGORY:
${JSON.stringify(spendingByCategory)}

4. SUBSCRIPTIONS (Total: ${subscriptions.length} active subscriptions):
${JSON.stringify(subscriptions)}

5. BUDGETS:
${JSON.stringify(budgets)}

6. CURRENCY: ${currency}

IMPORTANT INSTRUCTIONS:
- When calculating totals, include BOTH transactions AND subscription costs
- Subscriptions are recurring monthly expenses that should be included in monthly totals
- If asked about "this month" or "current month", use the most recent month in the data
- If asked about total spending, include all transactions plus monthly subscription costs
- Be precise with numbers and calculations
- If the question asks about a specific month, filter transactions by that month
- For subscription costs, multiply monthly amount by number of months if asking about a period

Return JSON with this structure:
{
  "answer": "direct, accurate answer to the question with specific numbers and details",
  "filteredTransactions": [array of relevant transaction IDs or indices if applicable]
}

Example: If asked "How much did I spend in total this month?", calculate:
- Sum of all transactions in the current month
- Plus all active subscription monthly costs
- Return the total`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // Fallback: try to extract answer from text even if not JSON
    const answerMatch = text.match(/answer["\s:]+"([^"]+)"/i) || text.match(/answer["\s:]+([^\n}]+)/i)
    if (answerMatch) {
      return { answer: answerMatch[1].trim(), filteredTransactions: [] }
    }
    
    return { answer: text.substring(0, 500), filteredTransactions: [] }
  } catch (error) {
    console.error('Error processing search:', error)
    return { answer: 'Error processing query. Please try rephrasing your question.', filteredTransactions: [] }
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

