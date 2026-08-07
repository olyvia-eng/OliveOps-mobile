import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const { login, warning } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError('');
    const result = await login(email.trim(), password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error || 'Login failed.');
      return;
    }

    router.replace('/home');
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>OliveOps Field Clock</Text>
        <Text style={styles.subtitle}>Sign in to clock in and clock out.</Text>

        {warning ? <StatusBanner tone="info" message={warning} /> : null}

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#64748B"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#64748B"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {error ? <StatusBanner tone="error" message={error} /> : null}

        <PrimaryActionButton
          label={loading ? 'Signing In...' : 'Sign In'}
          disabled={loading || !email || !password}
          onPress={() => void onSubmit()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 16,
  },
  input: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 18,
  },
});
