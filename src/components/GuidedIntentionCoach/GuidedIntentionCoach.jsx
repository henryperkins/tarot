import { GuidedIntentionCoachProvider } from '../../contexts/GuidedIntentionCoachContext';
import { GuidedIntentionCoachView } from './GuidedIntentionCoachView';

export function GuidedIntentionCoach(props) {
  return (
    <GuidedIntentionCoachProvider {...props}>
      <GuidedIntentionCoachView />
    </GuidedIntentionCoachProvider>
  );
}
