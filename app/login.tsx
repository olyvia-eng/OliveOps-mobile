import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineNotice } from '@/components/OfflineNotice';
import { isOnline } from '@/services/connectivity';
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
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const submitDisabled = useMemo(() => loading || !email.trim() || !password, [email, password, loading]);

  async function onSubmit() {
    if (submitDisabled) return;

    setLoading(true);
    setError('');

    let online = false;
    try {
      online = await isOnline();
    } catch {
      // Treat an unavailable connectivity check as offline.
    }

    if (!online) {
      setError('Offline. Reconnect and try signing in again.');
      setLoading(false);
      return;
    }

    const result = await login(email.trim(), password);

    if (!result.ok) {
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.container}>
              <OfflineNotice />
              <View style={styles.brandRow}>
                <Image
                  source={require('../assets/OliveOpsLogo.jpg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.headerBlock}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to your OliveOps account</Text>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputRow, focusedField === 'email' && styles.inputRowFocused]}>
                  <Text style={styles.leadingGlyph}>{'\u2709'}</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="username"
                    keyboardType="email-address"
                    returnKeyType="next"
                    placeholder="you@company.com"
                    placeholderTextColor={colors.inputPlaceholder}
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField((current) => (current === 'email' ? null : current))}
                  />
                </View>

                <Text style={styles.labelPassword}>Password</Text>
                <View style={[styles.inputRow, focusedField === 'password' && styles.inputRowFocused]}>
                  <Text style={styles.leadingGlyph}>{'\uD83D\uDD12'}</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    placeholder="Enter your password"
                    placeholderTextColor={colors.inputPlaceholder}
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField((current) => (current === 'password' ? null : current))}
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
                    <Text style={styles.toggleIcon}>{showPassword ? '\u25CC' : '\u25C9'}</Text>
                  </Pressable>
                </View>

                {warning ? <Text style={styles.inlineInfo}>{warning}</Text> : null}

                {error ? (
                  <View style={styles.errorInline}>
                    <Text style={styles.errorIcon}>{'\u26A0'}</Text>
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
                  {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
                  <Text style={styles.primaryButtonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
                </Pressable>
              </View>

              <Text style={styles.helperText}>Built for crews in the field.</Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
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
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 58,
    paddingBottom: 28,
  },
  scrollContent: {
    flexGrow: 1,
  },
  brandRow: {
    marginBottom: 40,
    alignItems: 'flex-start',
  },
  logo: {
    width: 166,
    height: 44,
  },
  headerBlock: {
    marginBottom: 30,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  formBlock: {
    gap: 8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelPassword: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
  },
  inputRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputRowFocused: {
    borderColor: colors.inputFocusBorder,
    backgroundColor: colors.inputFocusBackground,
  },
  leadingGlyph: {
    color: colors.textSecondary,
    fontSize: 16,
    width: 16,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingVertical: 0,
  },
  toggleButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  toggleIcon: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  inlineInfo: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  errorInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  errorIcon: {
    color: colors.error,
    fontSize: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginTop: 24,
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
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 34,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
