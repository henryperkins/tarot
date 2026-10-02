import { GuidedIntentionCoachProvider } from '../../contexts/GuidedIntentionCoachContext';
import { GuidedIntentionCoachView } from './GuidedIntentionCoachView';

export function GuidedIntentionCoach({ returnFocusRef, ...props }) {
  return (
    <GuidedIntentionCoachProvider {...props}>
      <GuidedIntentionCoachView returnFocusRef={returnFocusRef} />
    </GuidedIntentionCoachProvider>
  );
}
