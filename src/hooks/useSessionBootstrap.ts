import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function useSessionBootstrap() {
  const { bootstrap } = useAuthStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
}
