import { View } from 'react-native';
import { ListRow, SectionHeader } from '@/components/MobilePrimitives';
import { StatusBanner } from '@/components/StatusBanner';
import type { Job } from '@/types/domain';

type WorkAreaSelectorProps = {
  job: Job;
  selectedWorkAreaId: string;
  onSelect: (workAreaId: string) => void;
  testIDPrefix?: string;
};

export function WorkAreaSelector({
  job,
  selectedWorkAreaId,
  onSelect,
  testIDPrefix = 'work-area-option',
}: WorkAreaSelectorProps) {
  const workAreas = job.eligibleOperationalWorkAreas ?? [];

  if (job.hasOperationalWorkAreas !== true) return null;

  return (
    <View style={{ gap: 8 }}>
      <SectionHeader title="Which Work Area?" />
      {workAreas.length === 0 ? (
        <StatusBanner tone="error" message="This Job has no Work Areas available for clocking." />
      ) : (
        <View>
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
        </View>
      )}
    </View>
  );
}