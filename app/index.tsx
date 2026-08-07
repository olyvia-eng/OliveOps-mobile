import { Redirect } from 'expo-router';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import { useAuthStore } from '@/store/authStore';

export default function IndexScreen() {
  useSessionBootstrap();
  const { status } = useAuthStore();

  if (status === 'checking') {
    return (
      <Screen>
        <LoadingState label="Checking secure session..." />
      </Screen>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/home' : '/login'} />;
}
