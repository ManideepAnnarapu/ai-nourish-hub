import React from 'react';
import { SafeAreaView, Text, Button } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Welcome to AI Nourish Hub</Text>
      <Button title="Meal Plan" onPress={() => navigation.navigate('MealPlan')} />
      <Button title="Grocery List" onPress={() => navigation.navigate('GroceryList')} />
      <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
    </SafeAreaView>
  );
}
