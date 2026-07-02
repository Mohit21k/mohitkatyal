import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
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
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
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

  // Toggle expanded state for history months
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  // Group historic expenses by month (excluding current month)
  const getMonthlyHistory = () => {
    const historyMap: Record<string, {
      monthKey: string;
      monthDisplay: string;
      total: number;
      mohitTotal: number;
      ankitaTotal: number;
      categories: Record<string, number>;
    }> = {};

    const currentMonthLabel = `${now.getFullYear()}-${now.getMonth()}`;

    expenses.forEach(e => {
      const date = e.date;
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthKey = `${year}-${month}`;

      // Skip current month
      if (monthKey === currentMonthLabel) return;

      const monthDisplay = date.toLocaleDateString('default', { month: 'long', year: 'numeric' });

      if (!historyMap[monthKey]) {
        historyMap[monthKey] = {
          monthKey,
          monthDisplay,
          total: 0,
          mohitTotal: 0,
          ankitaTotal: 0,
          categories: {},
        };
      }

      historyMap[monthKey].total += e.amount;
      if (e.user === 'Mohit') {
        historyMap[monthKey].mohitTotal += e.amount;
      } else {
        historyMap[monthKey].ankitaTotal += e.amount;
      }

      historyMap[monthKey].categories[e.category] = (historyMap[monthKey].categories[e.category] || 0) + e.amount;
    });

    return Object.values(historyMap).sort((a, b) => {
      const [aYear, aMonth] = a.monthKey.split('-').map(Number);
      const [bYear, bMonth] = b.monthKey.split('-').map(Number);
      if (aYear !== bYear) return bYear - aYear;
      return bMonth - aMonth;
    });
  };

  const monthlyHistory = getMonthlyHistory();

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
      <View style={[styles.section, {marginBottom: 24}]} lightColor="transparent" darkColor="transparent">
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

      {/* Past Months History */}
      {monthlyHistory.length > 0 && (
        <View style={[styles.section, {marginBottom: 60}]} lightColor="transparent" darkColor="transparent">
          <Text style={styles.sectionTitle}>Past Months History</Text>
          <View style={styles.historyCard} lightColor="#fff" darkColor="#1a1a1a">
            {monthlyHistory.map((item, index) => {
              const isExpanded = !!expandedMonths[item.monthKey];
              const monthCats = Object.entries(item.categories)
                .map(([name, amount]) => ({ name, amount, percentage: (amount / (item.total || 1)) * 100 }))
                .sort((a, b) => b.amount - a.amount);
              
              return (
                <View key={item.monthKey} lightColor="transparent" darkColor="transparent">
                  {index !== 0 && <View style={styles.historyDivider} />}
                  <TouchableOpacity onPress={() => toggleMonth(item.monthKey)} style={styles.historyRow}>
                    <View style={styles.historyRowLeft} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.historyMonthName}>{item.monthDisplay}</Text>
                      <Text style={styles.historyMonthSplit}>
                        M: ₹{item.mohitTotal.toFixed(0)} | A: ₹{item.ankitaTotal.toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.historyRowRight} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.historyMonthAmount}>₹{item.total.toFixed(2)}</Text>
                      <SymbolView 
                        name={isExpanded ? "chevron.up" : "chevron.down"} 
                        size={16} 
                        tintColor="#888" 
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.historyDetails} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.historyDetailsTitle}>Category Breakdown</Text>
                      {monthCats.map(cat => (
                        <View key={cat.name} style={styles.historyCategoryRow} lightColor="transparent" darkColor="transparent">
                          <View style={styles.historyCategoryInfo} lightColor="transparent" darkColor="transparent">
                            <Text style={styles.historyCategoryName}>{cat.name}</Text>
                            <Text style={styles.historyCategoryAmount}>₹{cat.amount.toFixed(2)}</Text>
                          </View>
                          <View style={styles.historyBarBackground} lightColor="#f0f0f0" darkColor="#333">
                            <View style={[styles.historyBarFill, { width: `${cat.percentage}%`, backgroundColor: Colors[colorScheme].tint }]} />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

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
  historyCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyRowLeft: {
    backgroundColor: 'transparent',
  },
  historyRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 8,
  },
  historyMonthName: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyMonthSplit: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  historyMonthAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  historyDivider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  historyDetails: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 4,
    backgroundColor: 'rgba(150,150,150,0.03)',
    gap: 12,
  },
  historyDetailsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 4,
  },
  historyCategoryRow: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  historyCategoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  historyCategoryName: {
    fontSize: 13,
    fontWeight: '500',
  },
  historyCategoryAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyBarBackground: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  historyBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
