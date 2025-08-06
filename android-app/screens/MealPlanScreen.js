import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../supabase';

export default function MealPlanScreen() {
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMealPlan = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .order('id', { ascending: true });
      if (error) {
        setError(error.message);
        setPlanData([]);
      } else {
        setPlanData(data || []);
      }
      setLoading(false);
    };
    fetchMealPlan();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }
  if (error) {
    return <View style={styles.container}><Text style={{ color: 'red' }}>{error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Meal Plan</Text>
      <FlatList
        data={planData}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.day}>{item.day || item.title || 'Day'}</Text>
            {Array.isArray(item.meals) ? item.meals.map((meal, i) => (
              <Text key={i} style={styles.meal}>{meal}</Text>
            )) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  day: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  meal: { fontSize: 16, marginLeft: 10, marginBottom: 4 },
});
