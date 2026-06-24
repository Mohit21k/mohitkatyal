import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Misc'];

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const colorScheme = useColorScheme() ?? 'dark';

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    const { data } = await supabase.from('budgets').select('*');
    if (data) {
      const bMap: Record<string, string> = {};
      data.forEach(d => {
        bMap[d.category] = String(d.limit_amount);
      });
      setBudgets(bMap);
    }
  };

  const handleSave = async (category: string, amount: string) => {
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return;
    
    // Upsert budget
    const { error } = await supabase
      .from('budgets')
      .upsert({ category: category, limit_amount: num }, { onConflict: 'category' });
      
    if (!error) {
      alert(`Saved limit for ${category}!`);
    } else {
      alert("Error saving: Make sure you created the 'budgets' table first.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.subtitle}>Set a maximum monthly limit for your categories. Exceeding this will trigger an alert on your Dashboard.</Text>
      
      {CATEGORIES.map(cat => (
        <View key={cat} style={styles.row} lightColor="transparent" darkColor="transparent">
          <Text style={styles.label}>{cat}</Text>
          <View style={styles.inputGroup} lightColor="transparent" darkColor="transparent">
            <Text style={styles.currency}>₹</Text>
            <TextInput
              style={[styles.input, { color: Colors[colorScheme].text }]}
              value={budgets[cat] || ''}
              onChangeText={(text) => setBudgets(prev => ({...prev, [cat]: text}))}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#888"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(cat, budgets[cat])}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  subtitle: { fontSize: 15, color: '#888', marginBottom: 24, lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 18, fontWeight: '600' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currency: { fontSize: 18, fontWeight: '600', color: '#888' },
  input: {
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 100,
  },
  saveBtn: { backgroundColor: '#0a84ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  saveText: { color: '#fff', fontWeight: '600' }
});
