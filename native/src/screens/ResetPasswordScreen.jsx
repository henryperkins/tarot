import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AuthHeader from '../components/AuthHeader';
import AuthScreenContainer from '../components/AuthScreenContainer';
import { buildApiUrl } from '../lib/api';

export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const token = useMemo(() => {
    const value = route?.params?.token;
    return typeof value === 'string' ? value : '';
  }, [route?.params?.token]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tokenMissing = !token;
  const buttonDisabled = loading || tokenMissing;
  const buttonClassName = buttonDisabled ? 'bg-gold/40' : 'bg-gold';

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (tokenMissing) {
      setError('This reset link is missing or invalid.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords need to match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = data?.error;
        const friendly = reason === 'invalid_or_expired_token'
          ? 'This reset link is invalid or has expired. Request a new link from the sign-in dialog.'
          : reason;
        throw new Error(friendly || 'Unable to reset password');
      }

      setSuccess('Password updated. You can sign in with your new password.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err?.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToAccount = () => {
    navigation.navigate('MainTabs', { screen: 'Account' });
  };

  return (
    <AuthScreenContainer>
      <View className="gap-6">
        <AuthHeader
          badge="Account recovery"
          title="Reset your password"
          subtitle="Choose a new password for your Tableu account. Reset links expire after 30 minutes."
        />

        {tokenMissing ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
            <Text className="text-sm text-amber-100">
              This reset link is missing a token. Request a fresh link from the sign-in dialog.
            </Text>
          </View>
        ) : null}

        <View className="gap-4 rounded-2xl border border-gold/20 bg-surface px-4 py-4">
          <View className="gap-2">
            <Text className="text-xs uppercase tracking-[1.5px] text-ink-muted">New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#cbb79d"
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              editable={!buttonDisabled}
              className="rounded-xl border border-gold/30 bg-surface-muted px-3 py-3 text-ink"
            />
          </View>

          <View className="gap-2">
            <Text className="text-xs uppercase tracking-[1.5px] text-ink-muted">Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor="#cbb79d"
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              editable={!buttonDisabled}
              className="rounded-xl border border-gold/30 bg-surface-muted px-3 py-3 text-ink"
            />
          </View>

          {error ? (
            <View className="rounded-xl border border-error/40 bg-error/10 px-3 py-2">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View className="rounded-xl border border-success/40 bg-success/10 px-3 py-2">
              <Text className="text-sm text-success">{success}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={buttonDisabled}
            className={`items-center rounded-xl px-4 py-3 ${buttonClassName}`}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <Text className="text-sm font-semibold text-main">Update password</Text>
            )}
          </Pressable>
        </View>

        <Pressable onPress={handleGoToAccount} className="items-center">
          <Text className="text-xs text-ink-muted underline">Go to account</Text>
        </Pressable>
      </View>
    </AuthScreenContainer>
  );
}
