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

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Medical', 'Recurring Expense', 'Misc'];

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

function DraftRow({ 
  draft, 
  onRetry, 
  onDiscard, 
  onSaveManual,
  colorScheme
}: { 
  draft: DraftSMS, 
  onRetry: (id: string, text: string, spender: 'Mohit' | 'Ankita') => void, 
  onDiscard: (id: string) => void,
  onSaveManual: (id: string, text: string, spender: 'Mohit' | 'Ankita', amount: string, merchant: string, category: string) => void,
  colorScheme: 'dark' | 'light'
}) {
  const [manualAmount, setManualAmount] = useState('');
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualCategory, setManualCategory] = useState('Misc');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const rxAmt = /(?:Rs\.?|INR|Amt:?)\s*([\d,]+(?:\.\d{2})?)/i;
    const rxMer = /(?:spent\s+at|spent\s+on|paid\s+to|transfer\s+to|vpa\s+to|to)\s+([A-Za-z0-9\s*#&-]+?)(?=\s+on|\s+at|\s+using|\s+via|\s+date|\s+ref|\s+txn|\.|$)/i;
    
    const amtMatch = draft.rawText.match(rxAmt);
    const merMatch = draft.rawText.match(rxMer);
    
    if (amtMatch) setManualAmount(amtMatch[1].replace(/,/g, ''));
    if (merMatch) setManualMerchant(merMatch[1].trim());
  }, [draft.rawText]);

  return (
    <View style={styles.draftCard} lightColor="#ffffff" darkColor="#16171d">
      <Text style={styles.draftMeta}>
        Spender: {draft.spender} • Received: {draft.timestamp}
      </Text>
      <Text style={styles.draftRawText} lightColor="#666" darkColor="#ccc">
        "{draft.rawText}"
      </Text>

      {isEditing ? (
        <View style={styles.draftEditForm} lightColor="transparent" darkColor="transparent">
          <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8 }} lightColor="transparent" darkColor="transparent">
            <View style={{ flex: 1 }} lightColor="transparent" darkColor="transparent">
              <Text style={styles.draftFormLabel}>Amount (₹):</Text>
              <TextInput
                style={[styles.draftInput, { color: Colors[colorScheme].text }]}
                keyboardType="numeric"
                value={manualAmount}
                onChangeText={setManualAmount}
                placeholder="0.00"
                placeholderTextColor="#8e8e93"
              />
            </View>
            <View style={{ flex: 2 }} lightColor="transparent" darkColor="transparent">
              <Text style={styles.draftFormLabel}>Merchant:</Text>
              <TextInput
                style={[styles.draftInput, { color: Colors[colorScheme].text }]}
                value={manualMerchant}
                onChangeText={setManualMerchant}
                placeholder="Merchant Name"
                placeholderTextColor="#8e8e93"
              />
            </View>
          </View>

          <View style={{ marginBottom: 12 }} lightColor="transparent" darkColor="transparent">
            <Text style={styles.draftFormLabel}>Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setManualCategory(cat)}
                  style={[
                    styles.draftCatPill,
                    manualCategory === cat && styles.draftCatPillActive
                  ]}
                >
                  <Text style={[
                    styles.draftCatText,
                    manualCategory === cat && styles.draftCatTextActive
                  ]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }} lightColor="transparent" darkColor="transparent">
            <TouchableOpacity 
              style={[styles.draftActionBtn, styles.draftCancelBtn]}
              onPress={() => setIsEditing(false)}
            >
              <Text style={{ color: '#8e8e93', fontWeight: '700', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.draftActionBtn, styles.draftSaveBtn]}
              onPress={() => onSaveManual(draft.id, draft.rawText, draft.spender, manualAmount, manualMerchant, manualCategory)}
            >
              <Text style={{ color: '#34c759', fontWeight: '700', fontSize: 13 }}>✓ Save Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.draftActions} lightColor="transparent" darkColor="transparent">
          <TouchableOpacity 
            style={[styles.draftBtn, styles.draftDiscardBtn]} 
            onPress={() => onDiscard(draft.id)}
          >
            <Text style={styles.draftBtnTextRed}>✕ Discard</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.draftBtn, styles.draftManualBtn]} 
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.draftBtnTextBlue}>✏️ Manual</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.draftBtn, styles.draftRetryBtn]} 
            onPress={() => onRetry(draft.id, draft.rawText, draft.spender)}
          >
            <Text style={styles.draftBtnTextGreen}>🔄 Retry AI</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

type DraftSMS = {
  id: string;
  rawText: string;
  spender: 'Mohit' | 'Ankita';
  timestamp: string;
};

export default function InboxScreen() {
  const [expenses, setExpenses] = useState<PendingExpense[]>([]);
  const [drafts, setDrafts] = useState<DraftSMS[]>([]);
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
    loadDrafts();
    
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

  const loadDrafts = async () => {
    try {
      const existing = await AsyncStorage.getItem('failed_sms_drafts');
      if (existing) {
        setDrafts(JSON.parse(existing));
      }
    } catch (e) {
      console.warn('Failed to load drafts', e);
    }
  };

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

  const saveToDrafts = async (rawText: string, spender: 'Mohit' | 'Ankita') => {
    try {
      const newDraft: DraftSMS = {
        id: Math.random().toString(),
        rawText,
        spender,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updated = [newDraft, ...drafts];
      setDrafts(updated);
      await AsyncStorage.setItem('failed_sms_drafts', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save draft', e);
    }
  };

  const handleDiscardDraft = async (draftId: string) => {
    const updated = drafts.filter(d => d.id !== draftId);
    setDrafts(updated);
    await AsyncStorage.setItem('failed_sms_drafts', JSON.stringify(updated));
  };

  const handleSaveDraftManually = async (
    draftId: string, 
    rawText: string, 
    spender: 'Mohit' | 'Ankita', 
    amountStr: string, 
    merchantStr: string, 
    categoryStr: string
  ) => {
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    const merchant = merchantStr.trim() || 'Manual Entry';
    const category = categoryStr || 'Misc';
    const dbUserId = spender.toLowerCase();

    try {
      const { error } = await supabase
        .from('expenses')
        .insert({
          amount,
          merchant,
          category,
          status: 'pending',
          user_id: dbUserId,
          raw_sms: rawText,
          comment: 'Saved manually from offline draft'
        });

      if (error) {
        alert("Failed to save manually: " + error.message);
      } else {
        alert("Transaction added to pending queue!");
        handleDiscardDraft(draftId);
        fetchExpenses();
      }
    } catch (err) {
      alert("Failed connection. Draft preserved.");
    }
  };

  const handleRetryAIDraft = async (draftId: string, rawText: string, spender: 'Mohit' | 'Ankita') => {
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
          smsBody: rawText, 
          userId: spender.toLowerCase() 
        })
      });
      
      if (response.ok) {
        alert('Retry successful! AI parsed and added to pending.');
        handleDiscardDraft(draftId);
        fetchExpenses();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('AI parse failed again: ' + (errorData.error || 'Check your OpenAI API key settings.'));
      }
    } catch (err) {
      alert('Network error. Unable to connect to parser.');
    } finally {
      setIsParsing(false);
    }
  };

  const parseSMSRegex = (text: string) => {
    const amountRegex = /(?:Rs\.?|INR|Amt:?)\s*([\d,]+(?:\.\d{2})?)/i;
    const merchantRegex = /(?:spent\s+at|spent\s+on|paid\s+to|transfer\s+to|vpa\s+to|to)\s+([A-Za-z0-9\s*#&-]+?)(?=\s+on|\s+at|\s+using|\s+via|\s+date|\s+ref|\s+txn|\.|$)/i;

    const amtMatch = text.match(amountRegex);
    const merchantMatch = text.match(merchantRegex);

    let amount = 0;
    if (amtMatch) {
      amount = Number(amtMatch[1].replace(/,/g, ''));
    }
    let merchant = 'Unknown Merchant';
    if (merchantMatch) {
      merchant = merchantMatch[1].trim();
    }

    return { amount, merchant };
  };

  const handleParseSMS = async () => {
    if (!smsText.trim()) {
      alert('Please paste the SMS content first.');
      return;
    }
    
    setIsParsing(true);
    const pastedText = smsText.trim();
    const spender = smsSpender;

    try {
      const response = await fetch('https://okroglemueonxiuftkut.supabase.co/functions/v1/process-sms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({ 
          smsBody: pastedText, 
          userId: spender.toLowerCase() 
        })
      });
      
      if (response.ok) {
        alert('SMS parsed and added to pending list!');
        setSmsText('');
        setIsExpanded(false);
        fetchExpenses();
      } else {
        const backupResult = parseSMSRegex(pastedText);
        if (backupResult.amount > 0) {
          try {
            const { error: insertErr } = await supabase
              .from('expenses')
              .insert({
                amount: backupResult.amount,
                merchant: backupResult.merchant,
                category: 'Misc',
                status: 'pending',
                user_id: spender.toLowerCase(),
                raw_sms: pastedText,
                comment: 'Parsed offline via backup regex'
              });
            if (!insertErr) {
              alert(`AI service offline. Used backup parser: Extracted ₹${backupResult.amount.toFixed(2)} from "${backupResult.merchant}". Added to pending!`);
              setSmsText('');
              setIsExpanded(false);
              fetchExpenses();
              return;
            }
          } catch (dbErr) {}
        }

        alert('AI Parsing failed. Added message to local Offline Drafts queue.');
        saveToDrafts(pastedText, spender);
        setSmsText('');
        setIsExpanded(false);
      }
    } catch (err) {
      const backupResult = parseSMSRegex(pastedText);
      let regexSaved = false;
      if (backupResult.amount > 0) {
        try {
          const { error: insertErr } = await supabase
            .from('expenses')
            .insert({
              amount: backupResult.amount,
              merchant: backupResult.merchant,
              category: 'Misc',
              status: 'pending',
              user_id: spender.toLowerCase(),
              raw_sms: pastedText,
              comment: 'Parsed offline via backup regex'
            });
          if (!insertErr) {
            alert(`Offline. Used backup parser: Extracted ₹${backupResult.amount.toFixed(2)} from "${backupResult.merchant}". Added to pending!`);
            setSmsText('');
            setIsExpanded(false);
            fetchExpenses();
            regexSaved = true;
          }
        } catch (dbErr) {}
      }

      if (!regexSaved) {
        alert('Network offline. Saved message to local Offline Drafts.');
        saveToDrafts(pastedText, spender);
        setSmsText('');
        setIsExpanded(false);
      }
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

      {/* Offline Drafts & Retries Queue */}
      {drafts.length > 0 && (
        <ScrollView style={styles.draftsContainer} lightColor="transparent" darkColor="transparent">
          <Text style={styles.draftsTitle}>⚠️ Offline Drafts & Failed Retries ({drafts.length})</Text>
          {drafts.map((draft) => (
            <DraftRow 
              key={draft.id} 
              draft={draft} 
              onRetry={handleRetryAIDraft} 
              onDiscard={handleDiscardDraft} 
              onSaveManual={handleSaveDraftManually}
              colorScheme={colorScheme}
            />
          ))}
        </ScrollView>
      )}

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
  draftsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    maxHeight: 280,
    backgroundColor: 'transparent',
  },
  draftsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff9500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  draftCard: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 149, 0, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  draftMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff9500',
    marginBottom: 6,
  },
  draftRawText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  draftActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'transparent',
  },
  draftBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  draftDiscardBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderColor: 'transparent',
  },
  draftManualBtn: {
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderColor: 'transparent',
  },
  draftRetryBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderColor: 'transparent',
  },
  draftBtnTextRed: {
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: '700',
  },
  draftBtnTextBlue: {
    color: '#0a84ff',
    fontSize: 12,
    fontWeight: '700',
  },
  draftBtnTextGreen: {
    color: '#34c759',
    fontSize: 12,
    fontWeight: '700',
  },
  draftEditForm: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.08)',
    backgroundColor: 'transparent',
  },
  draftFormLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 4,
  },
  draftInput: {
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.08)',
  },
  draftCatPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.06)',
    marginRight: 6,
  },
  draftCatPillActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  draftCatText: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
  },
  draftCatTextActive: {
    color: '#0a84ff',
  },
  draftActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftCancelBtn: {
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
  },
  draftSaveBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
});
