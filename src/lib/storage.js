import { supabase } from './supabase'

/**
 * Upload a receipt image to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} userId - The user ID
 * @param {string} transactionId - Optional transaction ID for naming
 * @returns {Promise<string>} The public URL of the uploaded image
 */
export async function uploadReceiptImage(file, userId, transactionId = null) {
  try {
    // Generate a unique filename
    const fileExt = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 9)
    
    // Generate filename
    const fileName = transactionId 
      ? `${transactionId}-${timestamp}.${fileExt}`
      : `${timestamp}-${randomId}.${fileExt}`
    
    // For public buckets, we can use a simpler path structure
    // Try user folder first, fallback to root if that fails
    let filePath = `${userId}/${fileName}`
    let uploadError = null

    // Try uploading to user folder
    let { data, error } = await supabase.storage
      .from('receipts')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    // Even public buckets need RLS policies for authenticated uploads
    // If we get a policy error, the bucket needs policies set up

    if (error) {
      // Provide helpful error messages
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        throw new Error('Receipts bucket not found. Create a "receipts" bucket in Supabase Storage → Storage. See FIX_STORAGE_NOW.md for step-by-step instructions.')
      }
      if (error.message.includes('row-level security') || error.message.includes('RLS') || error.message.includes('policy')) {
        throw new Error('Storage policy error. Make the "receipts" bucket public (Storage → receipts → Edit → Check "Public bucket") or set up RLS policies. See FIX_STORAGE_NOW.md for instructions.')
      }
      console.error('Storage upload error:', error)
      throw new Error(`Storage error: ${error.message}. See FIX_STORAGE_NOW.md for setup instructions.`)
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error uploading receipt image:', error)
    throw error
  }
}

/**
 * Delete a receipt image from Supabase Storage
 * @param {string} imageUrl - The URL of the image to delete
 * @returns {Promise<void>}
 */
export async function deleteReceiptImage(imageUrl) {
  try {
    // Extract the file path from the URL
    const urlParts = imageUrl.split('/receipts/')
    if (urlParts.length < 2) {
      console.warn('Invalid receipt image URL:', imageUrl)
      return
    }

    const filePath = `receipts/${urlParts[1]}`

    const { error } = await supabase.storage
      .from('receipts')
      .remove([filePath])

    if (error) {
      console.error('Error deleting receipt image:', error)
      // Don't throw - deletion is not critical
    }
  } catch (error) {
    console.error('Error deleting receipt image:', error)
    // Don't throw - deletion is not critical
  }
}

