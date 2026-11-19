import { WelcomeHero } from './WelcomeHero';
import { AccountSetup } from './AccountSetup';
import { SpreadEducation } from './SpreadEducation';
import { QuestionCrafting } from './QuestionCrafting';
import { RitualIntro } from './RitualIntro';
import { JournalIntro } from './JournalIntro';
import { JourneyBegin } from './JourneyBegin';

export default function OnboardingControlStep({
  step, selectedSpread, question, onNext, onBack, onSkip, onSelectSpread,
  onQuestionChange, onSkipRitual, onGoToStep, onBegin
}) {
  switch (step) {
    case 1:
      return <WelcomeHero onNext={onNext} onSkip={onSkip} />;
    case 2:
      return <AccountSetup onNext={onNext} onBack={onBack} />;
    case 3:
      return (
        <SpreadEducation
          selectedSpread={selectedSpread}
          onSelectSpread={onSelectSpread}
          onNext={onNext}
          onBack={onBack}
        />
      );
    case 4:
      return (
        <QuestionCrafting
          question={question}
          onQuestionChange={onQuestionChange}
          onNext={onNext}
          onBack={onBack}
        />
      );
    case 5:
      return <RitualIntro onNext={onNext} onBack={onBack} onSkipRitual={onSkipRitual} />;
    case 6:
      return <JournalIntro onNext={onNext} onBack={onBack} onGoToStep={onGoToStep} />;
    case 7:
      return (
        <JourneyBegin
          selectedSpread={selectedSpread}
          question={question}
          onBegin={onBegin}
          onBack={onBack}
        />
      );
    default:
      return null;
  }
}
