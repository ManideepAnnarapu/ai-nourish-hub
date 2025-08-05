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
import { LogOut, User, Calendar, ShoppingCart, ChefHat, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasProfile, setHasProfile] = useState(false);
  const [currentMealPlan, setCurrentMealPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user) {
      const checkAuth = async () => {
        await checkUserProfile();
        await loadCurrentMealPlan();
      };
      checkAuth();
    }
  }, [user]);

  const checkUserProfile = async () => {
    try {
      setLoading(true);
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
      
      if (isProfileComplete) {
        setActiveTab('meal-plan');
      } else {
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
    try {
      // Force a small delay to ensure the database has time to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the profile data
      await checkUserProfile();
      
      // Force update the tab to meal-plan after profile completion
      setActiveTab('meal-plan');
      
      toast({
        title: 'Profile updated!',
        description: 'Your profile has been saved successfully.',
      });
    } catch (error) {
      console.error('Error in handleProfileComplete:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile status. Please refresh the page.',
        variant: 'destructive',
      });
    }
  };

  const handleMealPlanGenerated = (mealPlan: any) => {
    setCurrentMealPlan(mealPlan);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20 flex items-center justify-center">
        <div className="glass p-8 rounded-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show modern full-screen profile form only if profile is incomplete
  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20">
        {/* Welcome Header */}
        <div className="glass border-b border-border/20 backdrop-blur-xl">
          <div className="container mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
                <ChefHat className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                  Welcome to NutriPlanner
                </h1>
                <p className="text-muted-foreground">Let's set up your personalized nutrition journey</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
        
        <div className="pt-8 pb-8">
          <div className="container mx-auto px-4">
            <UserProfileForm onComplete={handleProfileComplete} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20">
      {/* Modern Fixed Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/20 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <ChefHat className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              NutriPlanner
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="glass px-3 py-1.5 rounded-full text-sm text-muted-foreground">
              Welcome, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content with proper spacing for fixed nav */}
      <div className="pt-20 pb-8">
        <div className="container mx-auto px-4">
          {/* Modern Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="glass p-2 rounded-2xl bg-secondary/40 border border-border/20 shadow-lg">
                <TabsTrigger 
                  value="meal-plan" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-xl px-6 py-3 font-medium transition-all duration-300 hover:bg-secondary/60"
                >
                  <ChefHat className="h-4 w-4 mr-2" />
                  Meal Plan
                </TabsTrigger>
                <TabsTrigger 
                  value="grocery" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-xl px-6 py-3 font-medium transition-all duration-300 hover:bg-secondary/60"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Grocery List
                </TabsTrigger>
                <TabsTrigger 
                  value="calendar" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-xl px-6 py-3 font-medium transition-all duration-300 hover:bg-secondary/60"
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger 
                  value="profile" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-xl px-6 py-3 font-medium transition-all duration-300 hover:bg-secondary/60"
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="animate-fade-in">
              <TabsContent value="meal-plan" className="mt-0">
                <MealPlanViewer 
                  currentMealPlan={currentMealPlan} 
                  onMealPlanGenerated={handleMealPlanGenerated} 
                />
              </TabsContent>

              <TabsContent value="grocery" className="mt-0">
                <GroceryList />
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <MealCalendar currentMealPlan={currentMealPlan} />
              </TabsContent>

              <TabsContent value="profile" className="mt-0">
                <UserProfileForm onComplete={handleProfileComplete} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};