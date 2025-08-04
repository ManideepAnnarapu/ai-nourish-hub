import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { preferences } = await req.json();

    // Create meal plan prompt
    const prompt = `Create a ${preferences.total_days}-day ${preferences.diet_type} meal plan with ${preferences.meals_per_day} meals per day. 
    Avoid: ${preferences.allergies?.join(', ')} and ${preferences.foods_to_avoid?.join(', ')}.
    Preferred cuisines: ${preferences.preferred_cuisines?.join(', ')}.
    Include snacks: ${preferences.include_snacks ? 'Yes' : 'No'}.
    
    Output as structured JSON with this exact format:
    {
      "days": [
        {
          "day": 1,
          "date": "2024-01-01",
          "meals": [
            {
              "type": "Breakfast",
              "name": "Meal Name",
              "recipe": "Short recipe description with ingredients and steps",
              "ingredients": ["ingredient 1", "ingredient 2"]
            }
          ]
        }
      ]
    }
    
    Make sure each day has exactly ${preferences.meals_per_day} meals. Include realistic, healthy recipes with clear ingredient lists.`;

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const aiResponse = await response.json();
    let planData;
    
    try {
      // Try to parse the JSON from the AI response
      const content = aiResponse.choices[0].message.content;
      planData = JSON.parse(content);
    } catch (parseError) {
      // If parsing fails, create a fallback structure
      console.error('Failed to parse AI response:', parseError);
      planData = {
        days: Array.from({ length: preferences.total_days }, (_, i) => ({
          day: i + 1,
          date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          meals: [
            { type: 'Breakfast', name: 'Sample Breakfast', recipe: 'A healthy breakfast meal', ingredients: ['oats', 'milk'] },
            { type: 'Lunch', name: 'Sample Lunch', recipe: 'A nutritious lunch', ingredients: ['chicken', 'vegetables'] },
            { type: 'Dinner', name: 'Sample Dinner', recipe: 'A balanced dinner', ingredients: ['fish', 'rice'] }
          ].slice(0, preferences.meals_per_day)
        }))
      };
    }

    // Save meal plan to database
    const weekStartDate = new Date().toISOString().split('T')[0];
    const { data: mealPlan, error: saveError } = await supabase
      .from('meal_plans')
      .insert({
        user_id: user.id,
        week_start_date: weekStartDate,
        plan_data: planData,
        meals_per_day: preferences.meals_per_day,
        total_days: preferences.total_days,
      })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    // Extract and save ingredients to grocery list
    const ingredients = [];
    for (const day of planData.days) {
      for (const meal of day.meals) {
        if (meal.ingredients) {
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
      await supabase
        .from('grocery_lists')
        .insert(ingredients);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      mealPlan,
      planData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meal-plan function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});