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
  const [activeTab, setActiveTab] = useState('profile'); // Default to profile tab

  useEffect(() => {
    if (user) {
      checkUserProfile();
      loadCurrentMealPlan();
      // Check if profile was previously completed
      const isProfileComplete = localStorage.getItem('profileComplete') === 'true';
      if (isProfileComplete) {
        setActiveTab('meal-plan');
      }
    }
  }, [user]);

  const checkUserProfile = async () => {
    try {
      const [
        { data: profile },
        { data: preferences }
      ] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user?.id)
          .single(),
        supabase
          .from('diet_preferences')
          .select('*')
          .eq('user_id', user?.id)
          .single()
      ]);

      const isProfileComplete = Boolean(profile?.full_name && preferences?.diet_type);
      setHasProfile(isProfileComplete);
      
      // If profile is complete, switch to meal plan tab
      if (isProfileComplete) {
        localStorage.setItem('profileComplete', 'true');
        setActiveTab('meal-plan');
      } else {
        localStorage.removeItem('profileComplete');
        setActiveTab('profile');
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
      setHasProfile(false);
      setActiveTab('profile');
    } finally {
      setLoading(false);
    }
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

  const handleProfileComplete = async () => {
    // Refresh the profile data to ensure we have the latest state
    await checkUserProfile();
    
    toast({
      title: 'Profile updated!',
      description: 'Your profile has been saved successfully.',
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

        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
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