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
    loadGroceryItems();
  }, [user]);

  const loadGroceryItems = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('grocery_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by item name and sum quantities
      const groupedItems = data.reduce((acc: Record<string, GroceryItem>, item) => {
        const key = item.item_name.toLowerCase();
        if (acc[key]) {
          // If item already exists, combine quantities (simplified)
          acc[key].quantity = `${acc[key].quantity}, ${item.quantity}`;
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

      loadGroceryItems();
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Grocery List</h2>
          <p className="text-muted-foreground">
            {purchasedCount} of {totalCount} items purchased
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={searchNearbyStores}>
            <MapPin className="h-4 w-4 mr-2" />
            Find Stores
          </Button>
          {purchasedCount > 0 && (
            <Button variant="outline" onClick={clearPurchased}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Purchased
            </Button>
          )}
        </div>
      </div>

      {groceryItems.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>No items in your grocery list</CardTitle>
            <CardDescription>
              Generate a meal plan to automatically populate your grocery list
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Shopping List
            </CardTitle>
            <CardDescription>
              Check off items as you shop
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {groceryItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${
                    item.is_purchased ? 'bg-muted/50' : 'bg-background'
                  }`}
                >
                  <Checkbox
                    checked={item.is_purchased}
                    onCheckedChange={(checked) => togglePurchased(item.id, checked as boolean)}
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
                    <Badge variant="secondary" className="text-xs">
                      Purchased
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};