import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SymbolView } from 'expo-symbols';
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

function ExpenseCard({ item, onApprove, onDiscard }: { item: PendingExpense, onApprove: (id: string, cat: string) => void, onDiscard: (id: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState(item.suggestedCategory || 'Misc');
  
  // Make sure the selected category is actually in our list, otherwise default to Misc or add it
  const displayCategories = CATEGORIES.includes(selectedCategory) ? CATEGORIES : [selectedCategory, ...CATEGORIES];

  return (
    <View style={styles.card} lightColor="#fff" darkColor="#1e1e1e">
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
      
      <View style={styles.actions} lightColor="transparent" darkColor="transparent">
        <TouchableOpacity 
          style={[styles.actionBtn, styles.discardBtn]} 
          onPress={() => onDiscard(item.id)}>
          <SymbolView name="xmark" tintColor="#ff453a" size={20} />
          <Text style={[styles.actionText, { color: '#ff453a' }]}>Discard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionBtn, styles.approveBtn]} 
          onPress={() => onApprove(item.id, selectedCategory)}>
          <SymbolView name="checkmark" tintColor="#32d74b" size={20} />
          <Text style={[styles.actionText, { color: '#32d74b' }]}>Approve</Text>
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

  const handleApprove = async (id: string, finalCategory: string) => {
    // Optimistically update the UI instantly
    setExpenses(prev => prev.filter(e => e.id !== id));
    
    try {
      const { error } = await supabase.from('expenses').update({ status: 'approved', category: finalCategory }).eq('id', id);
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
      <View style={styles.smsCard} lightColor="#fff" darkColor="#1e1e1e">
        <TouchableOpacity 
          style={styles.smsHeader} 
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
            <SymbolView name="doc.text.fill" size={18} tintColor={Colors[colorScheme].tint} />
            <Text style={styles.smsTitle}>Paste Missed Bank SMS</Text>
          </View>
          <SymbolView 
            name={isExpanded ? "chevron.up" : "chevron.down"} 
            size={16} 
            tintColor="#888" 
          />
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
                  <SymbolView name="wand.and.stars" size={16} tintColor="#fff" />
                  <Text style={styles.parseBtnText}>AI Parse SMS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {displayedExpenses.length === 0 ? (
        <View style={styles.emptyState} lightColor="transparent" darkColor="transparent">
          <SymbolView name="tray" tintColor={Colors[colorScheme].text} size={48} />
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
        <SymbolView name="camera.fill" size={24} tintColor="#fff" />
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
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  merchant: {
    fontSize: 18,
    fontWeight: '600',
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  date: {
    fontSize: 14,
    color: '#888',
    backgroundColor: 'transparent',
  },
  categoryScroll: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.1)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderColor: '#0a84ff',
  },
  categoryPillText: {
    color: '#888',
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#0a84ff',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  discardBtn: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  approveBtn: {
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
  },
  actionText: {
    fontWeight: '600',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#888',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  smsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  smsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  smsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  smsBody: {
    marginTop: 16,
    gap: 12,
  },
  smsInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    height: 90,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(150,150,150,0.05)',
  },
  spenderSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  selectButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  selectBtnActive: {
    backgroundColor: '#0a84ff',
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  selectBtnTextActive: {
    color: '#fff',
  },
  parseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#32d74b',
    gap: 8,
    marginTop: 8,
  },
  parseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
