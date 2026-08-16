import { registerRootComponent } from 'expo';
import { Text } from 'react-native';
import { featureFlags } from 'react-native-screens';

featureFlags.experiment.synchronousScreenUpdatesEnabled = true;
featureFlags.experiment.synchronousHeaderConfigUpdatesEnabled = true;
featureFlags.experiment.synchronousHeaderSubviewUpdatesEnabled = true;
featureFlags.experiment.iosPreventReattachmentOfDismissedScreens = true;

function App() {
  return <Text>OliveOps Screens Module OK</Text>;
}

registerRootComponent(App);
