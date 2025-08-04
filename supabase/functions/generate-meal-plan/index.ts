import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to generate a fallback meal plan
const generateFallbackMealPlan = (preferences) => {
  const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  return {
    days: Array.from({ length: preferences.total_days }, (_, i) => ({
      day: i + 1,
      date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      meals: Array.from({ length: preferences.meals_per_day }, (_, j) => ({
        type: mealTypes[j % mealTypes.length],
        name: `Sample ${mealTypes[j % mealTypes.length]}`,
        recipe: `A delicious ${preferences.diet_type} ${mealTypes[j % mealTypes.length].toLowerCase()} with healthy ingredients.`,
        ingredients: ['Sample ingredient 1', 'Sample ingredient 2']
      }))
    }))
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication error:', authError?.message);
      throw new Error('Unauthorized');
    }

    // Parse request body
    let preferences;
    try {
      const requestData = await req.json();
      preferences = requestData.preferences;
      if (!preferences) {
        throw new Error('No preferences provided');
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid request body');
    }

    // Generate meal plan (try OpenRouter first, fallback to local generation)
    let planData;
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY') || 
      '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';

    try {
      const prompt = `Create a ${preferences.total_days}-day ${preferences.diet_type} meal plan with ${preferences.meals_per_day} meals per day. 
      Avoid: ${preferences.allergies?.join(', ') || 'none'} and ${preferences.foods_to_avoid?.join(', ') || 'none'}.
      Preferred cuisines: ${preferences.preferred_cuisines?.join(', ') || 'any'}.
      Include snacks: ${preferences.include_snacks ? 'Yes' : 'No'}.
      
      Output as valid JSON with this exact structure:
      {
        "days": [{
          "day": 1,
          "date": "2024-01-01",
          "meals": [{
            "type": "Breakfast",
            "name": "Meal Name",
            "recipe": "Short recipe description",
            "ingredients": ["ingredient 1", "ingredient 2"]
          }]
        }]
      }`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai-nourish-hub.com',
          'X-Title': 'AI Nourish Hub'
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct',
          messages: [
            { 
              role: 'system', 
              content: 'You are a helpful assistant that generates meal plans in valid JSON format.' 
            },
            { 
              role: 'user', 
              content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON, no other text or markdown.'
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices[0].message.content;
      
      // Try to extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\n([\s\S]*?)\n```/);
      planData = JSON.parse(jsonMatch ? jsonMatch[1] : content);

    } catch (aiError) {
      console.error('Error generating AI meal plan, using fallback:', aiError);
      planData = generateFallbackMealPlan(preferences);
    }

    // Save to database using service role to bypass RLS
    const weekStartDate = new Date().toISOString().split('T')[0];
    const { data: mealPlan, error: saveError } = await supabaseAdmin
      .from('meal_plans')
      .insert({
        user_id: user.id,
        week_start_date: weekStartDate,
        plan_data: planData,
        meals_per_day: preferences.meals_per_day,
        total_days: preferences.total_days
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving meal plan:', saveError);
      throw new Error('Failed to save meal plan');
    }

    // Save ingredients to grocery list
    try {
      const ingredients = [];
      for (const day of planData.days) {
        for (const meal of day.meals) {
          if (meal.ingredients?.length) {
            for (const ingredient of meal.ingredients) {
              ingredients.push({
                user_id: user.id,
                meal_plan_id: mealPlan.id,
                item_name: ingredient,
                quantity: '1 unit',
                is_purchased: false
              });
            }
          }
        }
      }

      if (ingredients.length > 0) {
        const { error: groceryError } = await supabaseAdmin
          .from('grocery_lists')
          .insert(ingredients);

        if (groceryError) {
          console.error('Error saving grocery items:', groceryError);
          // Don't fail the whole request if grocery list fails
        }
      }
    } catch (groceryError) {
      console.error('Error processing grocery list:', groceryError);
      // Continue even if grocery list fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        mealPlan,
        planData
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Unhandled error in generate-meal-plan:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: error.status || 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});