import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Clock, ShoppingCart, Play } from 'lucide-react';

interface MealPlanViewerProps {
  currentMealPlan: any;
  onMealPlanGenerated: (mealPlan: any) => void;
}

export const MealPlanViewer = ({ currentMealPlan, onMealPlanGenerated }: MealPlanViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState(null);

  useEffect(() => {
    if (currentMealPlan?.plan_data) {
      setPlanData(currentMealPlan.plan_data);
    }
  }, [currentMealPlan]);

  const generateMealPlan = async () => {
    setLoading(true);
    try {
      console.log('Fetching user preferences...');
      // Get user preferences
      const { data: preferences, error: prefError } = await supabase
        .from('diet_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (prefError) {
        console.error('Error fetching preferences:', prefError);
        throw new Error('Failed to load your preferences. Please try again.');
      }

      if (!preferences) {
        const errorMsg = 'No preferences found. Please complete your profile first.';
        console.error(errorMsg);
        toast({
          title: 'Profile Incomplete',
          description: errorMsg,
          variant: 'destructive',
        });
        return;
      }

      console.log('Preferences loaded:', JSON.stringify(preferences, null, 2));
      console.log('Calling generate-meal-plan Edge Function...');
      
      try {
        // Call the edge function with timeout
        const response = await Promise.race([
          supabase.functions.invoke('generate-meal-plan', {
            body: { preferences }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out after 20s')), 20000)
          )
        ]) as { data: any, error: any };

        console.log('Edge Function response:', response);

        if (response.error) {
          console.error('Edge Function returned an error:', response.error);
          throw new Error(response.error.message || 'Failed to generate meal plan');
        }

        if (!response.data) {
          throw new Error('No data returned from the server');
        }

        if (response.data.success) {
          console.log('Meal plan generated successfully:', response.data.mealPlan);
          setPlanData(response.data.planData);
          onMealPlanGenerated(response.data.mealPlan);
          toast({
            title: 'Success!',
            description: 'Your meal plan has been generated.',
          });
        } else {
          console.error('Unexpected response format:', response.data);
          throw new Error('Unexpected response from the server');
        }
      } catch (edgeError: any) {
        console.error('Edge Function call failed:', edgeError);
        throw new Error(`Failed to generate meal plan: ${edgeError.message}`);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate meal plan',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addIngredientsToGroceryList = async (meal: any, mealPlanId: string | undefined) => {
    if (!meal.ingredients || meal.ingredients.length === 0) {
      toast({
        title: 'No ingredients',
        description: 'This meal has no ingredients to add.',
        variant: 'destructive',
      });
      return;
    }

    if (!mealPlanId) {
      toast({
        title: 'Error',
        description: 'No meal plan is currently selected. Please generate or select a meal plan first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // First, verify the meal plan exists
      const { data: mealPlan, error: mealPlanError } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('id', mealPlanId)
        .single();

      if (mealPlanError || !mealPlan) {
        throw new Error('The associated meal plan could not be found.');
      }

      const ingredients = meal.ingredients.map((ingredient: string) => ({
        user_id: user?.id,
        meal_plan_id: mealPlanId,
        item_name: ingredient,
        quantity: '1 unit',
        is_purchased: false
      }));

      const { error } = await supabase
        .from('grocery_lists')
        .insert(ingredients);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Ingredients added to grocery list.',
      });
    } catch (error: any) {
      console.error('Error adding to grocery list:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add ingredients to grocery list.',
        variant: 'destructive',
      });
    }  
  };

  const getYouTubeSearchUrl = (mealName: string) => {
    const query = encodeURIComponent(`${mealName} recipe`);
    return `https://www.youtube.com/results?search_query=${query}`;
  };

  if (!planData) {
    return (
      <Card>
        <CardHeader className="text-center">
          <ChefHat className="h-16 w-16 mx-auto mb-4 text-primary" />
          <CardTitle>Generate Your Meal Plan</CardTitle>
          <CardDescription>
            Create a personalized meal plan based on your preferences and goals
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={generateMealPlan} disabled={loading} size="lg">
            {loading ? 'Generating...' : 'Generate My Meal Plan'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Meal Plan</h2>
          <p className="text-muted-foreground">
            {planData.days?.length || 0} days • Generated on {currentMealPlan?.created_at ? new Date(currentMealPlan.created_at).toLocaleDateString() : 'today'}
          </p>
        </div>
        <Button onClick={generateMealPlan} disabled={loading}>
          {loading ? 'Regenerating...' : 'Generate New Plan'}
        </Button>
      </div>

      <Tabs defaultValue="day-1" className="w-full">
        <TabsList className="grid grid-cols-7 w-full">
          {planData.days?.map((day: any, index: number) => (
            <TabsTrigger key={day.day} value={`day-${day.day}`}>
              Day {day.day}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {planData.days?.map((day: any) => (
          <TabsContent key={day.day} value={`day-${day.day}`} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline">{day.date}</Badge>
              <Badge>{day.meals?.length || 0} meals</Badge>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {day.meals?.map((meal: any, mealIndex: number) => (
                <Card key={mealIndex} className="h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{meal.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {meal.type}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{meal.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Recipe</h4>
                      <p className="text-sm text-muted-foreground">
                        {meal.recipe || 'No recipe available'}
                      </p>
                    </div>
                    
                    {meal.ingredients && meal.ingredients.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Ingredients</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {meal.ingredients.slice(0, 5).map((ingredient: string, i: number) => (
                            <li key={i}>• {ingredient}</li>
                          ))}
                          {meal.ingredients.length > 5 && (
                            <li className="text-xs">...and {meal.ingredients.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.open(getYouTubeSearchUrl(meal.name), '_blank')}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Recipe Video
                      </Button>
                      
                      {meal.ingredients && meal.ingredients.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!currentMealPlan?.id) {
                              toast({
                                title: 'Error',
                                description: 'No active meal plan found. Please generate a meal plan first.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            addIngredientsToGroceryList(meal, currentMealPlan.id);
                          }}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Add to List
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};