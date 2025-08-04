import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { UserProfileForm } from './UserProfileForm';
import { MealPlanViewer } from './MealPlanViewer';
import { GroceryList } from './GroceryList';
import { MealCalendar } from './MealCalendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, User, Calendar, ShoppingCart, ChefHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasProfile, setHasProfile] = useState(false);
  const [currentMealPlan, setCurrentMealPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkUserProfile();
      loadCurrentMealPlan();
    }
  }, [user]);

  const checkUserProfile = async () => {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    const { data: preferences } = await supabase
      .from('diet_preferences')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    setHasProfile(Boolean(profile?.full_name && preferences?.diet_type));
    setLoading(false);
  };

  const loadCurrentMealPlan = async () => {
    const { data } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setCurrentMealPlan(data);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleProfileComplete = () => {
    setHasProfile(true);
    toast({
      title: 'Profile completed!',
      description: 'You can now generate your meal plan.',
    });
  };

  const handleMealPlanGenerated = (mealPlan: any) => {
    setCurrentMealPlan(mealPlan);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto py-8 px-4">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-primary">Welcome to NutriPlanner</h1>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
          <UserProfileForm onComplete={handleProfileComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Your NutriPlanner Dashboard</h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="meal-plan" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="meal-plan" className="flex items-center gap-2">
              <ChefHat className="h-4 w-4" />
              Meal Plan
            </TabsTrigger>
            <TabsTrigger value="grocery" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Grocery List
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meal-plan">
            <MealPlanViewer 
              currentMealPlan={currentMealPlan}
              onMealPlanGenerated={handleMealPlanGenerated}
            />
          </TabsContent>

          <TabsContent value="grocery">
            <GroceryList />
          </TabsContent>

          <TabsContent value="calendar">
            <MealCalendar currentMealPlan={currentMealPlan} />
          </TabsContent>

          <TabsContent value="profile">
            <UserProfileForm onComplete={handleProfileComplete} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};