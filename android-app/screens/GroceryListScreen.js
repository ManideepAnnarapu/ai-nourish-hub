import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { supabase } from '../supabase';

export default function GroceryListScreen() {
  const [groceryItems, setGroceryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGroceryItems = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .order('id', { ascending: true });
      if (error) {
        setError(error.message);
        setGroceryItems([]);
      } else {
        setGroceryItems(data || []);
      }
      setLoading(false);
    };
    fetchGroceryItems();
  }, []);

  const togglePurchased = async (id, current) => {
    const { error } = await supabase
      .from('grocery_items')
      .update({ is_purchased: !current })
      .eq('id', id);
    if (error) {
      Alert.alert('Error', 'Could not update item.');
      return;
    }
    setGroceryItems(items =>
      items.map(item =>
        item.id === id ? { ...item, is_purchased: !current } : item
      )
    );
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }
  if (error) {
    return <View style={styles.container}><Text style={{ color: 'red' }}>{error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grocery List</Text>
      <FlatList
        data={groceryItems}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, item.is_purchased && styles.purchased]}
            onPress={() => togglePurchased(item.id, item.is_purchased)}
          >
            <Text style={styles.itemText}>{item.item_name} ({item.quantity})</Text>
            <Text>{item.is_purchased ? '✅' : '⬜'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#f9f9f9',
    marginBottom: 6,
    borderRadius: 8,
  },
  purchased: { backgroundColor: '#d3ffd3' },
  itemText: { fontSize: 18 },
});
