import { SymbolView } from 'expo-symbols';
import { Link, Tabs } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'chart.pie.fill',
                android: 'bar-chart',
                web: 'bar-chart',
              }}
              tintColor={color}
              size={28}
            />
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', backgroundColor: 'transparent' }}>
              <Link href="/search" asChild>
                <Pressable style={{ marginRight: 15 }}>
                  {({ pressed }) => (
                    <SymbolView
                      name="magnifyingglass"
                      size={25}
                      tintColor={Colors[colorScheme].text}
                      style={{ opacity: pressed ? 0.5 : 1 }}
                    />
                  )}
                </Pressable>
              </Link>
              <Link href="/budgets" asChild>
                <Pressable style={{ marginRight: 15 }}>
                  {({ pressed }) => (
                    <SymbolView
                      name="target"
                      size={25}
                      tintColor={Colors[colorScheme].text}
                      style={{ opacity: pressed ? 0.5 : 1 }}
                    />
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
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'tray.fill',
                android: 'inbox',
                web: 'inbox',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'chart.pie.fill',
                android: 'pie-chart',
                web: 'pie-chart',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}
