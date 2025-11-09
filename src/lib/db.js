import { supabase } from './supabase'

export async function getTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function addTransaction(transaction) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([transaction])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateTransaction(id, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function getBudgets(userId) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
  
  if (error) throw error
  return data || []
}

export async function upsertBudget(budget) {
  const { data, error } = await supabase
    .from('budgets')
    .upsert([budget], { onConflict: 'user_id,category' })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function getSubscriptions(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
  
  if (error) throw error
  return data || []
}

export async function addSubscription(subscription) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([subscription])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateSubscription(id, updates) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

