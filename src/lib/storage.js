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
    
    // Use user ID as folder structure for better organization and RLS
    const fileName = transactionId 
      ? `${transactionId}-${timestamp}.${fileExt}`
      : `${timestamp}-${randomId}.${fileExt}`
    
    // Store in user-specific folder for RLS policies
    const filePath = `${userId}/${fileName}`

    // Upload the file
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      // Provide helpful error messages
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        throw new Error('Receipts storage bucket not found. Please create a "receipts" bucket in Supabase Storage and set up the storage policies.')
      }
      if (error.message.includes('row-level security') || error.message.includes('RLS')) {
        throw new Error('Storage RLS policy error. Please check that the storage bucket has the correct policies set up. See SETUP_NEW_FEATURES.md for instructions.')
      }
      console.error('Storage upload error:', error)
      throw error
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

