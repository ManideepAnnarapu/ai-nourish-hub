-- Create user profiles table
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  height_cm NUMERIC,
  weight_kg NUMERIC,
  fitness_goal TEXT CHECK (fitness_goal IN ('weight_loss', 'maintain', 'muscle_gain')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'lightly_active', 'active', 'very_active')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diet preferences table
CREATE TABLE public.diet_preferences (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  diet_type TEXT CHECK (diet_type IN ('vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'mediterranean', 'custom')),
  allergies TEXT[] DEFAULT '{}',
  foods_to_avoid TEXT[] DEFAULT '{}',
  preferred_cuisines TEXT[] DEFAULT '{}',
  meals_per_day INTEGER DEFAULT 3 CHECK (meals_per_day BETWEEN 1 AND 6),
  total_days INTEGER DEFAULT 7 CHECK (total_days BETWEEN 1 AND 14),
  include_snacks BOOLEAN DEFAULT false,
  meal_times JSONB DEFAULT '{}',
  reminder_tone TEXT CHECK (reminder_tone IN ('motivational', 'gentle', 'funny')),
  reminder_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meal plans table
CREATE TABLE public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  plan_data JSONB NOT NULL,
  meals_per_day INTEGER DEFAULT 3,
  total_days INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create grocery lists table
CREATE TABLE public.grocery_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity TEXT,
  is_purchased BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can manage their own profiles" ON public.user_profiles
FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for diet_preferences
CREATE POLICY "Users can manage their own diet preferences" ON public.diet_preferences
FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for meal_plans
CREATE POLICY "Users can manage their own meal plans" ON public.meal_plans
FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for grocery_lists
CREATE POLICY "Users can manage their own grocery lists" ON public.grocery_lists
FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for notifications
CREATE POLICY "Users can manage their own notifications" ON public.notifications
FOR ALL USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_diet_preferences_updated_at
  BEFORE UPDATE ON public.diet_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grocery_lists_updated_at
  BEFORE UPDATE ON public.grocery_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.diet_preferences (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();