import { Redirect } from 'expo-router';
import { LoadingState } from '@/components/LoadingState';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import { useAuthStore } from '@/store/authStore';

export default function IndexScreen() {
  useSessionBootstrap();
  const { bootstrap, status, warning } = useAuthStore();

  if (status === 'checking') {
    return (
      <Screen>
        <LoadingState label="Checking secure session..." />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <StatusBanner
          tone="error"
          message={warning || "We couldn't verify your session. Please try again."}
        />
        <PrimaryActionButton label="Retry" onPress={() => void bootstrap()} />
      </Screen>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/home' : '/login'} />;
}
