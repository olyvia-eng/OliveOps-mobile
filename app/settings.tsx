import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { ListRow, ScreenHeader, SectionCard, SectionHeader } from '@/components/MobilePrimitives';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { useAuthStore } from '@/store/authStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { colors } from '@/theme/colors';

const PRIVACY_URL = 'https://www.oliveops.ca/privacy';
const TERMS_URL = 'https://www.oliveops.ca/terms';
const SUPPORT_URL = 'mailto:support@oliveops.ca';

export default function SettingsScreen() {
  const { logout, user } = useAuthStore();
  const offlineClock = useOptionalOfflineClockStore();
  const [linkError, setLinkError] = useState<string | null>(null);

  async function openExternalUrl(url: string) {
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError('Could not open that link. Please try again.');
    }
  }

  async function onLogout() {
    if ((offlineClock?.commands.length ?? 0) > 0) {
      Alert.alert(
        'Unsynced clocking changes',
        'Logging out will not delete these changes, but they cannot sync until this employee logs in again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: () => { void completeLogout(); } },
        ],
      );
      return;
    }
    await completeLogout();
  }

  async function completeLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <Screen>
      <ScreenHeader title="Settings" subtitle="Account, support, and legal information" />
      <View style={styles.section}>
        <SectionHeader title="Account" />
        <SectionCard><Text style={styles.meta}>{user?.email || 'Unknown'}</Text></SectionCard>
      </View>
      <View style={styles.section}>
        <SectionHeader title="Legal and Support" />
        <SectionCard>
          <ListRow title="Privacy Policy" onPress={() => { void openExternalUrl(PRIVACY_URL); }} />
          <ListRow title="Terms of Service" onPress={() => { void openExternalUrl(TERMS_URL); }} />
          <ListRow title="Contact Support" onPress={() => { void openExternalUrl(SUPPORT_URL); }} />
        </SectionCard>
      </View>
      {linkError ? <StatusBanner tone="error" message={linkError} /> : null}
      <PrimaryActionButton label="Log Out" onPress={() => void onLogout()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  section: {
    gap: 8,
  },
});
