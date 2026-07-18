import { supabase } from './supabase';

export const checkAndLogRecurringExpenses = async () => {
  try {
    const now = new Date();
    const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    const currentDay = now.getDate();

    // 1. Fetch all active recurring expenses
    const { data: recurringItems, error: fetchErr } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('status', 'active');

    if (fetchErr || !recurringItems) return;

    for (const item of recurringItems) {
      const billingDay = Number(item.billing_day);
      
      const shouldLog = currentDay >= billingDay && 
                        (!item.last_logged_month || item.last_logged_month < currentMonthLabel);

      if (shouldLog) {
        // Log the transaction in expenses table
        const { error: insertErr } = await supabase
          .from('expenses')
          .insert({
            amount: Number(item.amount),
            merchant: item.merchant,
            category: item.category,
            status: 'approved',
            user_id: item.user_id,
            comment: `Auto-logged recurring bill (Day: ${billingDay})`
          });

        if (!insertErr) {
          // Update the last_logged_month column
          await supabase
            .from('recurring_expenses')
            .update({ last_logged_month: currentMonthLabel })
            .eq('id', item.id);
        }
      }
    }
  } catch (err) {
    console.warn("Failed checking recurring commitments", err);
  }
};
