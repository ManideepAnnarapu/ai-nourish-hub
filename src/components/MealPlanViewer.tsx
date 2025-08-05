import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Clock, ShoppingCart, Play, Utensils, Star } from 'lucide-react';

interface MealPlanViewerProps {
  currentMealPlan: any;
  onMealPlanGenerated: (mealPlan: any) => void;
}

export const MealPlanViewer = ({ currentMealPlan, onMealPlanGenerated }: MealPlanViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  const [defaultTab, setDefaultTab] = useState<string>('day-1');

  // Helper: Get start of week (Sunday)
  function getStartOfWeek(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Sunday = 0
    return d;
  }

  // Helper: Format date as yyyy-mm-dd
  function formatDate(date: Date) {
    return date.toISOString().split('T')[0];
  }

  // On planData or currentMealPlan change, update planData with correct dates and set default tab
  useEffect(() => {
    if (currentMealPlan?.plan_data) {
      // Find the week start (Sunday) for the meal plan
      let weekStart: Date;
      if (currentMealPlan.week_start_date) {
        weekStart = new Date(currentMealPlan.week_start_date);
      } else {
        weekStart = getStartOfWeek(new Date());
      }

      // Map days to add correct date
      const daysWithDates = currentMealPlan.plan_data.days?.map((day: any, idx: number) => {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + idx); // idx: 0=Sunday, 1=Monday, ...
        return {
          ...day,
          date: formatDate(dayDate),
        };
      });

      setPlanData({ ...currentMealPlan.plan_data, days: daysWithDates });

      // Set default tab to today (relative to week start)
      const today = new Date();
      const todayIdx = (today.getDay()); // 0=Sunday, 1=Monday, ...
      setDefaultTab(`day-${todayIdx + 1}`); // Day 1 = Sunday
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
      // Get the meal plan to get the week_start_date
      const { data: mealPlan, error: mealPlanError } = await supabase
        .from('meal_plans')
        .select('week_start_date')
        .eq('id', mealPlanId)
        .single();

      if (mealPlanError || !mealPlan) {
        throw new Error('The associated meal plan could not be found.');
      }

      if (!mealPlan.week_start_date) {
        throw new Error('Meal plan is missing week start date.');
      }

      // Insert each ingredient as a separate grocery list item
      const { error } = await supabase
        .from('grocery_lists')
        .insert(
          meal.ingredients.map((ingredient: string) => ({
            user_id: user?.id,
            week_start_date: mealPlan.week_start_date,
            item_name: ingredient,
            quantity: '1 unit',
            is_purchased: false
          }))
        );

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

  // Helper function to get meal type styling
  const getMealTypeClass = (mealType: string) => {
    const type = mealType.toLowerCase();
    if (type.includes('breakfast')) return 'meal-breakfast';
    if (type.includes('lunch')) return 'meal-lunch';
    if (type.includes('dinner')) return 'meal-dinner';
    if (type.includes('snack')) return 'meal-snack';
    return 'meal-breakfast';
  };

  if (!planData) {
    return (
      <div className="card-modern max-w-2xl mx-auto w-full">
        <CardHeader className="text-center pb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <ChefHat className="h-10 w-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-display">Generate Your Meal Plan</CardTitle>
          <CardDescription className="text-lg mt-2">
            Create a personalized meal plan based on your preferences and goals
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-8">
          <Button 
            onClick={generateMealPlan} 
            disabled={loading} 
            size="lg"
            className="btn-gradient px-8 py-4 text-lg font-semibold rounded-2xl min-w-[200px]"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground border-t-transparent mr-3"></div>
                Generating...
              </>
            ) : (
              <>
                <Star className="h-5 w-5 mr-3" />
                Generate My Meal Plan
              </>
            )}
          </Button>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in px-2 sm:px-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
            Your Meal Plan
          </h2>
          <p className="text-muted-foreground">
            {planData.days?.length || 0} days • Generated on {currentMealPlan?.created_at ? new Date(currentMealPlan.created_at).toLocaleDateString() : 'today'}
          </p>
        </div>
        <Button 
          onClick={generateMealPlan} 
          disabled={loading}
          className="btn-gradient px-6 py-3 rounded-xl font-medium"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2"></div>
              Regenerating...
            </>
          ) : (
            <>
              <Star className="h-4 w-4 mr-2" />
              Generate New Plan
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        {/* Modern Pill-shaped Day Tabs */}
        <div className="flex justify-center mb-8">
          <TabsList className="glass p-2 rounded-2xl bg-secondary/40 border border-border/20 shadow-lg flex-wrap">
            {planData.days?.map((day: any, index: number) => (
              <TabsTrigger 
                key={day.day} 
                value={`day-${day.day}`}
                className="pill-tab"
              >
                Day {day.day}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        {planData.days?.map((day: any) => (
          <TabsContent key={day.day} value={`day-${day.day}`} className="space-y-6 animate-scale-in">
            {/* Day Header */}
            <div className="glass p-4 rounded-2xl border border-border/20 text-center">
              <h3 className="font-display text-xl font-semibold mb-2">
                Day {day.day}
              </h3>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {new Date(day.date).toLocaleDateString()}
                </Badge>
                <Badge className="rounded-full px-3 py-1 bg-primary/10 text-primary border-primary/20">
                  <Utensils className="h-3 w-3 mr-1" />
                  {day.meals?.length || 0} meals
                </Badge>
              </div>
            </div>
            
            {/* Meal Cards Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {day.meals?.map((meal: any, mealIndex: number) => (
                <div key={mealIndex} className="card-modern group hover:scale-102 transition-transform duration-300">
                  {/* Meal Image Placeholder */}
                  <div className="h-48 bg-gradient-to-br from-primary/10 via-secondary/20 to-accent/10 rounded-t-[var(--radius-large)] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10"></div>
                    <div className="relative z-10 text-center">
                      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Utensils className="h-8 w-8 text-primary" />
                      </div>
                      <Badge className={`${getMealTypeClass(meal.type)} rounded-full px-3 py-1 font-medium`}>
                        {meal.type}
                      </Badge>
                    </div>
                  </div>

                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-display leading-tight">
                      {meal.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Perfect for {meal.type.toLowerCase()}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Recipe Description */}
                    <div>
                      <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Recipe</h4>
                      <p className="text-sm leading-relaxed">
                        {meal.recipe || 'A delicious and nutritious meal tailored to your preferences.'}
                      </p>
                    </div>
                    
                    {/* Ingredients */}
                    {meal.ingredients && meal.ingredients.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Ingredients</h4>
                        <div className="glass p-3 rounded-xl">
                          <ul className="text-sm space-y-1">
                            {meal.ingredients.slice(0, 4).map((ingredient: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                <span>{ingredient}</span>
                              </li>
                            ))}
                            {meal.ingredients.length > 4 && (
                              <li className="text-xs text-muted-foreground font-medium pt-1">
                                +{meal.ingredients.length - 4} more ingredients
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="action-btn rounded-xl border-primary/20 hover:bg-primary/5 hover:border-primary/40 w-full"
                        onClick={() => window.open(getYouTubeSearchUrl(meal.name), '_blank')}
                      >
                        <Play className="h-4 w-4" />
                        Watch Recipe Video
                      </Button>
                      
                      {meal.ingredients && meal.ingredients.length > 0 && (
                        <Button
                          className="action-btn btn-gradient w-full rounded-xl"
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
                          <ShoppingCart className="h-4 w-4" />
                          Add to Grocery List
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};