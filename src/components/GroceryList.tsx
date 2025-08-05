import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, MapPin, Trash2 } from 'lucide-react';

interface GroceryItem {
  id: string;
  item_name: string;
  quantity: string;
  is_purchased: boolean;
  notes?: string;
}

export const GroceryList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCurrentWeekGroceryItems();
    }
  }, [user]);

  // Helper to get current week's start and end dates (Monday to Sunday)
  const getCurrentWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    // Monday as start of week
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { weekStart, weekEnd };
  };

  // Load grocery items only if a meal plan was created this week
  const loadCurrentWeekGroceryItems = async () => {
    setLoading(true);
    try {
      // 1. Find meal plan created in current week
      const { weekStart, weekEnd } = getCurrentWeekRange();
      const { data: mealPlans, error: mealPlanError } = await supabase
        .from('meal_plans')
        .select('id, created_at, week_start_date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (mealPlanError) throw mealPlanError;
      const thisWeekPlan = (mealPlans || []).find(mp => {
        const created = new Date(mp.created_at);
        return created >= weekStart && created <= weekEnd;
      });
      if (!thisWeekPlan) {
        setGroceryItems([]);
        setLoading(false);
        return;
      }
      // 2. Fetch grocery items for that meal plan's week_start_date
      const { data, error } = await supabase
        .from('grocery_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', thisWeekPlan.week_start_date)
        .order('item_name', { ascending: true });
      if (error) throw error;
      // Group by item name and combine quantities
      const groupedItems = (data || []).reduce((acc: Record<string, GroceryItem>, item) => {
        const key = item.item_name.toLowerCase();
        if (acc[key]) {
          const quantities = acc[key].quantity.split(', ');
          if (!quantities.includes(item.quantity)) {
            quantities.push(item.quantity);
          }
          acc[key].quantity = quantities.join(', ');
        } else {
          acc[key] = {
            id: item.id,
            item_name: item.item_name,
            quantity: item.quantity || '1 unit',
            is_purchased: item.is_purchased,
            notes: item.notes,
          };
        }
        return acc;
      }, {});
      setGroceryItems(Object.values(groupedItems));
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


  const togglePurchased = async (itemId: string, isPurchased: boolean) => {
    try {
      const { error } = await supabase
        .from('grocery_lists')
        .update({ is_purchased: isPurchased })
        .eq('id', itemId);

      if (error) throw error;

      setGroceryItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, is_purchased: isPurchased } : item
        )
      );
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const clearPurchased = async () => {
    try {
      const { error } = await supabase
        .from('grocery_lists')
        .delete()
        .eq('user_id', user?.id)
        .eq('is_purchased', true);

      if (error) throw error;

      loadCurrentWeekGroceryItems();
      toast({
        title: 'Success',
        description: 'Purchased items cleared.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const searchNearbyStores = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const url = `https://www.google.com/maps/search/grocery+stores/@${latitude},${longitude},15z`;
        window.open(url, '_blank');
      }, () => {
        // If geolocation fails, just search for grocery stores
        window.open('https://www.google.com/maps/search/grocery+stores', '_blank');
      });
    } else {
      window.open('https://www.google.com/maps/search/grocery+stores', '_blank');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  const purchasedCount = groceryItems.filter(item => item.is_purchased).length;
  const totalCount = groceryItems.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
            Grocery List
          </h2>
          <p className="text-muted-foreground">
            {purchasedCount} of {totalCount} items purchased
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={searchNearbyStores} className="action-btn rounded-xl">
            <MapPin className="h-4 w-4 mr-2" />
            Find Stores
          </Button>
          {purchasedCount > 0 && (
            <Button variant="outline" onClick={clearPurchased} className="action-btn rounded-xl hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Purchased
            </Button>
          )}
        </div>
      </div>

      {groceryItems.length === 0 ? (
        <div className="card-modern max-w-2xl mx-auto">
          <CardHeader className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/20 flex items-center justify-center">
              <ShoppingCart className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display">No items in your grocery list</CardTitle>
            <CardDescription className="text-lg mt-2">
              Generate a meal plan to automatically populate your grocery list
            </CardDescription>
          </CardHeader>
        </div>
      ) : (
        <div className="card-modern">
          <CardHeader className="border-b border-border/20">
            <CardTitle className="flex items-center gap-3 text-xl font-display">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-primary-foreground" />
              </div>
              Shopping List
            </CardTitle>
            <CardDescription>
              Check off items as you shop
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {groceryItems.map((item) => (
                <div
                  key={item.id}
                  className={`glass p-4 rounded-xl border transition-all duration-300 ${
                    item.is_purchased 
                      ? 'bg-muted/30 border-muted' 
                      : 'border-border/20 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <Checkbox
                      checked={item.is_purchased}
                      onCheckedChange={(checked) => togglePurchased(item.id, checked as boolean)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${item.is_purchased ? 'line-through text-muted-foreground' : ''}`}>
                        {item.item_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.notes}
                        </div>
                      )}
                    </div>
                    {item.is_purchased && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full">
                        Purchased
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </div>
      )}
    </div>
  );
};