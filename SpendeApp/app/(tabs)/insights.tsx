import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';

type Expense = {
  amount: number;
  category: string;
  user: 'Mohit' | 'Ankita';
  date: Date;
};

export default function InsightsScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const colorScheme = useColorScheme() ?? 'dark';

  useEffect(() => {
    fetchExpenses();
    
    const subscription = supabase
      .channel('insights_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchExpenses();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'approved');
        
      if (error) throw error;
      
      if (data) {
        const formatted = data.map(d => ({
          amount: Number(d.amount),
          category: d.category || 'Uncategorized',
          user: d.user_id === 'mohit' ? 'Mohit' : 'Ankita',
          date: new Date(d.created_at)
        }));
        setExpenses(formatted as Expense[]);
        
        // Cache locally
        await AsyncStorage.setItem('cached_insights_expenses', JSON.stringify(formatted));
      }
    } catch (err) {
      console.warn('Supabase fetch insights failed, loading local cache', err);
      const cached = await AsyncStorage.getItem('cached_insights_expenses');
      if (cached) {
        // Since dates are stored as JSON strings, we need to map them back to Date objects
        const parsed = JSON.parse(cached).map((e: any) => ({
          ...e,
          date: new Date(e.date)
        }));
        setExpenses(parsed);
      }
    }
  };

  // Date helpers
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Filters
  const thisMonthExpenses = expenses.filter(e => e.date >= currentMonthStart);
  const lastMonthExpenses = expenses.filter(e => e.date >= previousMonthStart && e.date <= previousMonthEnd);

  // Math
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Trend
  const diff = thisMonthTotal - lastMonthTotal;
  const isUp = diff > 0;
  let trendText = "No previous data to compare.";
  if (lastMonthTotal > 0) {
    const percentage = Math.abs((diff / lastMonthTotal) * 100).toFixed(0);
    trendText = `You spent ${percentage}% ${isUp ? 'more' : 'less'} than last month.`;
  }

  // Category Breakdown (This Month)
  const catMap: Record<string, number> = {};
  thisMonthExpenses.forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });
  const categories = Object.entries(catMap)
    .map(([name, amount]) => ({ name, amount, percentage: (amount / (thisMonthTotal || 1)) * 100 }))
    .sort((a, b) => b.amount - a.amount);

  // Spender Breakdown (This Month)
  const mohitThisMonth = thisMonthExpenses.filter(e => e.user === 'Mohit').reduce((sum, e) => sum + e.amount, 0);
  const ankitaThisMonth = thisMonthExpenses.filter(e => e.user === 'Ankita').reduce((sum, e) => sum + e.amount, 0);
  const mohitThisMonthPct = (mohitThisMonth / (thisMonthTotal || 1)) * 100;
  const ankitaThisMonthPct = (ankitaThisMonth / (thisMonthTotal || 1)) * 100;

  // Cumulative Breakdown (All Time)
  const allTimeTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const mohitAllTime = expenses.filter(e => e.user === 'Mohit').reduce((sum, e) => sum + e.amount, 0);
  const ankitaAllTime = expenses.filter(e => e.user === 'Ankita').reduce((sum, e) => sum + e.amount, 0);
  const mohitAllTimePct = (mohitAllTime / (allTimeTotal || 1)) * 100;
  const ankitaAllTimePct = (ankitaAllTime / (allTimeTotal || 1)) * 100;

  return (
    <ScrollView style={styles.container}>
      {/* Monthly Trend Header */}
      <View style={styles.headerCard} lightColor="#fff" darkColor="#1a1a1a">
        <Text style={styles.cardLabel}>This Month's Trend</Text>
        <Text style={styles.totalAmount}>₹{thisMonthTotal.toFixed(2)}</Text>
        <Text style={[styles.trendText, { color: lastMonthTotal > 0 ? (isUp ? '#ff453a' : '#32d74b') : '#888' }]}>
          {trendText}
        </Text>
      </View>

      {/* Top Categories */}
      <View style={styles.section} lightColor="transparent" darkColor="transparent">
        <Text style={styles.sectionTitle}>Top Spending Categories</Text>
        <View style={styles.card} lightColor="#fff" darkColor="#1a1a1a">
          {categories.length === 0 ? (
             <Text style={styles.emptyText}>No spending this month.</Text>
          ) : categories.map((cat, index) => (
            <View key={cat.name} style={[styles.categoryRow, index !== 0 && { marginTop: 16 }]} lightColor="transparent" darkColor="transparent">
              <View style={styles.categoryInfo} lightColor="transparent" darkColor="transparent">
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.categoryValue}>₹{cat.amount.toFixed(2)}</Text>
              </View>
              <View style={styles.barBackground} lightColor="#f0f0f0" darkColor="#333">
                <View style={[styles.barFill, { width: `${cat.percentage}%`, backgroundColor: Colors[colorScheme].tint }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Spender Breakdown (This Month) */}
      <View style={styles.section} lightColor="transparent" darkColor="transparent">
        <Text style={styles.sectionTitle}>Who Spent More? (This Month)</Text>
        <View style={styles.card} lightColor="#fff" darkColor="#1a1a1a">
          
          <View style={styles.spenderHeader} lightColor="transparent" darkColor="transparent">
            <View lightColor="transparent" darkColor="transparent">
              <Text style={[styles.spenderName, {color: '#ff9f0a'}]}>Mohit</Text>
              <Text style={styles.spenderAmount}>₹{mohitThisMonth.toFixed(2)}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}} lightColor="transparent" darkColor="transparent">
              <Text style={[styles.spenderName, {color: '#0a84ff'}]}>Ankita</Text>
              <Text style={styles.spenderAmount}>₹{ankitaThisMonth.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.versusBar} lightColor="#333" darkColor="#333">
            <View style={[styles.mohitFill, { width: `${mohitThisMonthPct}%` }]} />
            <View style={[styles.ankitaFill, { width: `${ankitaThisMonthPct}%` }]} />
          </View>
        </View>
      </View>

      {/* Cumulative Breakdown (All Time) */}
      <View style={[styles.section, {marginBottom: 40}]} lightColor="transparent" darkColor="transparent">
        <Text style={styles.sectionTitle}>Cumulative Breakdown (All Time)</Text>
        <View style={styles.card} lightColor="#fff" darkColor="#1a1a1a">
          
          <Text style={styles.cardLabel}>Total Combined Spent: ₹{allTimeTotal.toFixed(2)}</Text>
          <View style={styles.spenderHeader} lightColor="transparent" darkColor="transparent">
            <View lightColor="transparent" darkColor="transparent">
              <Text style={[styles.spenderName, {color: '#ff9f0a'}]}>Mohit</Text>
              <Text style={styles.spenderAmount}>₹{mohitAllTime.toFixed(2)}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}} lightColor="transparent" darkColor="transparent">
              <Text style={[styles.spenderName, {color: '#0a84ff'}]}>Ankita</Text>
              <Text style={styles.spenderAmount}>₹{ankitaAllTime.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.versusBar} lightColor="#333" darkColor="#333">
            <View style={[styles.mohitFill, { width: `${mohitAllTimePct}%` }]} />
            <View style={[styles.ankitaFill, { width: `${ankitaAllTimePct}%` }]} />
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  headerCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardLabel: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 8,
  },
  trendText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginLeft: 8,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
  },
  categoryRow: {
    width: '100%',
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryName: {
    fontWeight: '600',
    fontSize: 16,
  },
  categoryValue: {
    fontWeight: '700',
    fontSize: 16,
  },
  barBackground: {
    height: 12,
    borderRadius: 6,
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  spenderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  spenderName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  spenderAmount: {
    fontSize: 20,
    fontWeight: '800',
  },
  versusBar: {
    height: 16,
    borderRadius: 8,
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mohitFill: {
    height: '100%',
    backgroundColor: '#ff9f0a',
  },
  ankitaFill: {
    height: '100%',
    backgroundColor: '#0a84ff',
  },
});
