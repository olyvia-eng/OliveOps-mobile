import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/store/authStore';

function toFriendlyLoginError(raw: string | undefined) {
  if (!raw) return "We couldn't sign you in. Please try again.";
  const normalized = raw.toLowerCase();

  if (normalized.includes('invalid email or password') || normalized.includes('unauthorized')) {
    return 'Email or password is incorrect.';
  }

  return "We couldn't sign you in. Please try again.";
}

export default function LoginScreen() {
  const { login, warning } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submitDisabled = useMemo(() => loading || !email.trim() || !password, [email, password, loading]);

  async function onSubmit() {
    if (submitDisabled) return;

    setLoading(true);
    setError('');

    const result = await login(email.trim(), password);

    if (!result.ok) {
      if (__DEV__) {
        console.error('[login:error]', result.error ?? 'unknown_error');
      }
      setError(toFriendlyLoginError(result.error));
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace('/home');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.select({ ios: 18, android: 0 })}
      >
        <View style={styles.container}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <Text style={styles.brandText}>OliveOps</Text>
          </View>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your OliveOps account</Text>
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Text style={styles.leadingGlyph}>@</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                keyboardType="email-address"
                returnKeyType="next"
                placeholder="you@company.com"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Text style={styles.leadingGlyph}>*</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => {
                  void onSubmit();
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={styles.toggleButton}
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            {warning ? <Text style={styles.inlineInfo}>{warning}</Text> : null}

            {error ? (
              <View style={styles.errorInline}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitDisabled }}
              style={({ pressed }) => [
                styles.primaryButton,
                submitDisabled && styles.primaryButtonDisabled,
                pressed && !submitDisabled && styles.primaryButtonPressed,
              ]}
              disabled={submitDisabled}
              onPress={() => {
                void onSubmit();
              }}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
              <Text style={styles.primaryButtonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
            </Pressable>
          </View>

          <Text style={styles.helperText}>Built for crews in the field.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  logo: {
    width: 26,
    height: 26,
    borderRadius: 6,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  headerBlock: {
    gap: 6,
    marginBottom: 26,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  formBlock: {
    gap: 10,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  inputRow: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leadingGlyph: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    width: 14,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingVertical: 0,
  },
  toggleButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineInfo: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  errorInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: '#FECDCA',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 2,
  },
  errorIcon: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginTop: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 18,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
