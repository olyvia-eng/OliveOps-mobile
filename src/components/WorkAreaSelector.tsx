import { View } from 'react-native';
import { ListRow, SectionCard, SectionHeader } from '@/components/MobilePrimitives';
import { StatusBanner } from '@/components/StatusBanner';
import type { Job } from '@/types/domain';

type WorkAreaSelectorProps = {
  job: Job;
  heading?: string | null;
  selectedWorkAreaId: string;
  onSelect: (workAreaId: string) => void;
  testIDPrefix?: string;
};

export function WorkAreaSelector({
  job,
  heading = 'Which Work Area?',
  selectedWorkAreaId,
  onSelect,
  testIDPrefix = 'work-area-option',
}: WorkAreaSelectorProps) {
  const workAreas = job.eligibleOperationalWorkAreas ?? [];

  if (job.hasOperationalWorkAreas !== true) return null;

  return (
    <View style={{ gap: 8 }}>
      {heading ? <SectionHeader title={heading} /> : null}
      {workAreas.length === 0 ? (
        <StatusBanner tone="error" message="This Job has no Work Areas available for clocking." />
      ) : (
        <SectionCard>
          {workAreas.map((workArea) => (
            <ListRow
              key={workArea.id}
              testID={`${testIDPrefix}-${workArea.id}`}
              title={workArea.name}
              subtitle={workArea.status.replace('_', ' ')}
              selected={selectedWorkAreaId === workArea.id}
              onPress={() => onSelect(workArea.id)}
            />
          ))}
        </SectionCard>
      )}
    </View>
  );
}