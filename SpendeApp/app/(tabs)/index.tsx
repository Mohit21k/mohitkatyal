import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SymbolView } from 'expo-symbols';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';

type Transaction = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  user: 'Mohit' | 'Ankita';
  comment?: string;
  status?: 'pending' | 'approved' | 'discarded';
};

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Misc'];

const RECENT_TRANSACTIONS: Transaction[] = [
  { id: '1', merchant: 'Whole Foods', category: 'Groceries', amount: 125.60, date: 'May 28', user: 'Mohit' },
  { id: '2', merchant: 'The Nomad', category: 'Dining', amount: 95.20, date: 'May 27', user: 'Ankita' },
  { id: '3', merchant: 'Netflix', category: 'Bills', amount: 17.99, date: 'May 26', user: 'Mohit' },
  { id: '4', merchant: 'Shell Station', category: 'Transport', amount: 62.45, date: 'May 26', user: 'Mohit' },
  { id: '5', merchant: 'Apple Store', category: 'Shopping', amount: 189.99, date: 'May 25', user: 'Ankita' },
];

export default function DashboardScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [mohitTotal, setMohitTotal] = useState(0);
  const [ankitaTotal, setAnkitaTotal] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  type GroupedCategory = {
    category: string;
    total: number;
    mohitTotal: number;
    ankitaTotal: number;
    transactions: Transaction[];
  };
  const [groupedCategories, setGroupedCategories] = useState<GroupedCategory[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<'Mohit' | 'Ankita'>('Mohit');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'offline'>('synced');
  const [commentText, setCommentText] = useState('');
  const [hasPrevPending, setHasPrevPending] = useState(false);
  const [monthPending, setMonthPending] = useState<Transaction[]>([]);
  
  const colorScheme = useColorScheme() ?? 'dark';

  useEffect(() => {
    fetchData();
    
    const subscription = supabase
      .channel('dashboard_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentDate]);

  const getMonthBounds = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  const processExpenseData = (data: any[], budgetDataList: any[] | null) => {
    let sum = 0;
    let mTotal = 0;
    let aTotal = 0;
    const catMap: Record<string, GroupedCategory> = {};
    const pendingList: Transaction[] = [];

    data.forEach(d => {
      const user = d.user_id === 'mohit' ? 'Mohit' : 'Ankita';
      const formattedDate = new Date(d.created_at).toLocaleDateString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'});
      
      if (d.status === 'pending') {
        pendingList.push({
          id: d.id,
          merchant: d.merchant,
          category: d.category,
          amount: Number(d.amount),
          date: formattedDate,
          user: user,
          comment: d.comment,
          status: d.status
        });
        return;
      }

      const amount = Number(d.amount);
      sum += amount;
      
      if (user === 'Mohit') {
        mTotal += amount;
      } else {
        aTotal += amount;
      }

      const category = d.category || 'Uncategorized';
      
      if (!catMap[category]) {
        catMap[category] = { category, total: 0, mohitTotal: 0, ankitaTotal: 0, transactions: [] };
      }
      
      catMap[category].total += amount;
      if (user === 'Mohit') catMap[category].mohitTotal += amount;
      else catMap[category].ankitaTotal += amount;
      
      catMap[category].transactions.push({
        id: d.id,
        merchant: d.merchant,
        category: d.category,
        amount: amount,
        date: formattedDate,
        user: user,
        comment: d.comment,
        status: d.status
      });
    });
    
    setTotal(sum);
    setMohitTotal(mTotal);
    setAnkitaTotal(aTotal);
    setMonthPending(pendingList);
    
    const catArray = Object.values(catMap).sort((a, b) => b.total - a.total);
    setGroupedCategories(catArray);

    if (budgetDataList) {
      const bMap: Record<string, number> = {};
      budgetDataList.forEach(b => {
        bMap[b.category] = Number(b.limit_amount);
      });
      setBudgets(bMap);
    }
  };

  const fetchData = async () => {
    const { start, end } = getMonthBounds(currentDate);

    try {
      // 1. Fetch expenses
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .in('status', ['approved', 'pending'])
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Fetch budgets
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*');

      if (budgetError) throw budgetError;

      // 3. Check for pending expenses from previous months
      const { data: prevPending, error: prevPendingError } = await supabase
        .from('expenses')
        .select('id')
        .eq('status', 'pending')
        .lt('created_at', start.toISOString())
        .limit(1);

      if (prevPendingError) throw prevPendingError;
      setHasPrevPending(prevPending && prevPending.length > 0);

      if (data) {
        processExpenseData(data, budgetData);
        setSyncStatus('synced');
        
        // Cache locally
        await AsyncStorage.setItem(`cached_approved_expenses_${start.toISOString()}`, JSON.stringify(data));
        if (budgetData) {
          await AsyncStorage.setItem('cached_budgets', JSON.stringify(budgetData));
        }
      }
    } catch (err) {
      console.warn('Supabase fetch failed, loading local cache', err);
      setSyncStatus('offline');
      
      // Load cached expenses
      const cachedExp = await AsyncStorage.getItem(`cached_approved_expenses_${start.toISOString()}`);
      // Load cached budgets
      const cachedBudg = await AsyncStorage.getItem('cached_budgets');
      
      const parsedExpenses = cachedExp ? JSON.parse(cachedExp) : [];
      const parsedBudgets = cachedBudg ? JSON.parse(cachedBudg) : null;
      
      processExpenseData(parsedExpenses, parsedBudgets);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity onPress={() => { 
      setEditingTransaction(item); 
      setSelectedCat(item.category); 
      setSelectedUser(item.user);
      setCommentText(item.comment || '');
    }}>
      <View style={styles.transactionRow} lightColor="transparent" darkColor="transparent">
        <View style={styles.transactionLeft}>
          <View style={styles.avatarCircle} lightColor="#e0e0e0" darkColor="#333">
            <Text style={styles.avatarText}>{item.user.charAt(0)}</Text>
          </View>
          <View>
            <Text style={styles.transactionMerchant}>{item.merchant}</Text>
            {item.comment ? (
              <Text style={styles.commentText}>"{item.comment}"</Text>
            ) : (
              <Text style={styles.transactionDate}>{item.date}</Text>
            )}
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={styles.transactionAmount}>₹{item.amount.toFixed(2)}</Text>
          <Text style={[styles.transactionDate, { color: item.user === 'Mohit' ? '#ff9f0a' : '#0a84ff' }]}>{item.user}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const handleQuickApprove = async (id: string, category: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'approved', category })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('Failed to approve transaction');
    }
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    const txId = editingTransaction.id;
    const dbUserId = selectedUser === 'Mohit' ? 'mohit' : 'ankita';
    setEditingTransaction(null);
    
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ 
          category: selectedCat,
          user_id: dbUserId,
          comment: commentText,
          status: 'approved' // Automatically approve if edited
        })
        .eq('id', txId);
        
      if (error) {
        alert('Failed to update transaction: ' + error.message);
      }
      fetchData();
    } catch (err) {
      fetchData();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header} lightColor="transparent" darkColor="transparent">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'transparent' }}>
          <Text style={styles.title}>Spende <Text style={styles.titleHighlight}>Together</Text></Text>
          <View style={[styles.statusBadge, { backgroundColor: syncStatus === 'synced' ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 159, 10, 0.15)' }]}>
            <View style={[styles.statusDot, { backgroundColor: syncStatus === 'synced' ? '#32d74b' : '#ff9f0a' }]} />
            <Text style={[styles.statusText, { color: syncStatus === 'synced' ? '#32d74b' : '#ff9f0a' }]}>
              {syncStatus === 'synced' ? 'Synced' : 'Offline'}
            </Text>
          </View>
        </View>
        
        <View style={styles.monthSelector} lightColor="transparent" darkColor="transparent">
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
            <SymbolView name="chevron.left" size={20} tintColor={Colors[colorScheme].text} />
          </TouchableOpacity>
          <Text style={styles.subtitle}>
            {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
            <SymbolView name="chevron.right" size={20} tintColor={Colors[colorScheme].text} />
          </TouchableOpacity>
        </View>
      </View>

      {hasPrevPending && (
        <View style={styles.alertBanner} lightColor="#ffeaea" darkColor="#401010">
          <SymbolView name="exclamationmark.triangle.fill" size={18} tintColor="#ff453a" />
          <Text style={styles.alertText}>
            You have unapproved expenses from previous months! Review in Inbox.
          </Text>
        </View>
      )}

      <View style={styles.summaryCard} lightColor="#fff" darkColor="#1a1a1a">
        <Text style={styles.cardLabel}>Combined Balance</Text>
        <Text style={styles.totalAmount}>₹{total.toFixed(2)}</Text>
        <Text style={styles.savedAmount}>Syncing live from Supabase</Text>
        
        <View style={styles.divider} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
        
        <View style={styles.userBreakdown}>
          <View style={styles.userColumn}>
            <View style={[styles.userBadge, { borderColor: '#ff9f0a' }]} lightColor="transparent" darkColor="transparent">
              <Text style={styles.userName}>Mohit</Text>
            </View>
            <Text style={styles.userTotal}>Total: ₹{mohitTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.userColumn}>
            <View style={[styles.userBadge, { borderColor: '#0a84ff' }]} lightColor="transparent" darkColor="transparent">
              <Text style={styles.userName}>Ankita</Text>
            </View>
            <Text style={styles.userTotal}>Total: ₹{ankitaTotal.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {monthPending.length > 0 && (
        <View style={styles.pendingSection} lightColor="transparent" darkColor="transparent">
          <Text style={styles.pendingSectionTitle}>Pending Approval ({currentDate.toLocaleDateString([], {month: 'long'})})</Text>
          <View style={styles.pendingCardWrapper} lightColor="#fff" darkColor="#1a1a1a">
            {monthPending.map((item, index) => (
              <React.Fragment key={item.id}>
                {index !== 0 && <View style={styles.transactionDivider} lightColor="#eee" darkColor="rgba(255,255,255,0.05)" />}
                <View style={styles.pendingRow} lightColor="transparent" darkColor="transparent">
                  <View style={styles.pendingLeft} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.transactionMerchant}>{item.merchant}</Text>
                    <Text style={styles.transactionDate}>{item.date} • {item.user}</Text>
                    {item.comment ? (
                      <Text style={styles.commentText}>"{item.comment}"</Text>
                    ) : null}
                  </View>
                  <View style={styles.pendingRight} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.pendingAmount}>₹{item.amount.toFixed(2)}</Text>
                    <View style={styles.pendingActions} lightColor="transparent" darkColor="transparent">
                      <TouchableOpacity 
                        style={styles.pendingApproveBtn}
                        onPress={() => handleQuickApprove(item.id, item.category)}
                      >
                        <SymbolView name="checkmark.circle.fill" size={24} tintColor="#32d74b" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.pendingEditBtn}
                        onPress={() => {
                          setEditingTransaction(item);
                          setSelectedCat(item.category);
                          setSelectedUser(item.user);
                          setCommentText(item.comment || '');
                        }}
                      >
                        <SymbolView name="pencil.circle.fill" size={24} tintColor="#0a84ff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {groupedCategories.map((group) => (
        <View key={group.category} style={styles.listSection} lightColor="transparent" darkColor="transparent">
          
          {/* Category Header */}
          <View style={styles.categoryHeader} lightColor="transparent" darkColor="transparent">
            <View lightColor="transparent" darkColor="transparent">
              <Text style={styles.sectionTitle}>{group.category}</Text>
              <Text style={styles.categorySubTitle}>
                <Text style={{color: '#ff9f0a'}}>Mohit: ₹{group.mohitTotal.toFixed(2)}</Text>
                {'  |  '}
                <Text style={{color: '#0a84ff'}}>Ankita: ₹{group.ankitaTotal.toFixed(2)}</Text>
              </Text>
              {budgets[group.category] && (
                <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Budget limit: ₹{budgets[group.category].toFixed(2)}
                </Text>
              )}
            </View>
            <View style={{alignItems: 'flex-end'}} lightColor="transparent" darkColor="transparent">
              <Text style={[styles.categoryTotal, budgets[group.category] && group.total > budgets[group.category] && { color: '#ff453a' }]}>
                ₹{group.total.toFixed(2)}
              </Text>
              {budgets[group.category] && group.total > budgets[group.category] && (
                <Text style={{ fontSize: 12, color: '#ff453a', fontWeight: 'bold' }}>OVER BUDGET</Text>
              )}
            </View>
          </View>

          {/* Transactions List for this Category */}
          <View style={styles.listWrapper} lightColor="#fff" darkColor="#1a1a1a">
            {group.transactions.map((item, index) => (
              <React.Fragment key={item.id}>
                {index !== 0 && <View style={styles.transactionDivider} lightColor="#eee" darkColor="rgba(255,255,255,0.05)" />}
                {renderTransaction({ item })}
              </React.Fragment>
            ))}
          </View>

        </View>
      ))}

      <Modal
        visible={!!editingTransaction}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingTransaction(null)}
      >
        <View style={styles.modalOverlay} lightColor="rgba(0,0,0,0.5)" darkColor="rgba(0,0,0,0.7)">
          <View style={styles.modalContent} lightColor="#fff" darkColor="#1e1e1e">
            <View style={styles.modalHeader} lightColor="transparent" darkColor="transparent">
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setEditingTransaction(null)}>
                <SymbolView name="xmark.circle.fill" size={24} tintColor="#888" />
              </TouchableOpacity>
            </View>
            
            <Text style={{ marginBottom: 16, color: '#888' }}>
              Edit transaction details for <Text style={{ fontWeight: 'bold', color: Colors[colorScheme].text }}>{editingTransaction?.merchant}</Text>:
            </Text>
            
            {/* Category Section */}
            <Text style={{ marginBottom: 10, fontWeight: '600', color: Colors[colorScheme].text }}>Category:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }} lightColor="transparent" darkColor="transparent">
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.modalCatBtn, selectedCat === cat && styles.modalCatBtnActive]}
                  onPress={() => setSelectedCat(cat)}
                >
                  <Text style={[styles.modalCatText, selectedCat === cat && styles.modalCatTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Spender Section */}
            <Text style={{ marginBottom: 10, fontWeight: '600', color: Colors[colorScheme].text }}>Spent by:</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }} lightColor="transparent" darkColor="transparent">
              {(['Mohit', 'Ankita'] as const).map(user => (
                <TouchableOpacity
                  key={user}
                  style={[
                    styles.modalUserBtn,
                    selectedUser === user && styles.modalUserBtnActive
                  ]}
                  onPress={() => setSelectedUser(user)}
                >
                  <Text style={[
                    styles.modalUserText,
                    selectedUser === user && styles.modalUserTextActive
                  ]}>
                    {user}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment Section */}
            <Text style={{ marginBottom: 10, fontWeight: '600', color: Colors[colorScheme].text }}>Note / Comment:</Text>
            <TextInput
              style={[
                styles.modalCommentInput, 
                { 
                  color: Colors[colorScheme].text, 
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
                }
              ]}
              placeholder="Add note/comment (optional)..."
              placeholderTextColor="#888"
              value={commentText}
              onChangeText={setCommentText}
            />

            {/* Save Button */}
            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleUpdateTransaction}>
              <Text style={styles.modalSaveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  titleHighlight: {
    color: '#ff9f0a',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
  },
  summaryCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 32,
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
  savedAmount: {
    fontSize: 14,
    color: '#888',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 20,
  },
  userBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  userColumn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  userBadge: {
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  userName: {
    fontWeight: '600',
    fontSize: 16,
  },
  userTotal: {
    fontSize: 14,
    color: '#888',
  },
  listSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  categorySubTitle: {
    fontSize: 13,
    marginTop: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 8,
    marginRight: 8,
  },
  categoryTotal: {
    fontSize: 20,
    fontWeight: '800',
  },
  transactionDivider: {
    height: 1,
    width: '100%',
  },
  listWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 16,
  },
  transactionMerchant: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 13,
    color: '#888',
  },
  transactionRight: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 13,
    color: '#888',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalCatBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalCatBtnActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderColor: '#0a84ff',
  },
  modalCatText: {
    color: '#888',
    fontWeight: '600',
  },
  modalCatTextActive: {
    color: '#0a84ff',
  },
  modalUserBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalUserBtnActive: {
    borderColor: '#0a84ff',
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  modalUserText: {
    color: '#888',
    fontWeight: '600',
  },
  modalUserTextActive: {
    color: '#0a84ff',
  },
  modalSaveBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    marginTop: 20,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff453a',
    flex: 1,
  },
  pendingSection: {
    marginBottom: 24,
  },
  pendingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff9f0a',
    marginBottom: 8,
  },
  pendingCardWrapper: {
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  pendingLeft: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pendingRight: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    gap: 8,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  pendingApproveBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingEditBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalCommentInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 20,
    backgroundColor: 'rgba(150,150,150,0.05)',
  },
});
