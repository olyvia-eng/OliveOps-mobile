import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

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
        <Text style={styles.label}>Signed in account</Text>
        <Text style={styles.meta}>Signed in as: {user?.email || 'Unknown'}</Text>
      </View>
      <PrimaryActionButton label="Log Out" onPress={() => void onLogout()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  meta: {
    color: colors.textPrimary,
    fontSize: 16,
  },
});
