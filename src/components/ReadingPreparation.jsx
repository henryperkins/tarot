import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { QuestionInput } from './QuestionInput';
import { AudioControls } from './AudioControls';
import { ExperienceSettings } from './ExperienceSettings';
import { CoachSuggestion } from './CoachSuggestion';
import { RitualControls } from './RitualControls';

export function ReadingPreparation({
    variant = 'desktop',
    // State & Setters
    userQuestion,
    setUserQuestion,
    placeholderIndex,
    onPlaceholderRefresh,
    setAllowPlaceholderCycle,

    // Coach
    coachRecommendation,
    applyCoachRecommendation,
    dismissCoachRecommendation,
    onLaunchCoach,

    // UI State
    prepareSectionsOpen,
    togglePrepareSection,
    prepareSummaries,
    prepareSectionLabels,

    // Ritual Props
    hasKnocked,
    handleKnock,
    cutIndex,
    setCutIndex,
    hasCut,
    applyCut,
    knockCount,
    onSkipRitual,
    deckAnnouncement,
    sectionRef
}) {
    const renderSectionContent = (section) => {
        if (section === 'intention') {
            return (
                <>
                    <QuestionInput
                        userQuestion={userQuestion}
                        setUserQuestion={setUserQuestion}
                        placeholderIndex={placeholderIndex}
                        onFocus={() => setAllowPlaceholderCycle(false)}
                        onBlur={() => !userQuestion.trim() && setAllowPlaceholderCycle(true)}
                        onPlaceholderRefresh={onPlaceholderRefresh}
                        onLaunchCoach={onLaunchCoach}
                    />
                    <CoachSuggestion
                        recommendation={coachRecommendation}
                        onApply={applyCoachRecommendation}
                        onDismiss={dismissCoachRecommendation}
                    />
                </>
            );
        }
        if (section === 'audio') {
            return <AudioControls />;
        }
        if (section === 'experience') {
            return <ExperienceSettings />;
        }
        if (section === 'ritual') {
            return (
                <RitualControls
                    hasKnocked={hasKnocked}
                    handleKnock={handleKnock}
                    cutIndex={cutIndex}
                    setCutIndex={setCutIndex}
                    hasCut={hasCut}
                    applyCut={applyCut}
                    knockCount={knockCount}
                    onSkip={onSkipRitual}
                    deckAnnouncement={deckAnnouncement}
                />
            );
        }
        return null;
    };

    if (variant === 'mobile') {
        return (
            <div className="space-y-8">
                {['intention', 'audio', 'experience', 'ritual'].map(section => (
                    <section key={section}>
                        <h3 className="text-sm uppercase tracking-widest text-accent/90 mb-3">
                            {section === 'audio' ? 'Audio' : section === 'experience' ? 'Experience' : section.charAt(0).toUpperCase() + section.slice(1)}
                        </h3>
                        {renderSectionContent(section)}
                    </section>
                ))}
            </div>
        );
    }

    return (
        <section ref={sectionRef} aria-label="Prepare your reading" id="step-intention" className="hidden sm:block modern-surface p-4 sm:p-6 scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]">
            <header className="mb-4 space-y-1">
                <h2 className="text-lg font-serif text-accent">Prepare your reading</h2>
                <p className="text-xs text-muted">Capture an intention, tune the experience controls, and complete the optional ritual from one panel.</p>
            </header>
            <div className="text-[0.78rem] sm:text-xs text-muted bg-surface-muted border border-secondary/60 rounded-lg px-3 py-2 flex flex-wrap gap-x-3 gap-y-1">
                <span>{prepareSummaries.intention}</span>
                <span className="hidden xs:inline">·</span>
                <span>{prepareSummaries.experience}</span>
                <span className="hidden xs:inline">·</span>
                <span>{prepareSummaries.ritual}</span>
            </div>
            <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-secondary/60 bg-surface/95 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-accent font-serif text-sm">Intention</p>
                            <p className="text-xs text-muted">Set your guiding prompt before you draw — always available without expanding a panel.</p>
                        </div>
                        <span className="text-[11px] text-main bg-surface-muted border border-secondary/60 rounded-full px-3 py-1 leading-none">Inline</span>
                    </div>
                    <div className="mt-3">
                        {renderSectionContent('intention')}
                    </div>
                </div>

                {(['audio', 'experience', 'ritual']).map(section => (
                    <div key={section} className="rounded-xl border border-secondary/50 bg-surface-muted overflow-hidden">
                        <button type="button" onClick={() => togglePrepareSection(section)} className="w-full flex items-center justify-between px-4 py-3 text-left" aria-expanded={prepareSectionsOpen[section]}>
                            <div>
                                <p className="text-accent font-serif text-sm">{prepareSectionLabels[section]?.title || (section === 'audio' ? 'Audio' : section.charAt(0).toUpperCase() + section.slice(1))}</p>
                                <p className="text-xs text-muted">{prepareSummaries[section] || (section === 'audio' ? 'Voice narration and ambience settings' : '')}</p>
                            </div>
                            {prepareSectionsOpen[section] ? <CaretUp className="w-4 h-4 text-accent" /> : <CaretDown className="w-4 h-4 text-accent" />}
                        </button>
                        {prepareSectionsOpen[section] && (
                            <div className="px-4 pb-4 pt-2">
                                {renderSectionContent(section)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
