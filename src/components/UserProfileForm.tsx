import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserProfileFormProps {
  onComplete: () => void;
}

export const UserProfileForm = ({ onComplete }: UserProfileFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date>();

  // Profile data
  const [profileData, setProfileData] = useState({
    full_name: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    fitness_goal: '',
    activity_level: '',
  });

  // Diet preferences
  const [dietData, setDietData] = useState({
    diet_type: '',
    allergies: [] as string[],
    foods_to_avoid: [] as string[],
    preferred_cuisines: [] as string[],
    meals_per_day: 3,
    total_days: 7,
    include_snacks: false,
    meal_times: {
      breakfast: '08:00',
      lunch: '12:00',
      dinner: '18:00',
    },
    reminder_tone: 'motivational',
    reminder_enabled: true,
  });

  const [foodsToAvoidText, setFoodsToAvoidText] = useState('');

  const allergyOptions = ['dairy', 'nuts', 'gluten', 'soy', 'eggs', 'shellfish', 'citrus'];
  const cuisineOptions = ['indian', 'mediterranean', 'asian', 'italian', 'mexican', 'american', 'mixed'];

  useEffect(() => {
    loadExistingData();
  }, [user]);

  const loadExistingData = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, gender, height_cm, weight_kg, fitness_goal, activity_level, date_of_birth')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: preferences } = await supabase
      .from('diet_preferences')
      .select('diet_type, allergies, foods_to_avoid, preferred_cuisines, include_snacks, reminder_tone, reminder_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        gender: profile.gender || '',
        height_cm: profile.height_cm?.toString() || '',
        weight_kg: profile.weight_kg?.toString() || '',
        fitness_goal: profile.fitness_goal || '',
        activity_level: profile.activity_level || '',
      });
      if (profile.date_of_birth) {
        setDateOfBirth(new Date(profile.date_of_birth));
      }
    }

    if (preferences) {
      setDietData({
        diet_type: preferences.diet_type || '',
        allergies: preferences.allergies || [],
        foods_to_avoid: preferences.foods_to_avoid || [],
        preferred_cuisines: preferences.preferred_cuisines || [],
        meals_per_day: 3,
        total_days: 7,
        include_snacks: preferences.include_snacks || false,
        meal_times: {
          breakfast: '08:00',
          lunch: '12:00',
          dinner: '18:00',
        },
        reminder_tone: preferences.reminder_tone || 'motivational',
        reminder_enabled: preferences.reminder_enabled ?? true,
      });
      setFoodsToAvoidText(preferences.foods_to_avoid?.join(', ') || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update user profile
      const profileUpdate = {
        full_name: profileData.full_name,
        gender: profileData.gender as any,
        height_cm: profileData.height_cm ? parseFloat(profileData.height_cm) : null,
        weight_kg: profileData.weight_kg ? parseFloat(profileData.weight_kg) : null,
        fitness_goal: profileData.fitness_goal as any,
        activity_level: profileData.activity_level as any,
        date_of_birth: dateOfBirth?.toISOString().split('T')[0] || null,
      };

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('user_id', user?.id!);

      if (profileError) throw profileError;

      // Update diet preferences
      const { error: dietError } = await supabase
        .from('diet_preferences')
        .upsert({
          user_id: user?.id,
          ...dietData,
          foods_to_avoid: foodsToAvoidText.split(',').map(s => s.trim()).filter(Boolean),
        });

      if (dietError) throw dietError;

      toast({
        title: 'Profile saved!',
        description: 'Your preferences have been updated successfully.',
      });

      onComplete();
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

  const handleAllergyChange = (allergy: string, checked: boolean) => {
    setDietData(prev => ({
      ...prev,
      allergies: checked 
        ? [...prev.allergies, allergy]
        : prev.allergies.filter(a => a !== allergy)
    }));
  };

  const handleCuisineChange = (cuisine: string, checked: boolean) => {
    setDietData(prev => ({
      ...prev,
      preferred_cuisines: checked 
        ? [...prev.preferred_cuisines, cuisine]
        : prev.preferred_cuisines.filter(c => c !== cuisine)
    }));
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Complete Your Profile</CardTitle>
        <CardDescription>
          Help us create personalized meal plans just for you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateOfBirth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateOfBirth ? format(dateOfBirth, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateOfBirth}
                      onSelect={setDateOfBirth}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={profileData.gender} onValueChange={(value) => setProfileData(prev => ({ ...prev, gender: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="height_cm">Height (cm)</Label>
                <Input
                  id="height_cm"
                  type="number"
                  value={profileData.height_cm}
                  onChange={(e) => setProfileData(prev => ({ ...prev, height_cm: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  value={profileData.weight_kg}
                  onChange={(e) => setProfileData(prev => ({ ...prev, weight_kg: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Fitness Goal</Label>
                <Select value={profileData.fitness_goal} onValueChange={(value) => setProfileData(prev => ({ ...prev, fitness_goal: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fitness goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight_loss">Weight Loss</SelectItem>
                    <SelectItem value="maintain">Maintain</SelectItem>
                    <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Activity Level</Label>
                <Select value={profileData.activity_level} onValueChange={(value) => setProfileData(prev => ({ ...prev, activity_level: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select activity level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Sedentary</SelectItem>
                    <SelectItem value="lightly_active">Lightly Active</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="very_active">Very Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Diet Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Diet Preferences</h3>
            
            <div className="space-y-2">
              <Label>Diet Type</Label>
              <Select value={dietData.diet_type} onValueChange={(value) => setDietData(prev => ({ ...prev, diet_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select diet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vegetarian">Vegetarian</SelectItem>
                  <SelectItem value="vegan">Vegan</SelectItem>
                  <SelectItem value="gluten_free">Gluten-Free</SelectItem>
                  <SelectItem value="dairy_free">Dairy-Free</SelectItem>
                  <SelectItem value="mediterranean">Mediterranean</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Allergies</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {allergyOptions.map((allergy) => (
                  <div key={allergy} className="flex items-center space-x-2">
                    <Checkbox
                      id={allergy}
                      checked={dietData.allergies.includes(allergy)}
                      onCheckedChange={(checked) => handleAllergyChange(allergy, checked as boolean)}
                    />
                    <Label htmlFor={allergy} className="capitalize">{allergy}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="foods_to_avoid">Foods to Avoid (comma-separated)</Label>
              <Textarea
                id="foods_to_avoid"
                value={foodsToAvoidText}
                onChange={(e) => setFoodsToAvoidText(e.target.value)}
                placeholder="e.g., spicy food, raw fish, etc."
              />
            </div>

            <div className="space-y-2">
              <Label>Preferred Cuisines</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {cuisineOptions.map((cuisine) => (
                  <div key={cuisine} className="flex items-center space-x-2">
                    <Checkbox
                      id={cuisine}
                      checked={dietData.preferred_cuisines.includes(cuisine)}
                      onCheckedChange={(checked) => handleCuisineChange(cuisine, checked as boolean)}
                    />
                    <Label htmlFor={cuisine} className="capitalize">{cuisine}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meals_per_day">Meals per Day</Label>
                <Select value={dietData.meals_per_day.toString()} onValueChange={(value) => setDietData(prev => ({ ...prev, meals_per_day: parseInt(value) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_days">Total Days</Label>
                <Select value={dietData.total_days.toString()} onValueChange={(value) => setDietData(prev => ({ ...prev, total_days: parseInt(value) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 14 }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="include_snacks"
                  checked={dietData.include_snacks}
                  onCheckedChange={(checked) => setDietData(prev => ({ ...prev, include_snacks: checked }))}
                />
                <Label htmlFor="include_snacks">Include Snacks</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meal Times</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="breakfast_time">Breakfast</Label>
                  <Input
                    id="breakfast_time"
                    type="time"
                    value={dietData.meal_times.breakfast}
                    onChange={(e) => setDietData(prev => ({ 
                      ...prev, 
                      meal_times: { ...prev.meal_times, breakfast: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunch_time">Lunch</Label>
                  <Input
                    id="lunch_time"
                    type="time"
                    value={dietData.meal_times.lunch}
                    onChange={(e) => setDietData(prev => ({ 
                      ...prev, 
                      meal_times: { ...prev.meal_times, lunch: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinner_time">Dinner</Label>
                  <Input
                    id="dinner_time"
                    type="time"
                    value={dietData.meal_times.dinner}
                    onChange={(e) => setDietData(prev => ({ 
                      ...prev, 
                      meal_times: { ...prev.meal_times, dinner: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reminder Tone</Label>
                <Select value={dietData.reminder_tone} onValueChange={(value) => setDietData(prev => ({ ...prev, reminder_tone: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motivational">Motivational</SelectItem>
                    <SelectItem value="gentle">Gentle</SelectItem>
                    <SelectItem value="funny">Funny</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="reminder_enabled"
                  checked={dietData.reminder_enabled}
                  onCheckedChange={(checked) => setDietData(prev => ({ ...prev, reminder_enabled: checked }))}
                />
                <Label htmlFor="reminder_enabled">Enable Reminders</Label>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Save Profile & Preferences'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};