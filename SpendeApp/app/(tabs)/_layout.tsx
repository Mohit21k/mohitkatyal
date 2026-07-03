import { Link, Tabs } from 'expo-router';
import { Pressable, View, Text } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📊</Text>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', backgroundColor: 'transparent' }}>
              <Link href="/search" asChild>
                <Pressable style={{ marginRight: 15 }}>
                  {({ pressed }) => (
                    <Text 
                      style={{ 
                        color: Colors[colorScheme].tint, 
                        fontWeight: '700', 
                        fontSize: 14,
                        opacity: pressed ? 0.5 : 1 
                      }}
                    >
                      Search
                    </Text>
                  )}
                </Pressable>
              </Link>
              <Link href="/budgets" asChild>
                <Pressable style={{ marginRight: 15 }}>
                  {({ pressed }) => (
                    <Text 
                      style={{ 
                        color: Colors[colorScheme].text, 
                        fontWeight: '700', 
                        fontSize: 14,
                        opacity: pressed ? 0.5 : 1 
                      }}
                    >
                      Budgets
                    </Text>
                  )}
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📥</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📈</Text>
          ),
        }}
      />
    </Tabs>
  );
}
