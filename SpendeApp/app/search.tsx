import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, FlatList, TouchableOpacity, Modal } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Misc'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<'Mohit' | 'Ankita'>('Mohit');
  const [commentText, setCommentText] = useState('');
  const colorScheme = useColorScheme() ?? 'dark';

  useEffect(() => {
    if (query.trim().length > 1) {
      searchTransactions();
    } else {
      setResults([]);
    }
  }, [query]);

  const searchTransactions = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('status', 'approved')
      .or(`merchant.ilike.%${query}%,category.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (data) {
      setResults(data as any);
    }
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    const dbUserId = selectedUser === 'Mohit' ? 'mohit' : 'ankita';
    
    await supabase
      .from('expenses')
      .update({ 
        category: selectedCat,
        user_id: dbUserId,
        comment: commentText
      })
      .eq('id', editingTransaction.id);
      
    setEditingTransaction(null);
    searchTransactions(); // Refresh search results
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity onPress={() => {
      setEditingTransaction(item);
      setSelectedCat(item.category);
      setSelectedUser(item.user_id === 'mohit' ? 'Mohit' : 'Ankita');
      setCommentText(item.comment || '');
    }}>
      <View style={styles.transactionRow} lightColor="transparent" darkColor="transparent">
        <View lightColor="transparent" darkColor="transparent">
          <Text style={styles.merchant}>{item.merchant}</Text>
          {item.comment ? (
            <Text style={styles.commentText}>"{item.comment}"</Text>
          ) : (
            <Text style={styles.category}>{item.category} • {new Date(item.created_at).toLocaleDateString()}</Text>
          )}
        </View>
        <Text style={styles.amount}>₹{Number(item.amount).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer} lightColor="rgba(0,0,0,0.05)" darkColor="rgba(255,255,255,0.1)">
        <Ionicons name="search" color="#888" size={20} />
        <TextInput
          style={[styles.searchInput, { color: Colors[colorScheme].text }]}
          placeholder="Search merchants or categories..."
          placeholderTextColor="#888"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          query.length > 1 ? (
            <Text style={styles.emptyText}>No transactions found for "{query}"</Text>
          ) : null
        }
      />

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
                <Ionicons name="close-circle" size={28} color="#888" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(150,150,150,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.05)',
  },
  merchant: {
    fontSize: 15,
    fontWeight: '600',
  },
  category: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 4,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8e8e93',
    marginTop: 40,
    fontSize: 14,
  },
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
  modalCatBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(150,150,150,0.08)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modalCatBtnActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderColor: '#0a84ff',
  },
  modalCatText: {
    color: '#8e8e93',
    fontWeight: '600',
    fontSize: 13,
  },
  modalCatTextActive: {
    color: '#0a84ff',
  },
  modalUserBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modalUserBtnActive: {
    borderColor: '#0a84ff',
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  modalUserText: {
    color: '#8e8e93',
    fontWeight: '600',
  },
  modalUserTextActive: {
    color: '#0a84ff',
  },
  modalSaveBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    marginTop: 24,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  commentText: {
    fontSize: 13,
    color: '#8e8e93',
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalCommentInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
    backgroundColor: 'rgba(150,150,150,0.05)',
  },
});
