import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Medical', 'Misc'];

type BudgetRow = {
  category: string;
  limit: string;
  spent: number;
};

export default function BudgetsScreen() {
  const [loading, setLoading] = useState(true);
  const [budgetRows, setBudgetRows] = useState<Record<string, BudgetRow>>({});
  const colorScheme = useColorScheme() ?? 'dark';

  useEffect(() => {
    fetchBudgetsAndExpenses();
  }, []);

  const fetchBudgetsAndExpenses = async () => {
    setLoading(true);
    try {
      // 1. Fetch budgets
      const { data: budgetData } = await supabase.from('budgets').select('*');
      const bMap: Record<string, number> = {};
      if (budgetData) {
        budgetData.forEach(d => {
          bMap[d.category] = Number(d.limit_amount);
        });
      }

      // 2. Fetch current month expenses to calculate spent limits
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const { data: expenseData } = await supabase
        .from('expenses')
        .select('amount, category')
        .eq('status', 'approved')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const spentMap: Record<string, number> = {};
      if (expenseData) {
        expenseData.forEach(e => {
          const cat = e.category || 'Uncategorized';
          spentMap[cat] = (spentMap[cat] || 0) + Number(e.amount);
        });
      }

      // 3. Assemble rows
      const rows: Record<string, BudgetRow> = {};
      CATEGORIES.forEach(cat => {
        rows[cat] = {
          category: cat,
          limit: bMap[cat] ? String(bMap[cat]) : '',
          spent: spentMap[cat] || 0,
        };
      });
      setBudgetRows(rows);
    } catch (err) {
      console.warn("Failed fetching budget analysis data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (category: string, amount: string) => {
    const num = Number(amount);
    if (isNaN(num) || num < 0) {
      alert("Please enter a valid amount.");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('budgets')
        .upsert({ category: category, limit_amount: num }, { onConflict: 'category' });
        
      if (!error) {
        alert(`Saved limit of ₹${num.toFixed(2)} for ${category}!`);
        fetchBudgetsAndExpenses();
      } else {
        alert("Error saving: " + error.message);
      }
    } catch (err) {
      alert("Error saving budget.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]} lightColor="#f8f9fa" darkColor="#0c0d12">
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    );
  }

  // Calculate total budgeted vs total spent
  const totalSpent = Object.values(budgetRows).reduce((sum, r) => sum + r.spent, 0);
  const totalBudgeted = Object.values(budgetRows).reduce((sum, r) => sum + (Number(r.limit) || 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} lightColor="#f8f9fa" darkColor="#0c0d12">
      {/* Top Summary Card */}
      <View style={styles.summaryCard} lightColor="#ffffff" darkColor="#16171d">
        <Text style={styles.summaryLabel}>Total Budget Progress</Text>
        <Text style={styles.summaryValues}>
          ₹{totalSpent.toFixed(2)} <Text style={{ fontSize: 15, color: '#8e8e93', fontWeight: '500' }}>spent of</Text> ₹{totalBudgeted.toFixed(2)}
        </Text>
        <View style={styles.progressBarBg} lightColor="#e0e0e0" darkColor="#2c2c2e">
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${Math.min((totalSpent / (totalBudgeted || 1)) * 100, 100)}%`,
                backgroundColor: totalSpent > totalBudgeted ? '#ff453a' : '#34c759'
              }
            ]} 
          />
        </View>
      </View>

      <Text style={styles.subtitle}>
        Set limits for each spending category. Exceeding the limits will highlight headers and display alerts on your main Dashboard.
      </Text>
      
      {CATEGORIES.map(cat => {
        const row = budgetRows[cat] || { category: cat, limit: '', spent: 0 };
        const limitNum = Number(row.limit) || 0;
        const pct = limitNum > 0 ? (row.spent / limitNum) * 100 : 0;
        const isOver = limitNum > 0 && row.spent > limitNum;

        return (
          <View 
            key={cat} 
            style={[
              styles.budgetCard,
              isOver && styles.overBudgetGlow
            ]} 
            lightColor="#ffffff" 
            darkColor="#16171d"
          >
            <View style={styles.rowHeader} lightColor="transparent" darkColor="transparent">
              <Text style={styles.categoryLabel}>{cat}</Text>
              <Text style={[styles.spentText, isOver && { color: '#ff453a', fontWeight: '700' }]}>
                Spent: ₹{row.spent.toFixed(2)}
              </Text>
            </View>

            {/* Visual utilization bar */}
            {limitNum > 0 && (
              <View style={styles.utilizationBarContainer} lightColor="transparent" darkColor="transparent">
                <View style={styles.progressBarBg} lightColor="#e0e0e0" darkColor="#2c2c2e">
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: isOver ? '#ff453a' : '#0a84ff'
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.pctLabel, { color: isOver ? '#ff453a' : '#8e8e93' }]}>
                  {pct.toFixed(0)}% utilized
                </Text>
              </View>
            )}

            <View style={styles.inputRow} lightColor="transparent" darkColor="transparent">
              <View style={styles.inputGroup} lightColor="transparent" darkColor="transparent">
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme].text }]}
                  value={row.limit}
                  onChangeText={(text) => setBudgetRows(prev => ({
                    ...prev,
                    [cat]: { ...prev[cat], limit: text }
                  }))}
                  keyboardType="numeric"
                  placeholder="No limit"
                  placeholderTextColor="#8e8e93"
                />
              </View>
              
              <Pressable 
                style={({ pressed }) => [
                  styles.saveBtn,
                  { transform: [{ scale: pressed ? 0.95 : 1 }] }
                ]}
                onPress={() => handleSave(cat, row.limit)}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.08)',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryValues: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  subtitle: { 
    fontSize: 13, 
    color: '#8e8e93', 
    marginBottom: 24, 
    lineHeight: 18,
    marginLeft: 4,
  },
  budgetCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(150,150,150,0.06)',
  },
  overBudgetGlow: {
    borderColor: '#ff453a',
    shadowColor: '#ff453a',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  spentText: {
    fontSize: 13,
    color: '#8e8e93',
  },
  utilizationBarContainer: {
    marginBottom: 16,
    gap: 6,
  },
  pctLabel: {
    fontSize: 11,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
  },
  currency: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#8e8e93',
  },
  input: {
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    width: 120,
    borderWidth: 1.5,
    borderColor: 'rgba(150,150,150,0.08)',
  },
  saveBtn: { 
    backgroundColor: '#0a84ff', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12,
  },
  saveText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 13,
  }
});
