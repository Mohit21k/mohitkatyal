import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';

type PendingExpense = {
  id: string;
  amount: number;
  merchant: string;
  suggestedCategory: string;
  date: string;
  user: 'Mohit' | 'Ankita';
};

const INITIAL_PENDING: PendingExpense[] = [
  {
    id: '1',
    amount: 85.50,
    merchant: 'Gusto Restaurant',
    suggestedCategory: 'Dining',
    date: 'Today, 8:45 PM',
  },
  {
    id: '2',
    amount: 16.70,
    merchant: 'Uber',
    suggestedCategory: 'Transport',
    date: 'Today, 9:15 AM',
  },
];

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Misc'];

function ExpenseCard({ item, onApprove, onDiscard }: { item: PendingExpense, onApprove: (id: string, cat: string, comment: string) => void, onDiscard: (id: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState(item.suggestedCategory || 'Misc');
  const [commentText, setCommentText] = useState('');
  const colorScheme = useColorScheme() ?? 'dark';
  
  // Make sure the selected category is actually in our list, otherwise default to Misc or add it
  const displayCategories = CATEGORIES.includes(selectedCategory) ? CATEGORIES : [selectedCategory, ...CATEGORIES];

  return (
    <View style={styles.card} lightColor="#ffffff" darkColor="#16171d">
      <View style={styles.cardHeader}>
        <Text style={styles.merchant}>{item.merchant}</Text>
        <Text style={styles.amount}>₹{item.amount.toFixed(2)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.date}>{item.date}</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {displayCategories.map(cat => (
          <TouchableOpacity 
            key={cat} 
            onPress={() => setSelectedCategory(cat)}
            style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
          >
            <Text style={[styles.categoryPillText, selectedCategory === cat && styles.categoryPillTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput
        style={[styles.commentInput, { color: Colors[colorScheme].text, borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
        placeholder="Add note/comment (optional)..."
        placeholderTextColor="#888"
        value={commentText}
        onChangeText={setCommentText}
      />
      
      <View style={styles.actions} lightColor="transparent" darkColor="transparent">
        <TouchableOpacity 
          style={[styles.actionBtn, styles.discardBtn]} 
          onPress={() => onDiscard(item.id)}>
          <Text style={[styles.actionText, { color: '#ff453a' }]}>✕ Discard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionBtn, styles.approveBtn]} 
          onPress={() => onApprove(item.id, selectedCategory, commentText)}>
          <Text style={[styles.actionText, { color: '#32d74b' }]}>✓ Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const [expenses, setExpenses] = useState<PendingExpense[]>([]);
  const [filterMode, setFilterMode] = useState<'All' | 'Mohit' | 'Ankita'>('All');
  const [isExpanded, setIsExpanded] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [smsSpender, setSmsSpender] = useState<'Mohit' | 'Ankita'>('Mohit');
  const colorScheme = useColorScheme() ?? 'dark';

  useEffect(() => {
    if (filterMode !== 'All') {
      setSmsSpender(filterMode);
    }
  }, [filterMode]);

  useEffect(() => {
    fetchExpenses();
    
    const subscription = supabase
      .channel('expenses_channel')
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
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      if (data) {
        const formatted = data.map(d => ({
          id: d.id,
          amount: Number(d.amount),
          merchant: d.merchant,
          suggestedCategory: d.category,
          date: new Date(d.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          user: d.user_id === 'mohit' ? 'Mohit' : 'Ankita'
        }));
        setExpenses(formatted);
        
        // Cache locally
        await AsyncStorage.setItem('cached_pending_expenses', JSON.stringify(formatted));
      }
    } catch (err) {
      console.warn('Supabase fetch pending failed, loading local cache', err);
      const cached = await AsyncStorage.getItem('cached_pending_expenses');
      if (cached) {
        setExpenses(JSON.parse(cached));
      }
    }
  };

  const handleApprove = async (id: string, finalCategory: string, commentText: string) => {
    // Optimistically update the UI instantly
    setExpenses(prev => prev.filter(e => e.id !== id));
    
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ 
          status: 'approved', 
          category: finalCategory,
          comment: commentText 
        })
        .eq('id', id);
        
      if (error) {
        fetchExpenses();
        alert('Failed to approve transaction: ' + error.message);
      }
    } catch (err) {
      fetchExpenses();
      alert('Error approving transaction.');
    }
  };

  const handleDiscard = async (id: string) => {
    // Optimistically update the UI instantly
    setExpenses(prev => prev.filter(e => e.id !== id));
    
    try {
      const { error } = await supabase.from('expenses').update({ status: 'discarded' }).eq('id', id);
      if (error) {
        fetchExpenses();
        alert('Failed to discard transaction: ' + error.message);
      }
    } catch (err) {
      fetchExpenses();
      alert('Error discarding transaction.');
    }
  };

  const handleParseSMS = async () => {
    if (!smsText.trim()) {
      alert('Please paste the SMS content first.');
      return;
    }
    
    setIsParsing(true);
    try {
      const response = await fetch('https://okroglemueonxiuftkut.supabase.co/functions/v1/process-sms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({ 
          smsBody: smsText.trim(), 
          userId: smsSpender.toLowerCase() 
        })
      });
      
      if (response.ok) {
        alert('SMS parsed and added to pending list!');
        setSmsText('');
        setIsExpanded(false);
        fetchExpenses();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('Failed to parse: ' + (errorData.error || 'Make sure the edge function is deployed.'));
      }
    } catch (err) {
      alert('Error connecting to parser.');
    } finally {
      setIsParsing(false);
    }
  };

  const renderItem = ({ item }: { item: PendingExpense }) => (
    <ExpenseCard item={item} onApprove={handleApprove} onDiscard={handleDiscard} />
  );

  const pickImage = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      try {
        const response = await fetch('https://okroglemueonxiuftkut.supabase.co/functions/v1/process-receipt', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
          },
          body: JSON.stringify({ 
            base64Image: result.assets[0].base64, 
            userId: filterMode === 'All' ? 'mohit' : filterMode.toLowerCase() 
          })
        });
        
        if (response.ok) {
          alert('Receipt scanned successfully!');
          fetchExpenses();
        } else {
          alert('Failed to scan receipt. Make sure the edge function is deployed.');
        }
      } catch (err) {
        alert('Error connecting to scanner.');
      }
    }
  };

  const displayedExpenses = expenses.filter(e => filterMode === 'All' || e.user === filterMode);

  return (
    <View style={styles.container}>
      
      <View style={styles.toggleContainer} lightColor="transparent" darkColor="transparent">
        {(['All', 'Mohit', 'Ankita'] as const).map(mode => (
          <TouchableOpacity 
            key={mode} 
            style={[styles.toggleBtn, filterMode === mode && styles.toggleBtnActive]}
            onPress={() => setFilterMode(mode)}
          >
            <Text style={[styles.toggleText, filterMode === mode && styles.toggleTextActive]}>{mode}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Paste Missed SMS Collapsible Card */}
      <View style={styles.smsCard} lightColor="#ffffff" darkColor="#16171d">
        <TouchableOpacity 
          style={styles.smsHeader} 
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
            <Text style={{ fontSize: 18 }}>📝</Text>
            <Text style={styles.smsTitle}>Paste Missed Bank SMS</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#888', fontWeight: 'bold' }}>{isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.smsBody} lightColor="transparent" darkColor="transparent">
            <TextInput
              style={[
                styles.smsInput, 
                { 
                  color: Colors[colorScheme].text, 
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#eee' 
                }
              ]}
              multiline
              numberOfLines={4}
              placeholder="Paste raw bank SMS text here..."
              placeholderTextColor="#888"
              value={smsText}
              onChangeText={setSmsText}
            />

            <View style={styles.spenderSelectRow} lightColor="transparent" darkColor="transparent">
              <Text style={styles.selectLabel}>Spent by:</Text>
              <View style={styles.selectButtons} lightColor="transparent" darkColor="transparent">
                {(['Mohit', 'Ankita'] as const).map(spender => (
                  <TouchableOpacity
                    key={spender}
                    onPress={() => setSmsSpender(spender)}
                    style={[
                      styles.selectBtn,
                      smsSpender === spender && styles.selectBtnActive
                    ]}
                  >
                    <Text style={[
                      styles.selectBtnText,
                      smsSpender === spender && styles.selectBtnTextActive
                    ]}>
                      {spender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={styles.parseBtn} 
              onPress={handleParseSMS}
              disabled={isParsing}
            >
              {isParsing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>✨</Text>
                  <Text style={styles.parseBtnText}>AI Parse SMS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {displayedExpenses.length === 0 ? (
        <View style={styles.emptyState} lightColor="transparent" darkColor="transparent">
          <Text style={{ fontSize: 48 }}>📥</Text>
          <Text style={styles.emptyStateText}>No pending expenses for {filterMode}!</Text>
        </View>
      ) : (
        <FlatList
          data={displayedExpenses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
      
      <TouchableOpacity style={styles.fab} onPress={pickImage}>
        <Text style={{ fontSize: 24 }}>📸</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  toggleBtnActive: {
    backgroundColor: '#0a84ff',
  },
  toggleText: {
    fontWeight: '600',
    color: '#888',
  },
  toggleTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  merchant: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  date: {
    fontSize: 13,
    color: '#8e8e93',
    backgroundColor: 'transparent',
    fontWeight: '500',
  },
  categoryScroll: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(150,150,150,0.08)',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderColor: '#0a84ff',
  },
  categoryPillText: {
    color: '#8e8e93',
    fontWeight: '600',
    fontSize: 13,
  },
  categoryPillTextActive: {
    color: '#0a84ff',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  discardBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  approveBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  actionText: {
    fontWeight: '700',
    fontSize: 15,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8e8e93',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  smsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.08)',
  },
  smsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  smsTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  smsBody: {
    marginTop: 16,
    gap: 16,
  },
  smsInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    height: 100,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(150,150,150,0.05)',
    fontFamily: Platform.select({ ios: 'CourierNewPSMT', android: 'monospace', default: 'monospace' }),
  },
  spenderSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectLabel: {
    fontSize: 14,
    color: '#8e8e93',
    fontWeight: '600',
  },
  selectButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectBtnActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderColor: '#0a84ff',
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8e8e93',
  },
  selectBtnTextActive: {
    color: '#0a84ff',
  },
  parseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#34c759',
    gap: 8,
    marginTop: 8,
  },
  parseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  commentInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(150,150,150,0.05)',
  },
});
