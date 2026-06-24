import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { smsBody, userId } = await req.json()

    // Call OpenAI to parse the SMS
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expense parser. Extract the 'amount' (number), 'merchant' (string), and 'suggestedCategory' (string) from the bank SMS. 
            Categories must be one of: Groceries, Dining, Bills, Transport, Shopping, Leisure.
            Respond ONLY with raw JSON, no markdown blocks.`
          },
          {
            role: 'user',
            content: smsBody
          }
        ]
      })
    })

    const aiData = await aiResponse.json()
    const parsedExpense = JSON.parse(aiData.choices[0].message.content)

    // Insert into Supabase
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        amount: parsedExpense.amount,
        merchant: parsedExpense.merchant,
        category: parsedExpense.suggestedCategory,
        status: 'pending',
        raw_sms: smsBody,
        user_id: userId
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
