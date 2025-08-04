import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Clock, Bell, Plus } from 'lucide-react';
import { format, startOfWeek, addDays, isSunday } from 'date-fns';

interface MealCalendarProps {
  currentMealPlan: any;
}

interface Notification {
  id: string;
  message: string;
  scheduled_time: string;
  is_sent: boolean;
}

export const MealCalendar = ({ currentMealPlan }: MealCalendarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    }
  };

  const generateWeeklyReminders = async () => {
    if (!currentMealPlan?.plan_data) {
      toast({
        title: 'No meal plan',
        description: 'Generate a meal plan first to create reminders.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Get user preferences for meal times
      const { data: preferences } = await supabase
        .from('diet_preferences')
        .select('meal_times, reminder_tone')
        .eq('user_id', user?.id)
        .single();

      const mealTimes = preferences?.meal_times || {
        breakfast: '08:00',
        lunch: '12:00',
        dinner: '18:00',
      };

      const reminderTone = preferences?.reminder_tone || 'motivational';

      // Generate notifications for each day and meal
      const newNotifications = [];
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday

      for (const day of currentMealPlan.plan_data.days) {
        const dayDate = addDays(weekStart, day.day - 1);
        
        for (const meal of day.meals) {
          const mealType = meal.type.toLowerCase();
          const mealTime = mealTimes[mealType] || '12:00';
          
          // Create scheduled time for the meal
          const [hours, minutes] = mealTime.split(':');
          const scheduledTime = new Date(dayDate);
          scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          // Prep reminder (1 hour before)
          const prepTime = new Date(scheduledTime);
          prepTime.setHours(prepTime.getHours() - 1);

          // Different messages based on reminder tone
          let prepMessage, mealMessage;
          
          switch (reminderTone) {
            case 'funny':
              prepMessage = `🍳 Time to channel your inner chef! Get ready to make ${meal.name}`;
              mealMessage = `🍽️ Your stomach is calling - ${meal.name} is ready to be devoured!`;
              break;
            case 'gentle':
              prepMessage = `🌿 Gentle reminder: It's time to start preparing ${meal.name}`;
              mealMessage = `🍃 Time for your ${meal.type.toLowerCase()}. Enjoy your ${meal.name}`;
              break;
            default: // motivational
              prepMessage = `💪 Fuel your body! Time to prep ${meal.name}`;
              mealMessage = `🌟 Your day gets better when you eat well. It's time for ${meal.name}!`;
          }

          newNotifications.push({
            user_id: user?.id,
            meal_plan_id: currentMealPlan.id,
            message: prepMessage,
            scheduled_time: prepTime.toISOString(),
            is_sent: false,
          });

          newNotifications.push({
            user_id: user?.id,
            meal_plan_id: currentMealPlan.id,
            message: mealMessage,
            scheduled_time: scheduledTime.toISOString(),
            is_sent: false,
          });
        }
      }

      // Add Sunday regeneration reminder
      const nextSunday = addDays(weekStart, 6);
      nextSunday.setHours(10, 0, 0, 0);
      
      newNotifications.push({
        user_id: user?.id,
        meal_plan_id: currentMealPlan.id,
        message: "🗓️ Ready for your next week's plan? Time to regenerate your meal plan!",
        scheduled_time: nextSunday.toISOString(),
        is_sent: false,
      });

      // Save all notifications
      const { error } = await supabase
        .from('notifications')
        .insert(newNotifications);

      if (error) throw error;

      loadNotifications();
      toast({
        title: 'Success!',
        description: `${newNotifications.length} reminders created for your meal plan.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const clearOldNotifications = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id)
        .lt('scheduled_time', new Date().toISOString());

      if (error) throw error;

      loadNotifications();
      toast({
        title: 'Success',
        description: 'Old notifications cleared.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getSelectedDateMeals = () => {
    if (!currentMealPlan?.plan_data) return [];

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const daysDiff = Math.floor((selectedDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayNumber = daysDiff + 1;

    const day = currentMealPlan.plan_data.days?.find((d: any) => d.day === dayNumber);
    return day?.meals || [];
  };

  const upcomingNotifications = notifications.filter(n => 
    new Date(n.scheduled_time) > new Date()
  ).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Meal Calendar & Reminders</h2>
          <p className="text-muted-foreground">
            Schedule and track your meal times
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearOldNotifications}>
            Clear Old
          </Button>
          <Button onClick={generateWeeklyReminders} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Create Reminders'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Meal Calendar
            </CardTitle>
            <CardDescription>
              Select a date to view your planned meals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full"
            />
          </CardContent>
        </Card>

        {/* Selected Date Meals */}
        <Card>
          <CardHeader>
            <CardTitle>
              Meals for {format(selectedDate, 'MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getSelectedDateMeals().length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No meals planned for this date
              </p>
            ) : (
              <div className="space-y-4">
                {getSelectedDateMeals().map((meal: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Badge variant="outline">{meal.type}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{meal.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {meal.recipe?.substring(0, 100)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Upcoming Reminders
          </CardTitle>
          <CardDescription>
            Your scheduled meal notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingNotifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No upcoming reminders. Create some reminders for your meal plan!
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingNotifications.map((notification) => (
                <div key={notification.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{notification.message}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(notification.scheduled_time), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sunday Regeneration Notice */}
      {isSunday(new Date()) && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-primary">🗓️ Weekly Planning Day!</CardTitle>
            <CardDescription>
              It's Sunday - the perfect time to plan your upcoming week's meals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Generate Next Week's Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};