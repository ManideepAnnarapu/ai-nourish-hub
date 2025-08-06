import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../supabase';

export default function ProfileScreen() {
  const [profileData, setProfileData] = useState({
    full_name: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    fitness_goal: '',
    activity_level: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setProfileData(data);
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: ['id'] });
    setSaving(false);
    if (error) {
      setError(error.message);
      Alert.alert('Error', 'Could not save profile.');
    } else {
      Alert.alert('Profile Saved', 'Your profile has been updated.');
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={profileData.full_name}
        onChangeText={text => handleChange('full_name', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Gender"
        value={profileData.gender}
        onChangeText={text => handleChange('gender', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Height (cm)"
        value={profileData.height_cm?.toString()}
        onChangeText={text => handleChange('height_cm', text)}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Weight (kg)"
        value={profileData.weight_kg?.toString()}
        onChangeText={text => handleChange('weight_kg', text)}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Fitness Goal"
        value={profileData.fitness_goal}
        onChangeText={text => handleChange('fitness_goal', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Activity Level"
        value={profileData.activity_level}
        onChangeText={text => handleChange('activity_level', text)}
      />
      <Button title={saving ? 'Saving...' : 'Save Profile'} onPress={handleSave} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 14,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
});
