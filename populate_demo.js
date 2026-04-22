import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzsafoaevlampvzqrrmz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16c2Fmb2FldmxhbXB2enFycm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTA0NDIsImV4cCI6MjA3ODI2NjQ0Mn0.XBPGs_C2VPp4TPACagJ85cdzkFJAv0WZ58R6_2wPww8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function populate() {
  console.log('Logging in demo account...');
  let { data, error } = await supabase.auth.signInWithPassword({
    email: 'iulianplop.demo@gmail.com',
    password: 'demo123'
  });

  if (error && error.message.includes('Invalid login credentials')) {
    console.log('Demo account not found, creating it...');
    const signUpRes = await supabase.auth.signUp({
      email: 'iulianplop.demo@gmail.com',
      password: 'demo123'
    });
    if (signUpRes.error) {
      console.error('Sign up failed:', signUpRes.error);
      return;
    }
    data = signUpRes.data;
  } else if (error) {
    console.error('Login error:', error);
    return;
  }

  const userId = data.user.id;
  console.log('Logged in as:', userId);

  console.log('Inserting Budgets...');
  await supabase.from('budgets').upsert([
    { user_id: userId, category: 'Food', amount: 500, currency: 'USD' },
    { user_id: userId, category: 'Transport', amount: 150, currency: 'USD' },
    { user_id: userId, category: 'Entertainment', amount: 200, currency: 'USD' },
    { user_id: userId, category: 'Utilities', amount: 300, currency: 'USD' }
  ], { onConflict: 'user_id, category' });

  console.log('Inserting Subscriptions...');
  await supabase.from('subscriptions').insert([
    { user_id: userId, name: 'Netflix', amount: 15.99, currency: 'USD', frequency: 'month', active: true },
    { user_id: userId, name: 'Spotify', amount: 9.99, currency: 'USD', frequency: 'month', active: true },
    { user_id: userId, name: 'Gym Membership', amount: 49.99, currency: 'USD', frequency: 'month', active: true }
  ]);

  console.log('Inserting Transactions...');
  // Generate some past transactions
  const now = new Date();
  const transactions = [
    { user_id: userId, item: 'Groceries at Whole Foods', amount: 124.50, category: 'Food', date: new Date(now.getTime() - 2 * 86400000).toISOString() },
    { user_id: userId, item: 'Uber to work', amount: 18.20, category: 'Transport', date: new Date(now.getTime() - 3 * 86400000).toISOString() },
    { user_id: userId, item: 'Dinner with friends', amount: 65.00, category: 'Food', date: new Date(now.getTime() - 5 * 86400000).toISOString() },
    { user_id: userId, item: 'Electricity Bill', amount: 85.00, category: 'Utilities', date: new Date(now.getTime() - 10 * 86400000).toISOString() },
    { user_id: userId, item: 'Movie Tickets', amount: 30.00, category: 'Entertainment', date: new Date(now.getTime() - 12 * 86400000).toISOString() },
    { user_id: userId, item: 'Coffee', amount: 4.50, category: 'Food', date: new Date(now.getTime() - 1 * 86400000).toISOString() },
    { user_id: userId, item: 'Gas Station', amount: 45.00, category: 'Transport', date: new Date(now.getTime() - 15 * 86400000).toISOString() },
  ];
  await supabase.from('transactions').insert(transactions);

  console.log('Demo data populated successfully!');
}

populate();
