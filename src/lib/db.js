import { supabase } from './supabase'

// MOCK DATA FOR DEMO ACCOUNT
const MOCK_DATA = {
  transactions: [
    { id: 't1', user_id: 'demo', item: 'Groceries at Whole Foods', amount: 124.50, category: 'Food', date: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 't2', user_id: 'demo', item: 'Uber to work', amount: 18.20, category: 'Transport', date: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 't3', user_id: 'demo', item: 'Dinner with friends', amount: 65.00, category: 'Food', date: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 't4', user_id: 'demo', item: 'Electricity Bill', amount: 85.00, category: 'Utilities', date: new Date(Date.now() - 10 * 86400000).toISOString() },
    { id: 't5', user_id: 'demo', item: 'Movie Tickets', amount: 30.00, category: 'Entertainment', date: new Date(Date.now() - 12 * 86400000).toISOString() }
  ],
  budgets: [
    { id: 'b1', user_id: 'demo', category: 'Food', amount: 500, currency: 'USD' },
    { id: 'b2', user_id: 'demo', category: 'Transport', amount: 150, currency: 'USD' },
    { id: 'b3', user_id: 'demo', category: 'Entertainment', amount: 200, currency: 'USD' },
    { id: 'b4', user_id: 'demo', category: 'Utilities', amount: 300, currency: 'USD' }
  ],
  subscriptions: [
    { id: 's1', user_id: 'demo', name: 'Netflix', amount: 15.99, currency: 'USD', frequency: 'month', active: true },
    { id: 's2', user_id: 'demo', name: 'Spotify', amount: 9.99, currency: 'USD', frequency: 'month', active: true },
    { id: 's3', user_id: 'demo', name: 'Gym Membership', amount: 49.99, currency: 'USD', frequency: 'month', active: true }
  ],
  income: []
}

export async function getTransactions(userId) {
  if (userId === 'demo') return [...MOCK_DATA.transactions];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function addTransaction(transaction) {
  if (transaction.user_id === 'demo') {
    const newTx = { ...transaction, id: Math.random().toString() };
    MOCK_DATA.transactions.unshift(newTx);
    return newTx;
  }
  const { data, error } = await supabase
    .from('transactions')
    .insert([transaction])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteSubscription(id) {
  const subIndex = MOCK_DATA.subscriptions.findIndex(s => s.id === id);
  if (subIndex > -1) {
    MOCK_DATA.subscriptions.splice(subIndex, 1);
    return;
  }
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function updateTransaction(id, updates) {
  const txIndex = MOCK_DATA.transactions.findIndex(t => t.id === id);
  if (txIndex > -1) {
    MOCK_DATA.transactions[txIndex] = { ...MOCK_DATA.transactions[txIndex], ...updates };
    return MOCK_DATA.transactions[txIndex];
  }
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
  const txIndex = MOCK_DATA.transactions.findIndex(t => t.id === id);
  if (txIndex > -1) {
    MOCK_DATA.transactions.splice(txIndex, 1);
    return;
  }
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function getBudgets(userId) {
  if (userId === 'demo') return [...MOCK_DATA.budgets];
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
  
  if (error) throw error
  return data || []
}

export async function upsertBudget(budget) {
  if (budget.user_id === 'demo') {
    const existing = MOCK_DATA.budgets.find(b => b.category === budget.category);
    if (existing) {
      existing.amount = budget.amount;
      return existing;
    } else {
      const newBudget = { ...budget, id: Math.random().toString() };
      MOCK_DATA.budgets.push(newBudget);
      return newBudget;
    }
  }
  const { data, error } = await supabase
    .from('budgets')
    .upsert([budget], { onConflict: 'user_id,category' })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function getSubscriptions(userId) {
  if (userId === 'demo') return [...MOCK_DATA.subscriptions];
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
  
  if (error) throw error
  return data || []
}

export async function addSubscription(subscription) {
  if (subscription.user_id === 'demo') {
    const newSub = { ...subscription, id: Math.random().toString() };
    MOCK_DATA.subscriptions.push(newSub);
    return newSub;
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([subscription])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateSubscription(id, updates) {
  const subIndex = MOCK_DATA.subscriptions.findIndex(s => s.id === id);
  if (subIndex > -1) {
    MOCK_DATA.subscriptions[subIndex] = { ...MOCK_DATA.subscriptions[subIndex], ...updates };
    return MOCK_DATA.subscriptions[subIndex];
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Income functions
export async function getIncome(userId) {
  if (userId === 'demo') return [...MOCK_DATA.income];
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
  
  if (error) throw error
  return data || []
}

export async function addIncome(income) {
  if (income.user_id === 'demo') {
    const newInc = { ...income, id: Math.random().toString() };
    MOCK_DATA.income.push(newInc);
    return newInc;
  }
  const { data, error } = await supabase
    .from('income')
    .insert([income])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateIncome(id, updates) {
  const incIndex = MOCK_DATA.income.findIndex(i => i.id === id);
  if (incIndex > -1) {
    MOCK_DATA.income[incIndex] = { ...MOCK_DATA.income[incIndex], ...updates };
    return MOCK_DATA.income[incIndex];
  }
  const { data, error } = await supabase
    .from('income')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteIncome(id) {
  const incIndex = MOCK_DATA.income.findIndex(i => i.id === id);
  if (incIndex > -1) {
    MOCK_DATA.income.splice(incIndex, 1);
    return;
  }
  const { error } = await supabase
    .from('income')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
