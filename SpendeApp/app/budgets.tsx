import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { checkAndLogRecurringExpenses } from '@/lib/recurring';

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Medical', 'Misc'];

type BudgetRow = {
  category: string;
  limit: string;
  spent: number;
};

type RecurringItem = {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  user_id: 'mohit' | 'ankita';
  billing_day: number;
  status: 'active' | 'paused';
};

export default function BudgetsScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'budgets' | 'recurring'>('budgets');
  
  // Budget states
  const [budgetRows, setBudgetRows] = useState<Record<string, BudgetRow>>({});
  
  // Recurring states
  const [recurringList, setRecurringList] = useState<RecurringItem[]>([]);
  const [recModalVisible, setRecModalVisible] = useState(false);
  const [recAmount, setRecAmount] = useState('');
  const [recMerchant, setRecMerchant] = useState('');
  const [recSpender, setRecSpender] = useState<'Mohit' | 'Ankita'>('Mohit');
  const [recBillingDay, setRecBillingDay] = useState('');
  const [recCategory, setRecCategory] = useState('Misc');

  const colorScheme = useColorScheme() ?? 'dark';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await fetchBudgetsAndExpenses();
      await fetchRecurringExpenses();
    } catch (err) {
      console.warn("Failed fetching data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetsAndExpenses = async () => {
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
  };

  const fetchRecurringExpenses = async () => {
    const { data } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('billing_day', { ascending: true });
    if (data) {
      setRecurringList(data as RecurringItem[]);
    }
  };

  const handleSaveBudget = async (category: string, amount: string) => {
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
        await fetchBudgetsAndExpenses();
      } else {
        alert("Error saving: " + error.message);
      }
    } catch (err) {
      alert("Error saving budget.");
    }
  };

  const handleAddRecurring = async () => {
    const amt = Number(recAmount);
    const day = Number(recBillingDay);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (isNaN(day) || day < 1 || day > 31) {
      alert("Please enter a day of month between 1 and 31.");
      return;
    }
    if (!recMerchant.trim()) {
      alert("Please enter a merchant or bill name.");
      return;
    }

    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .insert({
          amount: amt,
          merchant: recMerchant.trim(),
          category: recCategory,
          user_id: recSpender.toLowerCase(),
          billing_day: day,
          status: 'active'
        });

      if (!error) {
        alert("Recurring expense scheduled successfully!");
        setRecModalVisible(false);
        setRecAmount('');
        setRecMerchant('');
        setRecBillingDay('');
        setRecCategory('Misc');
        await fetchRecurringExpenses();
        await checkAndLogRecurringExpenses();
      } else {
        alert("Error scheduling subscription: " + error.message);
      }
    } catch (err) {
      alert("Network error scheduling subscription.");
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', id);
      if (!error) {
        await fetchRecurringExpenses();
      }
    } catch (e) {}
  };

  const handleToggleRecurringStatus = async (id: string, currentStatus: 'active' | 'paused') => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ status: newStatus })
        .eq('id', id);
      if (!error) {
        await fetchRecurringExpenses();
        if (newStatus === 'active') {
          await checkAndLogRecurringExpenses();
        }
      }
    } catch (e) {}
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
    <View style={styles.outerContainer} lightColor="#f8f9fa" darkColor="#0c0d12">
      {/* Top Segment Controller */}
      <View style={styles.segmentContainer} lightColor="#ffffff" darkColor="#16171d">
        <Pressable 
          style={({ pressed }) => [
            styles.segmentBtn,
            activeTab === 'budgets' && styles.segmentBtnActive,
            { transform: [{ scale: pressed ? 0.96 : 1 }] }
          ]}
          onPress={() => setActiveTab('budgets')}
        >
          <Text style={[styles.segmentBtnText, activeTab === 'budgets' && styles.segmentBtnTextActive]}>
            Category Budgets
          </Text>
        </Pressable>
        <Pressable 
          style={({ pressed }) => [
            styles.segmentBtn,
            activeTab === 'recurring' && styles.segmentBtnActive,
            { transform: [{ scale: pressed ? 0.96 : 1 }] }
          ]}
          onPress={() => setActiveTab('recurring')}
        >
          <Text style={[styles.segmentBtnText, activeTab === 'recurring' && styles.segmentBtnTextActive]}>
            Recurring Commitments
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} lightColor="transparent" darkColor="transparent">
        {activeTab === 'budgets' ? (
          <>
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
                      onPress={() => handleSaveBudget(cat, row.limit)}
                    >
                      <Text style={styles.saveText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <>
            {/* Recurring Commitments list */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} lightColor="transparent" darkColor="transparent">
              <Text style={styles.sectionTitleHeader}>Regular EMIs & Bills</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.addBtn,
                  { transform: [{ scale: pressed ? 0.96 : 1 }] }
                ]}
                onPress={() => setRecModalVisible(true)}
              >
                <Text style={styles.addBtnText}>+ Add New</Text>
              </Pressable>
            </View>

            {recurringList.length === 0 ? (
              <View style={styles.emptyCard} lightColor="#ffffff" darkColor="#16171d">
                <Text style={styles.emptyCardText}>No recurring expenses scheduled yet.</Text>
                <Text style={{ fontSize: 13, color: '#8e8e93', marginTop: 8, textAlign: 'center' }}>
                  Auto-log monthly EMIs, Rent, Wifi, or subscriptions on their billing day automatically.
                </Text>
              </View>
            ) : (
              recurringList.map((item) => (
                <View key={item.id} style={styles.recurringCard} lightColor="#ffffff" darkColor="#16171d">
                  <View style={styles.recHeader} lightColor="transparent" darkColor="transparent">
                    <View lightColor="transparent" darkColor="transparent">
                      <Text style={styles.recMerchant}>{item.merchant}</Text>
                      <Text style={styles.recSubtext}>
                        Day: {item.billing_day}th • paid by {item.user_id === 'mohit' ? 'Mohit' : 'Ankita'} ({item.category})
                      </Text>
                    </View>
                    <Text style={[styles.recAmountText, item.status === 'paused' && { opacity: 0.5 }]}>
                      ₹{item.amount.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.recActions} lightColor="transparent" darkColor="transparent">
                    <Pressable
                      style={({ pressed }) => [
                        styles.recActionBtn,
                        item.status === 'active' ? styles.pauseBtn : styles.resumeBtn,
                        { transform: [{ scale: pressed ? 0.96 : 1 }] }
                      ]}
                      onPress={() => handleToggleRecurringStatus(item.id, item.status)}
                    >
                      <Text style={[styles.recActionBtnText, item.status === 'active' ? { color: '#ff9500' } : { color: '#34c759' }]}>
                        {item.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.recActionBtn,
                        styles.deleteBtn,
                        { transform: [{ scale: pressed ? 0.96 : 1 }] }
                      ]}
                      onPress={() => handleDeleteRecurring(item.id)}
                    >
                      <Text style={styles.deleteBtnText}>✕ Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Add Recurring Modal */}
      <Modal
        visible={recModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecModalVisible(false)}
      >
        <View style={styles.modalOverlay} lightColor="rgba(0,0,0,0.5)" darkColor="rgba(0,0,0,0.7)">
          <View style={styles.modalContent} lightColor="#ffffff" darkColor="#16171d">
            <View style={styles.modalHeader} lightColor="transparent" darkColor="transparent">
              <Text style={styles.modalTitle}>Schedule Recurring Bill</Text>
              <Pressable 
                onPress={() => setRecModalVisible(false)} 
                style={({ pressed }) => [{ padding: 4, transform: [{ scale: pressed ? 0.9 : 1 }] }]}
              >
                <Text style={{ fontSize: 20, color: '#8e8e93', fontWeight: 'bold' }}>✕</Text>
              </Pressable>
            </View>

            {/* Merchant */}
            <Text style={styles.formLabel}>Bill / EMI Name:</Text>
            <TextInput
              style={[styles.modalInput, { color: Colors[colorScheme].text }]}
              placeholder="e.g. Home Rent, Car EMI, Netflix"
              placeholderTextColor="#8e8e93"
              value={recMerchant}
              onChangeText={recMerchant => setRecMerchant(recMerchant)}
            />

            {/* Amount & Due Date */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }} lightColor="transparent" darkColor="transparent">
              <View style={{ flex: 1 }} lightColor="transparent" darkColor="transparent">
                <Text style={styles.formLabel}>Amount (₹):</Text>
                <TextInput
                  style={[styles.modalInput, { color: Colors[colorScheme].text }]}
                  placeholder="0.00"
                  placeholderTextColor="#8e8e93"
                  keyboardType="numeric"
                  value={recAmount}
                  onChangeText={recAmount => setRecAmount(recAmount)}
                />
              </View>
              <View style={{ flex: 1 }} lightColor="transparent" darkColor="transparent">
                <Text style={styles.formLabel}>Billing Day (1-31):</Text>
                <TextInput
                  style={[styles.modalInput, { color: Colors[colorScheme].text }]}
                  placeholder="e.g. 5"
                  placeholderTextColor="#8e8e93"
                  keyboardType="numeric"
                  value={recBillingDay}
                  onChangeText={recBillingDay => setRecBillingDay(recBillingDay)}
                />
              </View>
            </View>

            {/* Spender */}
            <Text style={styles.formLabel}>Expected Spender:</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }} lightColor="transparent" darkColor="transparent">
              {(['Mohit', 'Ankita'] as const).map(user => (
                <Pressable
                  key={user}
                  style={({ pressed }) => [
                    styles.userBtn,
                    recSpender === user && styles.userBtnActive,
                    { transform: [{ scale: pressed ? 0.95 : 1 }] }
                  ]}
                  onPress={() => setRecSpender(user)}
                >
                  <Text style={[styles.userBtnText, recSpender === user && styles.userBtnTextActive]}>{user}</Text>
                </Pressable>
              ))}
            </View>

            {/* Category selection horizontal scroll */}
            <Text style={styles.formLabel}>Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6, marginVertical: 6, maxHeight: 40 }}>
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  onPress={() => setRecCategory(cat)}
                  style={({ pressed }) => [
                    styles.catPill,
                    recCategory === cat && styles.catPillActive,
                    { transform: [{ scale: pressed ? 0.94 : 1 }] }
                  ]}
                >
                  <Text style={[styles.catText, recCategory === cat && styles.catTextActive]}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.modalSaveBtn,
                { transform: [{ scale: pressed ? 0.96 : 1 }] }
              ]}
              onPress={handleAddRecurring}
            >
              <Text style={styles.modalSaveBtnText}>✓ Schedule Bill</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: { 
    flex: 1, 
    padding: 16,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    margin: 16,
    padding: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(150,150,150,0.08)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
  },
  segmentBtnTextActive: {
    color: '#0a84ff',
    fontWeight: '700',
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
  },
  
  // Recurring Commitment elements
  sectionTitleHeader: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  addBtn: {
    backgroundColor: '#34c759',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(150,150,150,0.06)',
  },
  emptyCardText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8e8e93',
    textAlign: 'center',
  },
  recurringCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(150,150,150,0.06)',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recMerchant: {
    fontSize: 16,
    fontWeight: '700',
  },
  recSubtext: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 4,
  },
  recAmountText: {
    fontSize: 17,
    fontWeight: '800',
  },
  recActions: {
    flexDirection: 'row',
    gap: 10,
  },
  recActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtn: {
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
  },
  resumeBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
  },
  recActionBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  deleteBtnText: {
    color: '#ff3b30',
    fontWeight: '700',
    fontSize: 12,
  },
  
  // Modal forms
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(150,150,150,0.05)',
    borderColor: 'rgba(150,150,150,0.08)',
  },
  userBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  userBtnActive: {
    borderColor: '#0a84ff',
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  userBtnText: {
    color: '#8e8e93',
    fontWeight: '700',
    fontSize: 13,
  },
  userBtnTextActive: {
    color: '#0a84ff',
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
    marginRight: 6,
    alignSelf: 'center',
  },
  catPillActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  catText: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
  },
  catTextActive: {
    color: '#0a84ff',
    fontWeight: '700',
  },
  modalSaveBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    marginTop: 20,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
