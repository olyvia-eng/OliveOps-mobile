import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const { logout, user } = useAuthStore();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.meta}>Signed in as: {user?.email || 'Unknown'}</Text>
      </View>
      <PrimaryActionButton label="Log Out" onPress={() => void onLogout()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#111827',
    padding: 16,
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  meta: {
    color: '#E2E8F0',
    fontSize: 16,
  },
});
