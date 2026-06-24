import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, FlatList, TouchableOpacity, Modal } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { SymbolView } from 'expo-symbols';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const CATEGORIES = ['Groceries', 'Dining', 'Bills', 'Transport', 'Shopping', 'Leisure', 'Misc'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
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

  const handleUpdateCategory = async (cat: string) => {
    if (!editingTransaction) return;
    await supabase.from('expenses').update({ category: cat }).eq('id', editingTransaction.id);
    setEditingTransaction(null);
    searchTransactions(); // Refresh search results
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity onPress={() => setEditingTransaction(item)}>
      <View style={styles.transactionRow} lightColor="transparent" darkColor="transparent">
        <View lightColor="transparent" darkColor="transparent">
          <Text style={styles.merchant}>{item.merchant}</Text>
          <Text style={styles.category}>{item.category} • {new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.amount}>₹{Number(item.amount).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer} lightColor="rgba(0,0,0,0.05)" darkColor="rgba(255,255,255,0.1)">
        <SymbolView name="magnifyingglass" tintColor="#888" size={20} />
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
              <Text style={styles.modalTitle}>Re-categorize Expense</Text>
              <TouchableOpacity onPress={() => setEditingTransaction(null)}>
                <SymbolView name="xmark.circle.fill" size={24} tintColor="#888" />
              </TouchableOpacity>
            </View>
            <Text style={{marginBottom: 20, color: '#888'}}>
              Move <Text style={{fontWeight: 'bold', color: Colors[colorScheme].text}}>{editingTransaction?.merchant}</Text> to a new category:
            </Text>
            
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}} lightColor="transparent" darkColor="transparent">
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.modalCatBtn, editingTransaction?.category === cat && styles.modalCatBtnActive]}
                  onPress={() => handleUpdateCategory(cat)}
                >
                  <Text style={[styles.modalCatText, editingTransaction?.category === cat && styles.modalCatTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  listContainer: { paddingHorizontal: 16 },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)'
  },
  merchant: { fontSize: 16, fontWeight: '600' },
  category: { fontSize: 13, color: '#888', marginTop: 4 },
  amount: { fontSize: 16, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40 },
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
});
