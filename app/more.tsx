import { router } from 'expo-router';
import { ListRow, ScreenHeader, SectionCard, SectionHeader } from '@/components/MobilePrimitives';
import { Screen } from '@/components/Screen';

const actions = [
  { title: 'Forms', subtitle: 'Complete assigned and available forms', path: '/forms' },
  { title: 'Time Off', subtitle: 'Request time off and review requests', path: '/time-off' },
  { title: 'Time History', subtitle: 'Review shifts and time entries', path: '/time-history' },
  { title: 'Correction Requests', subtitle: 'Review your time correction requests', path: '/my-correction-requests' },
  { title: 'Settings', subtitle: 'Account and app preferences', path: '/settings' },
] as const;

export default function MoreScreen() {
  return (
    <Screen testID="more-screen">
      <ScreenHeader title="More" subtitle="Forms, requests, and account settings" />
      <SectionHeader title="Employee Tools" />
      <SectionCard>
        {actions.map((action) => (
          <ListRow
            key={action.path}
            testID={`more-${action.title.toLowerCase().replaceAll(' ', '-')}`}
            title={action.title}
            subtitle={action.subtitle}
            onPress={() => router.push(action.path)}
          />
        ))}
      </SectionCard>
    </Screen>
  );
}