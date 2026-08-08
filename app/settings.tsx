import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

const PRIVACY_URL = 'https://www.oliveops.ca/privacy';
const TERMS_URL = 'https://www.oliveops.ca/terms';
const SUPPORT_URL = 'mailto:support@oliveops.ca';

export default function SettingsScreen() {
  const { logout, user } = useAuthStore();

  async function openExternalUrl(url: string) {
    await Linking.openURL(url);
  }

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

        <View style={styles.section}>
          <Text style={styles.label}>Legal and support</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.linkRow}
            onPress={() => {
              void openExternalUrl(PRIVACY_URL);
            }}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.linkRow}
            onPress={() => {
              void openExternalUrl(TERMS_URL);
            }}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.linkRow}
            onPress={() => {
              void openExternalUrl(SUPPORT_URL);
            }}
          >
            <Text style={styles.linkText}>Contact Support</Text>
          </Pressable>
        </View>
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
  section: {
    marginTop: 8,
    gap: 4,
  },
  linkRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
