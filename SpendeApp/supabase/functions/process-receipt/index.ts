import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { base64Image, userId } = await req.json()

    if (!base64Image) {
      throw new Error("Missing base64Image");
    }

    // Call OpenAI to parse the receipt image
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
            content: `You are an expense parser. Read the receipt image and extract the 'amount' (number representing the grand total), 'merchant' (string), and 'suggestedCategory' (string). 
            Categories must be one of: Groceries, Dining, Bills, Transport, Shopping, Leisure.
            Respond ONLY with raw JSON, no markdown blocks.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the expense details from this receipt.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 300,
      })
    })

    const aiData = await aiResponse.json()
    if (aiData.error) throw new Error(aiData.error.message)
    
    // Parse the JSON string OpenAI returned
    const parsedExpense = JSON.parse(aiData.choices[0].message.content)

    // Insert into Supabase
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        amount: parsedExpense.amount,
        merchant: parsedExpense.merchant,
        category: parsedExpense.suggestedCategory,
        status: 'pending',
        raw_sms: 'Scanned Receipt',
        user_id: userId
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
