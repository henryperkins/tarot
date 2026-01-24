// functions/lib/knowledgeBase.js
// Curated, internally-authored tarot wisdom passages for GraphRAG retrieval.
//
// NOTE:
// - This file intentionally avoids verbatim excerpts from copyrighted books.
// - The goal is to provide compact, tradition-aligned prompts that enrich the
//   reading without requiring external text reuse.
//
// Structure:
// - TRIAD_PASSAGES: 3-card arcs keyed by triad id
// - FOOLS_JOURNEY_PASSAGES: 3 developmental stages keyed by stage id
// - MAJOR_ARCANA_PASSAGES: single Major Arcana archetypes keyed by card number
// - DYAD_PASSAGES: 2-card synergies keyed by "<major>-<major>"
// - SUIT_PROGRESSION_PASSAGES: Minor Arcana developmental arcs

/**
 * Curated passages for archetypal triads.
 * Keys MUST align with `ARCHETYPAL_TRIADS` ids in `src/data/knowledgeGraphData.js`.
 */
export const TRIAD_PASSAGES = {
    'death-temperance-star': {
        title: 'The Healing Arc',
        theme: 'Ending → Integration → Renewal',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'A clean ending makes room for repair. Let what is finished be finished (Death), then blend the lesson into your life with patience and care (Temperance). From that integration, hope returns—not as a denial of pain, but as a new, steadier orientation (The Star). Look to the skeleton on the white horse and banner, Temperance\'s angel pouring between cups with one foot in water and one on land, and the Star\'s large star over the pitchers by the pool.',
                tags: ['transformation', 'integration', 'healing', 'hope'],
                visualAnchors: [
                    'skeleton',
                    'white horse',
                    'banner',
                    'angel',
                    'cups',
                    'one foot in water',
                    'one foot on land',
                    'large star',
                    'pitchers',
                    'pool'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'grief',
                text:
                    'This is literal healing from loss: Death marks what cannot return, Temperance asks you to metabolize grief in steady doses, and The Star brings relief and a gentler horizon. Healing is not forgetting—it is learning to live with love and memory without being consumed by the wound.',
                tags: ['grief', 'loss', 'mourning', 'healing', 'hope']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'transition',
                text:
                    'A life chapter is closing. Death ends what is done, Temperance integrates what you learned, and The Star points to a new orientation. Don’t rush the middle—give yourself time to acclimate so hope grows from real integration instead of wishful denial.',
                tags: ['transition', 'change', 'integration', 'timing', 'renewal']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'shadow',
                text:
                    'Releasing old patterns is the work here. Death cuts the cord, Temperance helps you recombine the parts of yourself with compassion, and The Star is the clearer self-image that follows. Name what you are ready to release, and what you are ready to embody.',
                tags: ['shadow', 'release', 'self-work', 'integration', 'renewal']
            }
        ]
    },

    'devil-tower-sun': {
        title: 'The Liberation Arc',
        theme: 'Bondage → Rupture → Freedom',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Notice what has you hooked (The Devil). Then tell the truth: the structure can’t hold (The Tower). The breakthrough isn’t just escape—it’s clarity and vitality returning (The Sun). If it feels like chaos, ask what honesty is being restored. The horned figure and chained figures, the lightning-split tower with falling figures, and the radiant sun over the naked child and sunflowers mirror the release.',
                tags: ['liberation', 'truth', 'breakthrough', 'clarity'],
                visualAnchors: [
                    'horned figure',
                    'chained figures',
                    'lightning',
                    'tower',
                    'falling figures',
                    'radiant sun with face',
                    'naked child',
                    'sunflowers'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'addiction',
                text:
                    'This is a recovery arc. The Devil shows the hook—substance, habit, or compulsion. The Tower is the rupture that ends the fantasy of control. The Sun is support, routine, and honest pride returning. Choose one concrete step that restores daylight: tell the truth, ask for help, and rebuild simply.',
                tags: ['addiction', 'recovery', 'support', 'truth', 'liberation']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'relationship',
                text:
                    'Leaving toxic dynamics often requires a clean break. The Devil names the bond that is more compulsion than love, the Tower is the boundary or rupture that ends the pattern, and the Sun is self-respect and joy returning. Choose the clean ending over the slow drain.',
                tags: ['relationship', 'boundaries', 'truth', 'liberation', 'clarity']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'career',
                text:
                    'A role or identity can become a cage. The Devil is the golden handcuff, the Tower is the unavoidable wake-up or exit, and the Sun is work that makes you feel alive again. Let the collapse redirect you toward what is real—and sustainable.',
                tags: ['career', 'change', 'truth', 'renewal', 'liberation']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Freedom from limiting beliefs is the initiation. The Devil reveals inherited shame or fear, the Tower breaks the false story, and the Sun returns you to direct experience of truth and joy. Strip the superstition, keep the wisdom, and let your faith become lived.',
                tags: ['spiritual', 'awakening', 'truth', 'freedom', 'clarity']
            }
        ]
    },

    'hermit-hangedman-moon': {
        title: 'The Inner Work Arc',
        theme: 'Solitude → Surrender → Mystery',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Withdraw to listen (The Hermit). Release the need to force an answer (The Hanged Man). Then move through ambiguity with gentleness—dreams, symbols, and intuition are part of the map (The Moon). This arc rewards patience over certainty. Anchor the inner work in the lantern and six-pointed star, the Hanged Man\'s halo on the tree, and the Moon\'s face between the two towers, the dog and wolf, and the winding path.',
                tags: ['contemplation', 'surrender', 'intuition', 'mystery'],
                visualAnchors: [
                    'lantern',
                    'six-pointed star',
                    'halo',
                    'tree',
                    'full moon with face',
                    'two towers',
                    'dog and wolf',
                    'winding path'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Meditation and dreamwork lead. The Hermit turns down the noise, the Hanged Man surrenders control, and the Moon invites you to meet the unconscious without panic. Track symbols, journal honestly, and trust the slow reveal instead of demanding instant certainty.',
                tags: ['spiritual', 'meditation', 'dreamwork', 'intuition', 'shadow']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'therapy',
                text:
                    'This is deep psychological processing. The Hermit is honest self-inquiry, the Hanged Man is a perspective shift you cannot force, and the Moon is the emotional material that surfaces when you feel safe. Let the work be spacious—insights arrive between sessions.',
                tags: ['therapy', 'processing', 'perspective', 'subconscious', 'patience']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'creative',
                text:
                    'Ideas need incubation. The Hermit protects solitude, the Hanged Man pauses production, and the Moon feeds imagery and myth. Collect fragments, make messy drafts, and wait for the right timing—your creativity is gestating, not failing.',
                tags: ['creative', 'incubation', 'imagination', 'patience', 'intuition']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'grief',
                text:
                    'Grief is an interior landscape. The Hermit gives privacy to feel, the Hanged Man asks you to stop bargaining with reality, and the Moon brings dreams, memories, and waves. Let it be nonlinear; the work is to stay gentle while the psyche integrates loss.',
                tags: ['grief', 'mourning', 'dreams', 'integration', 'gentleness']
            }
        ]
    },

    'magician-chariot-world': {
        title: 'The Mastery Arc',
        theme: 'Skill → Directed Action → Complete Achievement',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'You have tools and agency (The Magician). Align competing impulses into one direction (The Chariot). Then complete the cycle: integrate the win, the lesson, and the new identity it created (The World). The infinity symbol above the wand, cup, sword, and pentacle, the sphinxes beneath the starry canopy, and the World dancer inside the wreath show disciplined motion toward wholeness.',
                tags: ['manifestation', 'discipline', 'integration', 'completion'],
                visualAnchors: [
                    'infinity symbol',
                    'wand',
                    'cup',
                    'sword',
                    'pentacle',
                    'sphinxes',
                    'starry canopy',
                    'dancer',
                    'wreath'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'career',
                text:
                    'Skill plus direction equals results. The Magician is competence and communication, the Chariot is focus and execution, and the World is the deliverable, promotion, or completed cycle. Pick one goal, align your energy, and ship.',
                tags: ['career', 'skill', 'focus', 'achievement', 'completion']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'creative',
                text:
                    'This is the arc of finishing. The Magician begins with tools and a clear brief, the Chariot sustains momentum through constraints, and the World is the final form that can be shared. Commit to deadlines, iterate, and let completion be your devotion.',
                tags: ['creative', 'craft', 'discipline', 'completion', 'publish']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'personal',
                text:
                    'You are ready for a milestone. The Magician says you can do this, the Chariot says choose a direction, and the World says integrate the win into your identity. Make the change real through action, not just intention.',
                tags: ['personal', 'growth', 'agency', 'milestone', 'integration']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'manifestation',
                text:
                    'Align will with action. The Magician sets intention and uses the right tools, the Chariot directs the force without being pulled apart, and the World seals it through completion. Manifestation requires follow-through.',
                tags: ['manifestation', 'intention', 'willpower', 'follow-through', 'completion']
            }
        ]
    },

    'empress-lovers-hierophant': {
        title: 'The Values & Commitment Arc',
        theme: 'Abundance → Choice → Sacred Structure',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Growth invites choices: create and nourish what matters (The Empress), decide in alignment with your values (The Lovers), then build a container—commitment, practice, or community—to sustain it (The Hierophant). Notice the wheat fields and Venus symbol, the Lovers\' angel between the tree of knowledge and tree of life, and the Hierophant\'s crossed keys with the two acolytes.',
                tags: ['values', 'commitment', 'choice', 'stability'],
                visualAnchors: [
                    'wheat fields',
                    'Venus symbol',
                    'angel',
                    'tree of knowledge',
                    'tree of life',
                    'crossed keys',
                    'two acolytes'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'romantic',
                text:
                    'Attraction becomes commitment. The Empress is affection and nurture, the Lovers is a choice made in alignment, and the Hierophant is the container—vows, shared values, community, or ritual. Ask what kind of relationship you are building and what promises are real.',
                tags: ['romantic', 'commitment', 'values', 'partnership', 'stability']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'creative',
                text:
                    'Inspiration needs structure. The Empress births the idea, the Lovers chooses the direction, and the Hierophant is the practice—teachers, routines, standards. Make your creativity a devotion: show up, study, and let form protect the flame.',
                tags: ['creative', 'practice', 'discipline', 'choice', 'growth']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Exploration becomes a path. The Empress is receptivity to the sacred in daily life, the Lovers is choosing what you serve, and the Hierophant is tradition or practice that holds you. Commit to what deepens you, not what merely fascinates you.',
                tags: ['spiritual', 'path', 'tradition', 'devotion', 'choice']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'values',
                text:
                    'Abundance forces a choice. The Empress says you can have more than one thing, the Lovers asks what you truly value, and the Hierophant asks for consistency—build a repeatable life that matches your values. Let integrity be the commitment.',
                tags: ['values', 'choice', 'integrity', 'commitment', 'structure']
            }
        ]
    },

    // Used by knowledgeGraph partial-triad tests and narrative enrichment.
    'fool-magician-world': {
        title: 'The Complete Manifestation Cycle',
        theme: 'Innocent Beginning → Conscious Skill → Total Integration',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Start with a leap (The Fool), apply skill with attention (The Magician), and close the loop with integration (The World). The question is not only "can this be done?" but "who do you become by doing it?" The cliff and white rose, the infinity symbol over the wand, cup, sword, and pentacle, and the World dancer in the wreath frame the cycle.',
                tags: ['beginnings', 'manifestation', 'completion', 'identity'],
                visualAnchors: [
                    'cliff',
                    'white rose',
                    'infinity symbol',
                    'wand',
                    'cup',
                    'sword',
                    'pentacle',
                    'dancer',
                    'wreath'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'career',
                text:
                    'This is venture-building. The Fool is the leap—application, pitch, new role, or fresh start. The Magician is strategy and skill. The World is launch, completion, or public success. Keep the wonder, but document the plan and finish what you start.',
                tags: ['career', 'venture', 'skill', 'launch', 'completion']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'creative',
                text:
                    'From spark to masterpiece: the Fool plays, the Magician crafts, and the World releases. Treat the work as a cycle—experiment, build, polish, share. Completion is part of the art.',
                tags: ['creative', 'process', 'craft', 'publish', 'completion']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'personal',
                text:
                    'A whole developmental loop is underway. The Fool begins naive, the Magician learns agency, and the World integrates the lesson. Notice who you are becoming—and let that become your new baseline.',
                tags: ['personal', 'growth', 'identity', 'integration', 'cycle']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'The soul learns through cycles. The Fool trusts life, the Magician participates consciously, and the World returns you to wholeness with humility. Every completion is an initiation.',
                tags: ['spiritual', 'soul', 'wholeness', 'cycle', 'initiation']
            }
        ]
    },

    'empress-emperor-hierophant': {
        title: 'The Authority & Structure Arc',
        theme: 'Nurturing Abundance → Order & Structure → Traditional Wisdom',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Create from love (The Empress), then organize your creation with clear boundaries (The Emperor), and finally codify the lessons so they can be passed on (The Hierophant). This arc builds institutions, families, and lasting legacies. The wheat fields and Venus symbol meet the ram heads and orb, then the crossed keys and pillars, to anchor the legacy.',
                tags: ['structure', 'authority', 'tradition', 'legacy'],
                visualAnchors: [
                    'wheat fields',
                    'Venus symbol',
                    'ram heads',
                    'orb',
                    'crossed keys',
                    'pillars'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'parenting',
                text:
                    'From nurture to structure to values: the Empress is care and attachment, the Emperor is boundaries and routine, and the Hierophant is teaching—family culture, ethics, tradition. Children thrive when love and consistency work together.',
                tags: ['parenting', 'nurture', 'boundaries', 'values', 'family']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'leadership',
                text:
                    'Build organizations that last. The Empress is culture and care, the Emperor is governance and accountability, and the Hierophant is shared principles and training. Lead like a gardener and an architect: grow the people, then protect the structure.',
                tags: ['leadership', 'culture', 'structure', 'principles', 'legacy']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'creative',
                text:
                    'Turn inspiration into craft and then teach it. The Empress creates, the Emperor edits and frames, and the Hierophant codifies method—process, standards, mentorship. This is how art becomes a practice others can learn from.',
                tags: ['creative', 'craft', 'process', 'mentorship', 'legacy']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'career',
                text:
                    'Abundance wants organization. The Empress grows resources, the Emperor allocates and sets policy, and the Hierophant formalizes knowledge—certification, best practices, standards. Step into authority with integrity.',
                tags: ['career', 'authority', 'structure', 'standards', 'stability']
            }
        ]
    },

    'wheel-justice-hangedman': {
        title: 'The Karmic Acceptance Arc',
        theme: 'Fate Turns → Truth Demanded → Surrender to Flow',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'When cycles shift beyond your control (Wheel of Fortune), face the reckoning with honesty (Justice), then release attachment to outcome (The Hanged Man). Acceptance is not defeat—it is wisdom that conserves energy for what you can influence. The turning wheel with the sphinx and snake, the scales and sword, and the Hanged Man\'s halo on the tree emphasize truth with surrender.',
                tags: ['karma', 'acceptance', 'surrender', 'truth'],
                visualAnchors: [
                    'wheel',
                    'sphinx',
                    'snake',
                    'scales',
                    'sword',
                    'halo',
                    'tree'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'legal',
                text:
                    'Outcomes turn. The Wheel shows forces beyond your control, Justice demands clarity and fair process, and the Hanged Man asks you to accept what the system decides. Do what is right, then release what you cannot influence.',
                tags: ['legal', 'justice', 'outcome', 'acceptance', 'truth']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'relationships',
                text:
                    'Patterns repeat until you name them. The Wheel is the cycle, Justice is accountability and honest boundaries, and the Hanged Man is releasing control and choosing a new response. You cannot force fairness, but you can act with integrity.',
                tags: ['relationships', 'patterns', 'accountability', 'boundaries', 'acceptance']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Karma is in motion. The Wheel turns, Justice reveals the lesson, and the Hanged Man dissolves ego resistance. Let the truth realign you—surrender is not weakness, it is wisdom.',
                tags: ['spiritual', 'karma', 'truth', 'surrender', 'alignment']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'healing',
                text:
                    'Acceptance frees energy. The Wheel is what you did not choose, Justice is the honest assessment, and the Hanged Man is surrender that stops the fight. Healing becomes possible when you stop arguing with reality.',
                tags: ['healing', 'acceptance', 'truth', 'surrender', 'balance']
            }
        ]
    },

    'tower-star-moon': {
        title: 'The Post-Crisis Navigation Arc',
        theme: 'Upheaval → Hope Restored → Navigating Uncertainty',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'After structures collapse (The Tower), hope returns as a quiet compass (The Star), but the path forward remains unclear (The Moon). Trust intuition over certainty. Healing is not linear, and the next steps may only reveal themselves one at a time. The lightning-struck tower and falling figures, the Star\'s large star and pitchers by the pool, and the Moon\'s face between the two towers with the dog and wolf keep the path grounded.',
                tags: ['crisis', 'hope', 'intuition', 'healing'],
                visualAnchors: [
                    'lightning',
                    'tower',
                    'falling figures',
                    'large star',
                    'pitchers',
                    'pool',
                    'full moon with face',
                    'two towers',
                    'dog and wolf'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'trauma',
                text:
                    'After crisis, go slowly. The Tower is the rupture, the Star is the first calm breath and support, and the Moon is the uncertain road of recovery. Trust small steps and gentle intuition—safety first, certainty later.',
                tags: ['trauma', 'recovery', 'support', 'intuition', 'patience']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'career',
                text:
                    'A professional collapse becomes a new vision. The Tower is job loss or upheaval, the Star is renewed hope and a clearer calling, and the Moon is ambiguity while you explore. Don’t panic in the unknown—keep moving with curiosity.',
                tags: ['career', 'change', 'hope', 'uncertainty', 'next-steps']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'relationships',
                text:
                    'A breakup cracks illusions. The Tower ends the story, the Star restores self-worth, and the Moon asks you to navigate new desire with discernment. Heal before you chase certainty; intuition becomes clearer with time.',
                tags: ['relationships', 'breakup', 'healing', 'discernment', 'intuition']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Dark night theology. The Tower breaks false structures, the Star is a glimpse of grace, and the Moon is living without clear answers while a new faith forms. Let mystery be part of the path.',
                tags: ['spiritual', 'dark-night', 'faith', 'mystery', 'hope']
            }
        ]
    },

    'strength-hermit-wheel': {
        title: 'The Inner Mastery Through Solitude Arc',
        theme: 'Taming Inner Beasts → Solitary Wisdom → Accepting Cycles',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Gentle self-mastery (Strength) leads to withdrawal for deeper insight (The Hermit), which prepares you to accept the turning of fate with equanimity (Wheel of Fortune). This is the contemplative path: courage, reflection, and surrender to timing. The lion and infinity symbol, the Hermit\'s lantern on the mountain peak, and the wheel itself mark courage, guidance, and cycles.',
                tags: ['self-mastery', 'solitude', 'wisdom', 'cycles'],
                visualAnchors: [
                    'lion',
                    'infinity symbol',
                    'lantern',
                    'mountain peak',
                    'wheel'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'personal',
                text:
                    'Self-mastery through gentleness. Strength tames the inner beast, the Hermit finds your truth, and the Wheel asks you to accept cycles and timing. You do not have to force life—meet it with patience and clarity.',
                tags: ['personal', 'self-mastery', 'wisdom', 'cycles', 'patience']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Discipline and surrender. Strength is compassionate containment, the Hermit is meditation, and the Wheel is divine timing. Keep showing up, but release the demand to control outcomes—trust the turning.',
                tags: ['spiritual', 'meditation', 'surrender', 'discipline', 'timing']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'healing',
                text:
                    'Recovery is cyclical. Strength is self-compassion, the Hermit is rest and reflection, and the Wheel is the wave-like rhythm of progress and setback. Track what helps and do not shame the cycle.',
                tags: ['healing', 'self-compassion', 'rest', 'cycles', 'recovery']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'creative',
                text:
                    'Solitary practice brings mastery. Strength is consistency, the Hermit is focus, and the Wheel is trust in the process. Keep creating even when inspiration is variable—timing is part of the work.',
                tags: ['creative', 'practice', 'discipline', 'process', 'timing']
            }
        ]
    }
};

/**
 * Curated passages for Fool's Journey stages.
 * Keys MUST align with stage keys produced by `detectFoolsJourneyStage()`.
 */
export const FOOLS_JOURNEY_PASSAGES = {
    initiation: {
        title: 'Journey Stage: Initiation (0-7)',
        stage: 'departure',
        theme: 'Building Ego & Identity',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'This stage asks: what are you building, and what identity supports it? Learn your tools, define your values, and practice directed action. The goal isn’t perfection; it’s a stable starting point.',
                tags: ['identity', 'values', 'learning', 'agency']
            }
        ]
    },

    integration: {
        title: 'Journey Stage: Integration (8-14)',
        stage: 'initiation',
        theme: 'Shadow Work & Transformation',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'Here the work turns inward: reality checks, surrender, and transformation. Progress comes from honest reflection, recalibration, and letting go of what can’t continue.',
                tags: ['shadow', 'truth', 'surrender', 'transformation']
            }
        ]
    },

    culmination: {
        title: 'Journey Stage: Culmination (15-21)',
        stage: 'return',
        theme: 'Shadow Integration & Cosmic Consciousness',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                text:
                    'This stage brings pressure and insight: attachments are named, illusions fall, and renewal becomes possible. The invitation is to integrate what you’ve learned and carry it back into the world with humility and joy.',
                tags: ['integration', 'awakening', 'liberation', 'wholeness']
            }
        ]
    }
};

/**
 * Curated passages for single Major Arcana archetypes.
 * Keys are Major Arcana numbers (0-21).
 */
export const MAJOR_ARCANA_PASSAGES = {
    0: {
        title: 'The Fool',
        theme: 'Beginnings & Open Faith',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'A new chapter asks for curiosity and lightness. Trust the next step, stay open to surprise, and let learning be part of the path instead of proof that you are behind.',
                tags: ['beginnings', 'trust', 'risk', 'curiosity']
            }
        ]
    },
    1: {
        title: 'The Magician',
        theme: 'Will & Manifestation',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'You have the tools and the agency to shape this. Clarify your intent, focus your energy, and act with skill instead of hesitation.',
                tags: ['manifestation', 'skill', 'agency', 'focus']
            }
        ]
    },
    2: {
        title: 'The High Priestess',
        theme: 'Inner Knowing',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'The answer is quiet, not loud. Pause, listen, and let intuition surface without forcing it into certainty too soon.',
                tags: ['intuition', 'mystery', 'inner-voice', 'patience']
            }
        ]
    },
    3: {
        title: 'The Empress',
        theme: 'Nurture & Abundance',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Growth comes from care. Nourish what you love, tend the conditions, and let abundance be something you cultivate rather than chase.',
                tags: ['nurture', 'abundance', 'creativity', 'embodiment']
            }
        ]
    },
    4: {
        title: 'The Emperor',
        theme: 'Structure & Authority',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Stability is built, not wished for. Define boundaries, take responsibility, and build the structure that can hold your plans.',
                tags: ['authority', 'structure', 'boundaries', 'leadership']
            }
        ]
    },
    5: {
        title: 'The Hierophant',
        theme: 'Tradition & Guidance',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Wisdom lives in practice and community. Seek counsel, commit to what is meaningful, and let shared values guide your next step.',
                tags: ['tradition', 'learning', 'community', 'values']
            }
        ]
    },
    6: {
        title: 'The Lovers',
        theme: 'Choice & Alignment',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'This is a choice about values as much as desire. Align with what you love, be honest about what you want, and choose the relationship or path that fits your integrity.',
                tags: ['relationships', 'choice', 'alignment', 'commitment']
            }
        ]
    },
    7: {
        title: 'The Chariot',
        theme: 'Direction & Determination',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Momentum comes from focus. Hold the reins, align competing forces, and keep your direction clear through disciplined action.',
                tags: ['willpower', 'momentum', 'discipline', 'victory']
            }
        ]
    },
    8: {
        title: 'Strength',
        theme: 'Courage & Compassion',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Real power is gentle. Meet fear with patience, lead with kindness, and let steady courage tame what feels unruly.',
                tags: ['courage', 'compassion', 'resilience', 'patience']
            }
        ]
    },
    9: {
        title: 'The Hermit',
        theme: 'Solitude & Insight',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Step back to see clearly. Solitude is not avoidance; it is the space where your inner guidance can become audible.',
                tags: ['introspection', 'solitude', 'wisdom', 'clarity']
            }
        ]
    },
    10: {
        title: 'Wheel of Fortune',
        theme: 'Cycles & Change',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Life is turning. Notice what is shifting, adapt with flexibility, and use the change to reset a pattern rather than repeat it.',
                tags: ['cycles', 'change', 'fate', 'timing']
            }
        ]
    },
    11: {
        title: 'Justice',
        theme: 'Truth & Accountability',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Clarity comes with responsibility. Tell the truth, weigh your actions, and choose the path that restores balance.',
                tags: ['truth', 'balance', 'accountability', 'integrity']
            }
        ]
    },
    12: {
        title: 'The Hanged Man',
        theme: 'Surrender & Perspective',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Pause is not failure. Release control, see the situation from another angle, and let the right timing reveal itself.',
                tags: ['surrender', 'perspective', 'patience', 'pause']
            }
        ]
    },
    13: {
        title: 'Death',
        theme: 'Endings & Transformation',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'An ending clears space for the next true thing. Let what is complete be complete, and allow transformation to do its honest work.',
                tags: ['endings', 'transformation', 'release', 'renewal']
            }
        ]
    },
    14: {
        title: 'Temperance',
        theme: 'Balance & Integration',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Blend what you have learned with patience and care. Moderation is not smallness; it is the steady rhythm that makes growth sustainable.',
                tags: ['balance', 'patience', 'integration', 'healing']
            }
        ]
    },
    15: {
        title: 'The Devil',
        theme: 'Attachment & Shadow',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Name the attachment honestly. When you see the pattern clearly, you can choose freedom instead of compulsion.',
                tags: ['attachment', 'shadow', 'liberation', 'choice']
            }
        ]
    },
    16: {
        title: 'The Tower',
        theme: 'Disruption & Revelation',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Truth breaks through what cannot hold. Let the false fall quickly and rebuild on what is real.',
                tags: ['upheaval', 'revelation', 'truth', 'rebuild']
            }
        ]
    },
    17: {
        title: 'The Star',
        theme: 'Hope & Renewal',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Hope returns after difficulty. Heal gently, restore faith in yourself, and let small acts of care guide you forward.',
                tags: ['hope', 'renewal', 'healing', 'faith']
            }
        ]
    },
    18: {
        title: 'The Moon',
        theme: 'Uncertainty & Intuition',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Not everything is clear yet. Move slowly, respect your instincts, and let the unknown unfold without forcing certainty.',
                tags: ['intuition', 'uncertainty', 'subconscious', 'mystery']
            }
        ]
    },
    19: {
        title: 'The Sun',
        theme: 'Clarity & Joy',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Light and warmth return. Celebrate what is working, share your joy, and let confidence grow from simple truth.',
                tags: ['joy', 'success', 'vitality', 'clarity']
            }
        ]
    },
    20: {
        title: 'Judgement',
        theme: 'Awakening & Calling',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'This is a call to rise. Forgive the past, listen for what is asking to be born, and answer with courage.',
                tags: ['awakening', 'calling', 'rebirth', 'forgiveness']
            }
        ]
    },
    21: {
        title: 'The World',
        theme: 'Completion & Wholeness',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'A cycle completes and integration is possible. Honor what you have achieved and step forward with a fuller sense of wholeness.',
                tags: ['completion', 'integration', 'wholeness', 'achievement']
            }
        ]
    }
};

/**
 * Curated passages for high-significance dyads.
 * Keys match the card order from ARCHETYPAL_DYADS (not always ascending).
 */
export const DYAD_PASSAGES = {
    '13-17': {
        cards: [13, 17],
        names: ['Death', 'The Star'],
        theme: 'Transformation clearing into hope',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Letting go is not the end of the story. When the clearing is honest (Death), the next phase can be gentler and more inspired (The Star). Focus on recovery, replenishment, and a next true step. The skeleton on the white horse and banner, and the Star\'s large star and pitchers by the pool, point to renewal after clearing.',
                tags: ['transformation', 'hope', 'recovery'],
                visualAnchors: [
                    'skeleton',
                    'white horse',
                    'banner',
                    'large star',
                    'pitchers',
                    'pool'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'grief',
                text:
                    'Necessary endings create space for renewal. Grief makes room for healing when you let the ending be real, then tend the recovery with patience. The Star favors gentleness: rest, hydration, honest support, and small rituals that restore faith one day at a time.',
                tags: ['grief', 'healing', 'renewal', 'recovery', 'hope'],
                visualAnchors: [
                    'skeleton',
                    'white horse',
                    'banner',
                    'large star',
                    'pitchers',
                    'pool'
                ]
            }
        ]
    },

    '16-19': {
        cards: [16, 19],
        names: ['The Tower', 'The Sun'],
        theme: 'Upheaval revealing clarity',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'If something breaks, ask what truth it reveals. The Tower strips the false; the Sun restores the simple, bright facts. After the shake-up: simplify, tell the truth, and rebuild from what’s real. The lightning-struck tower with falling figures meets the radiant sun, naked child, and sunflowers.',
                tags: ['truth', 'clarity', 'rebuild'],
                visualAnchors: [
                    'lightning',
                    'tower',
                    'falling figures',
                    'radiant sun with face',
                    'naked child',
                    'sunflowers'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'transition',
                text:
                    'Necessary destruction brings authentic joy. When illusions shatter, the gift is daylight: clean facts, clear commitments, and honest repair. Let what cannot stand fall quickly, then rebuild with transparency and simple routines that support the life you actually want.',
                tags: ['transition', 'truth', 'breakthrough', 'clarity', 'rebuild']
            }
        ]
    },

    '15-6': {
        cards: [15, 6],
        names: ['The Devil', 'The Lovers'],
        theme: 'Attachment patterns affecting choice',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Desire can clarify values, but it can also bind. When attachment tightens (The Devil), choice becomes a test (The Lovers). Name what is hooking you, then choose the path that aligns with your real values. The horned figure and chained figures stand beneath the Lovers\' angel between the tree of knowledge and tree of life.',
                tags: ['attachments', 'choices', 'values', 'freedom'],
                visualAnchors: [
                    'horned figure',
                    'chained figures',
                    'angel',
                    'tree of knowledge',
                    'tree of life'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'relationship',
                text:
                    'When desire mixes with fear, choosing becomes difficult. The Devil highlights compulsion—jealousy, secrecy, obligation, or control. The Lovers asks for a values-based choice: love without chains, honesty over intensity, alignment over attachment.',
                tags: ['relationship', 'attachments', 'values', 'choice', 'boundaries']
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'addiction',
                text:
                    'Addiction affects relationship choices. The Devil shows the hook, and the Lovers asks you to choose what supports freedom and health. Seek support, create boundaries, reduce access, and choose the path that strengthens recovery—one honest decision at a time.',
                tags: ['addiction', 'recovery', 'choices', 'support', 'freedom']
            }
        ]
    },

    '0-1': {
        cards: [0, 1],
        names: ['The Fool', 'The Magician'],
        theme: 'Potential meeting capability',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Begin with curiosity (The Fool), then act with skill and focus (The Magician). This pairing favors prototypes, experiments, and learning-by-doing—without losing your sense of wonder. The cliff, dog, and white rose, then the infinity symbol over the wand, cup, sword, and pentacle, show potential turning into skill.',
                tags: ['beginnings', 'skill', 'experimentation'],
                visualAnchors: [
                    'cliff',
                    'dog',
                    'white rose',
                    'infinity symbol',
                    'wand',
                    'cup',
                    'sword',
                    'pentacle'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'manifestation',
                text:
                    'Beginner’s mind is powerful when paired with competence. Take the leap, then choose a method: tools, timelines, and practice. The magic here is follow-through—turn inspiration into a repeatable process and let small experiments become real results.',
                tags: ['manifestation', 'beginnings', 'agency', 'practice', 'focus'],
                visualAnchors: [
                    'cliff',
                    'dog',
                    'white rose',
                    'infinity symbol',
                    'wand',
                    'cup',
                    'sword',
                    'pentacle'
                ]
            }
        ]
    },

    '15-16': {
        cards: [15, 16],
        names: ['The Devil', 'The Tower'],
        theme: 'Bondage meeting disruption',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'When attachment becomes a trap (The Devil), disruption can be mercy (The Tower). Look for the habit, fear, or story that’s losing power—and choose the freer option, even if it’s uncomfortable at first. The horned figure and chained figures collide with the lightning-struck tower and falling figures.',
                tags: ['liberation', 'habits', 'breakthrough'],
                visualAnchors: [
                    'horned figure',
                    'chained figures',
                    'lightning',
                    'tower',
                    'falling figures'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'shadow',
                text:
                    'Liberation through crisis: the Tower breaks the spell. If you have been bargaining with a habit or a situation, the negotiation ends here. Cooperate with the break—tell the truth, change the environment, remove access, and ask for help so the freedom can stick.',
                tags: ['shadow', 'liberation', 'truth', 'breakthrough', 'support']
            }
        ]
    },

    '10-20': {
        cards: [10, 20],
        names: ['Wheel of Fortune', 'Judgement'],
        theme: 'Cycle turning into a wake-up call',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'A cycle changes (Wheel) and you’re asked to respond consciously (Judgement). Review what repeats, extract the lesson, and make a deliberate choice that closes the loop. The turning wheel with the sphinx and snake meets the angel\'s trumpet and rising figures.',
                tags: ['cycles', 'karma', 'choice', 'reckoning'],
                visualAnchors: [
                    'wheel',
                    'sphinx',
                    'snake',
                    'angel',
                    'trumpet',
                    'rising figures'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'A major cycle is completing, and the lesson wants integration. The Wheel turns whether you consent or not; Judgement asks you to wake up and choose consciously. Review what repeats, take responsibility for your part, and make a new decision that ends the pattern.',
                tags: ['spiritual', 'karma', 'cycles', 'reckoning', 'choice']
            }
        ]
    },

    '17-20': {
        cards: [17, 20],
        names: ['The Star', 'Judgement'],
        theme: 'Renewed hope calling forth rebirth',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Hope returns as a clear signal (The Star). Judgement asks you to answer it: integrate the lesson, release the old story, and rise into the next version of yourself. The Star\'s large star and pitchers by the pool answer the angel\'s trumpet and rising figures.',
                tags: ['hope', 'renewal', 'rebirth', 'calling'],
                visualAnchors: [
                    'large star',
                    'pitchers',
                    'pool',
                    'angel',
                    'trumpet',
                    'rising figures'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'calling',
                text:
                    'A clear vision is asking to be embodied. The Star is the signal, and Judgement is the decision to answer it. Take one action that matches the future you want: send the message, submit the application, book the appointment, tell the truth.',
                tags: ['calling', 'hope', 'action', 'renewal', 'rebirth']
            }
        ]
    },

    '7-21': {
        cards: [7, 21],
        names: ['The Chariot', 'The World'],
        theme: 'Determined action reaching completion',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Discipline and focus steer the path (The Chariot). Keep that steady will as you approach completion (The World), so the cycle can close with clarity and celebration. The sphinxes and starry canopy drive toward the dancer inside the wreath and the four fixed signs.',
                tags: ['discipline', 'completion', 'mastery', 'achievement'],
                visualAnchors: [
                    'sphinxes',
                    'starry canopy',
                    'dancer',
                    'wreath',
                    'four fixed signs'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'career',
                text:
                    'Victory is approaching culmination. Stay disciplined through the last mile, then close the loop: document lessons, celebrate the win, and rest before the next push. The World rewards finished work, not just effort.',
                tags: ['career', 'discipline', 'achievement', 'completion', 'mastery']
            }
        ]
    },

    '9-2': {
        cards: [9, 2],
        names: ['The Hermit', 'The High Priestess'],
        theme: 'Solitude deepening intuition',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Quiet brings signal. The Hermit reduces noise; the High Priestess increases inner knowing. Favor stillness, journaling, and gentle questions over rushing to conclusions. The Hermit\'s lantern with the six-pointed star meets the High Priestess\'s pillars, veil, scroll, and lunar crown.',
                tags: ['intuition', 'solitude', 'inner-wisdom'],
                visualAnchors: [
                    'lantern',
                    'six-pointed star',
                    'pillars',
                    'veil',
                    'scroll',
                    'lunar crown'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Outer withdrawal reveals inner knowing. Reduce inputs, protect solitude, and listen for what remains. The High Priestess rewards patience: dreams, synchronicities, and subtle cues become clearer when you stop demanding loud answers.',
                tags: ['spiritual', 'intuition', 'solitude', 'dreamwork', 'discernment']
            }
        ]
    },

    '12-13': {
        cards: [12, 13],
        names: ['The Hanged Man', 'Death'],
        theme: 'Surrender enabling transformation',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'When you stop resisting the pause, transformation arrives with less friction. The Hanged Man teaches that some endings cannot be rushed—they must be allowed. Surrender is the bridge to genuine release. The Hanged Man\'s halo on the tree gives way to Death\'s skeleton on the white horse and banner.',
                tags: ['surrender', 'transformation', 'patience', 'release'],
                visualAnchors: [
                    'halo',
                    'tree',
                    'skeleton',
                    'white horse',
                    'banner'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'transition',
                text:
                    'Letting go makes way for metamorphosis. Some endings resolve only when you stop pushing and accept the pause. Choose grace over force: release control, allow the old to fall away, and let the new form without being strangled by urgency.',
                tags: ['transition', 'surrender', 'transformation', 'release', 'patience']
            }
        ]
    },

    '8-11': {
        cards: [8, 11],
        names: ['Strength', 'Justice'],
        theme: 'Compassion balanced with accountability',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'True strength holds space for others while still honoring what is fair. Be both kind and honest—compassion does not mean avoiding responsibility. Balance gentle persuasion with clear boundaries. The lion and infinity symbol meet the scales and sword.',
                tags: ['compassion', 'accountability', 'balance', 'integrity'],
                visualAnchors: [
                    'lion',
                    'infinity symbol',
                    'scales',
                    'sword'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'boundaries',
                text:
                    'Kindness does not bypass accountability. Strength keeps the heart open; Justice draws the line. Speak truth calmly, enforce boundaries cleanly, and let fairness be an act of care rather than punishment.',
                tags: ['boundaries', 'compassion', 'truth', 'accountability', 'integrity']
            }
        ]
    },

    '2-5': {
        cards: [2, 5],
        names: ['The High Priestess', 'The Hierophant'],
        theme: 'Inner knowing versus outer teaching',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Sometimes your inner voice and received wisdom point different directions. The High Priestess trusts intuition; the Hierophant trusts tradition. Find where they align, and question where they diverge. The High Priestess\'s pillars, veil, scroll, and crescent moon face the Hierophant\'s crossed keys and two acolytes.',
                tags: ['intuition', 'tradition', 'wisdom', 'discernment'],
                visualAnchors: [
                    'pillars',
                    'veil',
                    'scroll',
                    'crescent moon',
                    'crossed keys',
                    'two acolytes'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'spiritual',
                text:
                    'Mystery and tradition both have something to teach you. Test received teachings against lived experience. Keep what deepens your integrity, and release what demands blind obedience. Build a practice that honors both inner knowing and structured wisdom.',
                tags: ['spiritual', 'intuition', 'tradition', 'practice', 'discernment']
            }
        ]
    },

    '4-3': {
        cards: [4, 3],
        names: ['The Emperor', 'The Empress'],
        theme: 'Structure and abundance in dialogue',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Order and fertility need each other. The Emperor provides structure; the Empress provides flow. Honor both—discipline without nurture is barren, abundance without form is chaotic. Ram heads and the orb meet wheat fields and the Venus symbol.',
                tags: ['balance', 'structure', 'nurture', 'creation'],
                visualAnchors: [
                    'ram heads',
                    'orb',
                    'wheat fields',
                    'Venus symbol'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'creative',
                text:
                    'Discipline supports creativity. Pair planning with nurture: budgets, boundaries, and timelines that protect the life-force of the project. When structure and abundance cooperate, you can build something both beautiful and durable.',
                tags: ['creative', 'structure', 'nurture', 'abundance', 'balance']
            }
        ]
    },

    '5-15': {
        cards: [5, 15],
        names: ['The Hierophant', 'The Devil'],
        theme: 'Tradition becoming restriction',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'What once guided can also bind. The Hierophant offers wisdom, but the Devil reveals where doctrine has become a cage. Discern which inherited beliefs still serve you and which now limit your freedom. The Hierophant\'s crossed keys and pillars contrast the horned figure, inverted pentagram, and chained figures.',
                tags: ['tradition', 'restriction', 'freedom', 'discernment'],
                visualAnchors: [
                    'crossed keys',
                    'pillars',
                    'horned figure',
                    'inverted pentagram',
                    'chained figures'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'shadow',
                text:
                    'When guidance becomes bondage, it is time to re-evaluate. Keep tradition that brings life, but release doctrine that feeds fear, shame, or control. True spiritual authority increases freedom and responsibility at the same time.',
                tags: ['shadow', 'tradition', 'freedom', 'discernment', 'integrity']
            }
        ]
    },

    '18-19': {
        cards: [18, 19],
        names: ['The Moon', 'The Sun'],
        theme: 'Mystery yielding to illumination',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'What is hidden will come to light. The Moon walks through shadow and uncertainty; the Sun reveals the simple truth that was there all along. Trust the process—clarity follows honest confusion. The full moon with face, two towers, dog and wolf, and winding path yield to the radiant sun, naked child, and sunflowers.',
                tags: ['mystery', 'clarity', 'truth', 'cycles'],
                visualAnchors: [
                    'full moon with face',
                    'two towers',
                    'dog and wolf',
                    'winding path',
                    'radiant sun with face',
                    'naked child',
                    'sunflowers'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'clarity',
                text:
                    'Confusion is clarifying into truth. Let the Moon do its work: sleep, journal, slow down, check facts, and avoid premature conclusions. The Sun arrives as clean insight and simple next steps when you stop forcing certainty.',
                tags: ['clarity', 'truth', 'discernment', 'intuition', 'patience']
            }
        ]
    },

    '0-21': {
        cards: [0, 21],
        names: ['The Fool', 'The World'],
        theme: 'Beginning contains ending',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Every ending opens a new beginning. The Fool leaps into the unknown; the World celebrates completion. Together they remind you that the journey is circular—mastery returns to wonder, and wonder leads to mastery. The cliff, dog, and white rose step into the dancer within the wreath under the four fixed signs.',
                tags: ['cycles', 'completion', 'beginnings', 'journey'],
                visualAnchors: [
                    'cliff',
                    'dog',
                    'white rose',
                    'dancer',
                    'wreath',
                    'four fixed signs'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'life-cycle',
                text:
                    'You are at both the start and the finish of a great cycle. Honor completion fully—celebrate, grieve, integrate—then step forward with beginner’s mind. The journey continues, but you are not the same person who began it.',
                tags: ['cycles', 'completion', 'beginnings', 'integration', 'identity']
            }
        ]
    },

    '13-14': {
        cards: [13, 14],
        names: ['Death', 'Temperance'],
        theme: 'Transformation finding integration',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'After the clearing, the blending. Death clears what no longer serves; Temperance integrates what remains into a new wholeness. Give yourself time to absorb the change before rushing forward. The skeleton on the white horse and banner yields to Temperance\'s angel pouring between cups with one foot on land and one in water.',
                tags: ['transformation', 'integration', 'healing', 'patience'],
                visualAnchors: [
                    'skeleton',
                    'white horse',
                    'banner',
                    'angel',
                    'cups',
                    'one foot on land',
                    'one foot in water'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'healing',
                text:
                    'Deep change is followed by gentle blending. After an ending, your job is integration: stabilize your routines, make space for emotion, and let the new self settle into the body. Temperance is healing through small, consistent care.',
                tags: ['healing', 'integration', 'patience', 'transition', 'self-care']
            }
        ]
    },

    '11-12': {
        cards: [11, 12],
        names: ['Justice', 'The Hanged Man'],
        theme: 'Truth requiring surrender',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Justice reveals what is true; the Hanged Man asks you to accept it. Seeing clearly is only the first step—wisdom lies in surrendering to what truth demands of you. The scales and sword meet the Hanged Man\'s halo, tau cross, and tree.',
                tags: ['truth', 'surrender', 'acceptance', 'wisdom'],
                visualAnchors: [
                    'scales',
                    'sword',
                    'halo',
                    'tau cross',
                    'tree'
                ]
            },
            {
                source: 'Tableu Tarot Canon',
                context: 'acceptance',
                text:
                    'Honest assessment leads to necessary pause. Once you see the truth clearly, stop bargaining with it. Let go, adjust your perspective, and allow priorities to rearrange. Surrender is how truth becomes wisdom.',
                tags: ['acceptance', 'truth', 'surrender', 'perspective', 'wisdom']
            }
        ]
    }
};

/**
 * Curated passages for suit progressions.
 */
export const SUIT_PROGRESSION_PASSAGES = {
    Wands: {
        beginning: {
            title: 'Wands Beginning: Ignition',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Wands energy is spark and momentum. Start small, move fast, and protect your enthusiasm with simple structure so inspiration can become something real.',
                    tags: ['creativity', 'momentum', 'beginnings']
                }
            ]
        },
        challenge: {
            title: 'Wands Challenge: Testing the Fire',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Wands can feel like heat: competition, visibility, and friction. Choose your battles, refine your message, and keep the flame aimed at what matters most.',
                    tags: ['competition', 'focus', 'pressure']
                }
            ]
        },
        mastery: {
            title: 'Wands Mastery: Culmination',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Wands moves quickly, but it can burn out. Sustain the pace through boundaries, delegation, and rest. The goal is durable impact, not constant intensity.',
                    tags: ['burnout', 'responsibility', 'sustainability']
                }
            ]
        }
    },

    Cups: {
        beginning: {
            title: 'Cups Beginning: Emotional Opening',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Cups opens the heart: connection, receptivity, and shared joy. Let support in and notice what feels nourishing.',
                    tags: ['connection', 'love', 'receptivity']
                }
            ]
        },
        challenge: {
            title: 'Cups Challenge: Emotional Complexity',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Cups asks for discernment: mixed feelings, grief, nostalgia, and tempting fantasies. Name the emotion, then choose what’s true rather than what’s merely soothing.',
                    tags: ['discernment', 'grief', 'clarity']
                }
            ]
        },
        mastery: {
            title: 'Cups Mastery: Emotional Fulfillment',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Cups is emotional maturity: choosing what nourishes, releasing what doesn’t, and building secure joy. Satisfaction grows when boundaries and love cooperate.',
                    tags: ['maturity', 'fulfillment', 'boundaries']
                }
            ]
        }
    },

    Swords: {
        beginning: {
            title: 'Swords Beginning: Mental Clarity',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Swords brings insight and tough decisions. Let clarity be compassionate: tell the truth without turning it into self-attack.',
                    tags: ['truth', 'decision', 'clarity']
                }
            ]
        },
        challenge: {
            title: 'Swords Challenge: Mental Struggle',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Swords highlights conflict and strategy. Choose peace when possible, rest when needed, and don’t confuse “winning” with “being well.”',
                    tags: ['conflict', 'rest', 'strategy']
                }
            ]
        },
        mastery: {
            title: 'Swords Mastery: Crisis & Release',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Swords can feel like rock bottom—then release. When the mind is loud, simplify: breathe, ground, ask for help, and let the next right action be small.',
                    tags: ['anxiety', 'release', 'support']
                }
            ]
        }
    },

    Pentacles: {
        beginning: {
            title: 'Pentacles Beginning: Material Foundation',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Early Pentacles is the seed of tangible change: skill-building, budgeting, and steady practice. Small consistent steps matter more than big gestures.',
                    tags: ['foundation', 'practice', 'resources']
                }
            ]
        },
        challenge: {
            title: 'Pentacles Challenge: Resource Management',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Mid Pentacles asks you to steward what you have—time, money, health, attention. Tightness loosens when you plan, share wisely, and think long-term.',
                    tags: ['stewardship', 'planning', 'patience']
                }
            ]
        },
        mastery: {
            title: 'Pentacles Mastery: Material Security',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    text:
                        'Late Pentacles is durable security: craft, independence, and legacy. Build what lasts by tending details and honoring sustainable rhythms.',
                    tags: ['stability', 'legacy', 'craft']
                }
            ]
        }
    }
};

/**
 * Curated passages for court lineages (multiple court cards within the same suit).
 * Keys are nested by suit → significance, matching graphContext `courtLineages`.
 */
export const COURT_LINEAGE_PASSAGES = {
    Wands: {
        alliance: {
            title: 'Wands Court Alliance',
            theme: 'Fire collaborating through roles',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'Multiple Wands courts suggest your will is recruiting allies: the spark, the charge, the steady warmth, and the directing vision. With an alliance (two courts), focus on collaboration and clear roles—who initiates, who carries momentum, who protects the flame.',
                    tags: ['wands', 'courts', 'collaboration', 'roles', 'fire']
                }
            ]
        },
        council: {
            title: 'Wands Court Council',
            theme: 'A full ecosystem of creative authority',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'A council of Wands courts indicates a whole creative ecosystem is active: initiation, action, stewardship, and leadership. This is a moment to build a team, set standards, and aim your fire at one clear mission so ambition becomes durable impact.',
                    tags: ['wands', 'courts', 'leadership', 'mission', 'fire']
                }
            ]
        }
    },
    Cups: {
        alliance: {
            title: 'Cups Court Alliance',
            theme: 'Emotional intelligence in partnership',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'Multiple Cups courts suggest feelings are organizing into relationship. With an alliance (two courts), practice emotional honesty and attunement: listen, name the need, and respond with care without losing boundaries. Empathy becomes strength when it stays grounded.',
                    tags: ['cups', 'courts', 'empathy', 'relationship', 'boundaries']
                }
            ]
        },
        council: {
            title: 'Cups Court Council',
            theme: 'A full spectrum of heart leadership',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'A council of Cups courts brings the full spectrum of emotional leadership: innocence, pursuit, deep feeling, and mature care. Let the heart lead—but keep it wise. This is excellent for reconciliation, family decisions, or building community through tenderness and truth.',
                    tags: ['cups', 'courts', 'community', 'healing', 'truth']
                }
            ]
        }
    },
    Swords: {
        alliance: {
            title: 'Swords Court Alliance',
            theme: 'Strategy and clear communication',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'Multiple Swords courts suggest a strategic conversation. With an alliance (two courts), get precise: define terms, write it down, ask direct questions, and avoid assumptions. Clarity is kindness when it is paired with respect.',
                    tags: ['swords', 'courts', 'strategy', 'communication', 'clarity']
                }
            ]
        },
        council: {
            title: 'Swords Court Council',
            theme: 'A complex decision needing governance',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'A council of Swords courts indicates a complex decision that benefits from governance: debate, evidence, and clear leadership. Separate facts from fear, make a plan, and commit to one coherent story so your mind becomes a tool instead of a courtroom.',
                    tags: ['swords', 'courts', 'decision', 'evidence', 'governance']
                }
            ]
        }
    },
    Pentacles: {
        alliance: {
            title: 'Pentacles Court Alliance',
            theme: 'Practical support and stewardship',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'Multiple Pentacles courts suggest practical support is available. With an alliance (two courts), focus on stewardship: budgets, skills, routines, and reliable commitments. This is slow magic—small consistent actions that compound into security.',
                    tags: ['pentacles', 'courts', 'resources', 'stewardship', 'stability']
                }
            ]
        },
        council: {
            title: 'Pentacles Court Council',
            theme: 'Building durable systems and legacy',
            passages: [
                {
                    source: 'Tableu Tarot Canon',
                    context: 'general',
                    text:
                        'A council of Pentacles courts points to systems thinking: build what lasts. Organize resources, formalize roles, and invest in the long term—health, craft, savings, and community infrastructure. Legacy is built through patient attention.',
                    tags: ['pentacles', 'courts', 'systems', 'legacy', 'patience']
                }
            ]
        }
    }
};

/**
 * Curated passages for Thoth suit highlights (Thoth deck style).
 * Keys match graphContext `thothSuits` values.
 */
export const THOTH_SUIT_PASSAGES = {
    Wands: {
        title: 'Thoth Suit Current: Wands',
        theme: 'Fire decans shaping will',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'In the Thoth current, Wands emphasizes the raw geometry of will: force, appetite for growth, and the need to aim fire precisely. Notice where passion is rising and where it is scattering. The best use of Wands is directed heat—one clear objective, repeated action, and disciplined courage.',
                tags: ['thoth', 'wands', 'fire', 'will', 'discipline']
            }
        ]
    },
    Cups: {
        title: 'Thoth Suit Current: Cups',
        theme: 'Water decans shaping devotion',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'In the Thoth current, Cups is the chemistry of feeling: devotion, longing, saturation, and release. Pay attention to what nourishes you versus what seduces you into numbness. The healthiest Cups current is honest intimacy—emotion with boundaries and purpose.',
                tags: ['thoth', 'cups', 'water', 'devotion', 'boundaries']
            }
        ]
    },
    Swords: {
        title: 'Thoth Suit Current: Swords',
        theme: 'Air decans shaping mind',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'In the Thoth current, Swords highlights the architecture of thought: clarity, conflict, analysis, and the risk of cruelty toward self or others. Use the mind as an instrument—test assumptions, choose truth, and rest when thinking becomes spinning.',
                tags: ['thoth', 'swords', 'air', 'clarity', 'discernment']
            }
        ]
    },
    Pentacles: {
        title: 'Thoth Suit Current: Pentacles',
        theme: 'Earth decans shaping material reality',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'In the Thoth current, Pentacles emphasizes embodiment: resources, systems, craft, and the long arc of material consequence. Ask what is sustainable. Small practical choices—sleep, money, maintenance, skill—create the field where everything else can work.',
                tags: ['thoth', 'pentacles', 'earth', 'resources', 'sustainability']
            }
        ]
    }
};

/**
 * Curated passages for Marseille pip numerology clusters.
 * Keys match graphContext `marseilleRanks` values (1-10).
 */
export const MARSEILLE_NUMEROLOGY_PASSAGES = {
    1: {
        title: 'Marseille Numerology: One',
        theme: 'Essence',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'One is essence and direction: a single axis, a seed of purpose asking to be aimed. When Ones cluster, simplify. Choose the core intention and build from it, rather than scattering energy across too many starts.',
                tags: ['marseille', 'numerology', 'one', 'essence', 'intention']
            }
        ]
    },
    2: {
        title: 'Marseille Numerology: Two',
        theme: 'Duality',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Two is dialogue and polarity seeking harmony. When Twos cluster, notice choices, mirrors, and negotiations. The task is balance: hold both sides long enough to find the third option—cooperation, compromise, or clear separation.',
                tags: ['marseille', 'numerology', 'two', 'choice', 'balance']
            }
        ]
    },
    3: {
        title: 'Marseille Numerology: Three',
        theme: 'Expansion',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Three is growth and momentum: ideas become movement, collaboration becomes creation. When Threes cluster, iterate and build. Share, refine, and let the work expand beyond the private sketch into a living form.',
                tags: ['marseille', 'numerology', 'three', 'growth', 'collaboration']
            }
        ]
    },
    4: {
        title: 'Marseille Numerology: Four',
        theme: 'Structure',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Four is foundation and boundary: the lattice that holds the pattern. When Fours cluster, stabilize. Define the rules, protect the resources, and build the container that can support future growth.',
                tags: ['marseille', 'numerology', 'four', 'structure', 'foundation']
            }
        ]
    },
    5: {
        title: 'Marseille Numerology: Five',
        theme: 'Vital Shift',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Five is tension that prompts recalibration. When Fives cluster, expect friction and re-evaluation. Use the disruption as information: what is misaligned, what needs courage, and what wants a new strategy?',
                tags: ['marseille', 'numerology', 'five', 'change', 'courage']
            }
        ]
    },
    6: {
        title: 'Marseille Numerology: Six',
        theme: 'Harmony',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Six is equilibrium and beauty: forces weaving into balance. When Sixes cluster, restore harmony—repair relationships, smooth processes, and choose what is mutually nourishing. This is the number of alignment through thoughtful care.',
                tags: ['marseille', 'numerology', 'six', 'harmony', 'alignment']
            }
        ]
    },
    7: {
        title: 'Marseille Numerology: Seven',
        theme: 'Challenge',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Seven introduces asymmetry: a challenge that asks for faith beyond comfort. When Sevens cluster, slow down and get discerning. Not everything is stable yet; test what is real, and commit only after your intuition and evidence agree.',
                tags: ['marseille', 'numerology', 'seven', 'discernment', 'faith']
            }
        ]
    },
    8: {
        title: 'Marseille Numerology: Eight',
        theme: 'Movement',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Eight is momentum and cycles: loops, crossings, diligence. When Eights cluster, consistency wins. Build rhythm, practice the craft, and let repetition become mastery instead of boredom.',
                tags: ['marseille', 'numerology', 'eight', 'momentum', 'practice']
            }
        ]
    },
    9: {
        title: 'Marseille Numerology: Nine',
        theme: 'Ripeness',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Nine is fullness and stewardship. When Nines cluster, something is ripe—ready to harvest, refine, and protect. Enjoy the abundance, but do not waste it; completion asks for care.',
                tags: ['marseille', 'numerology', 'nine', 'harvest', 'stewardship']
            }
        ]
    },
    10: {
        title: 'Marseille Numerology: Ten',
        theme: 'Threshold',
        passages: [
            {
                source: 'Tableu Tarot Canon',
                context: 'general',
                text:
                    'Ten is culmination and transition: closure that opens a new cycle. When Tens cluster, finish what you must finish, then release it. Do not drag completion into the next chapter—cross the threshold cleanly.',
                tags: ['marseille', 'numerology', 'ten', 'threshold', 'completion']
            }
        ]
    }
};

/**
 * Get all passages for a specific pattern.
 * @param {'triad'|'fools-journey'|'major-arcana'|'dyad'|'suit-progression'|'court-lineage'|'thoth-suit'|'marseille-numerology'} patternType
 * @param {string} patternId
 */
export function getPassagesForPattern(patternType, patternId) {
    switch (patternType) {
        case 'triad':
            return TRIAD_PASSAGES[patternId] || null;
        case 'fools-journey':
            return FOOLS_JOURNEY_PASSAGES[patternId] || null;
        case 'major-arcana': {
            const cardNumber = Number(patternId);
            if (!Number.isInteger(cardNumber) || cardNumber < 0 || cardNumber > 21) {
                return null;
            }
            return MAJOR_ARCANA_PASSAGES[cardNumber] || null;
        }
        case 'dyad':
            return DYAD_PASSAGES[patternId] || null;
        case 'suit-progression': {
            const [suit, stage] = String(patternId || '').split(':');
            return SUIT_PROGRESSION_PASSAGES[suit]?.[stage] || null;
        }
        case 'court-lineage': {
            const [suit, significance] = String(patternId || '').split(':');
            return COURT_LINEAGE_PASSAGES[suit]?.[significance] || null;
        }
        case 'thoth-suit':
            return THOTH_SUIT_PASSAGES[String(patternId || '')] || null;
        case 'marseille-numerology': {
            const rank = Number(patternId);
            if (!rank) return null;
            return MARSEILLE_NUMEROLOGY_PASSAGES[rank] || null;
        }
        default:
            return null;
    }
}

/**
 * Get high-level stats for telemetry/tests.
 */
export function getKnowledgeBaseStats() {
    const suitProgressionsCount = Object.keys(SUIT_PROGRESSION_PASSAGES).reduce(
        (sum, suit) => sum + Object.keys(SUIT_PROGRESSION_PASSAGES[suit]).length,
        0
    );

    const courtLineagesCount = Object.keys(COURT_LINEAGE_PASSAGES).reduce(
        (sum, suit) => sum + Object.keys(COURT_LINEAGE_PASSAGES[suit]).length,
        0
    );

    const totalPassages = [
        ...Object.values(TRIAD_PASSAGES),
        ...Object.values(FOOLS_JOURNEY_PASSAGES),
        ...Object.values(MAJOR_ARCANA_PASSAGES),
        ...Object.values(DYAD_PASSAGES),
        ...Object.values(SUIT_PROGRESSION_PASSAGES).flatMap((suit) => Object.values(suit)),
        ...Object.values(COURT_LINEAGE_PASSAGES).flatMap((suit) => Object.values(suit)),
        ...Object.values(THOTH_SUIT_PASSAGES),
        ...Object.values(MARSEILLE_NUMEROLOGY_PASSAGES)
    ].reduce((sum, entry) => sum + (entry.passages?.length || 0), 0);

    return {
        triads: Object.keys(TRIAD_PASSAGES).length,
        foolsJourneyStages: Object.keys(FOOLS_JOURNEY_PASSAGES).length,
        majorArcana: Object.keys(MAJOR_ARCANA_PASSAGES).length,
        dyads: Object.keys(DYAD_PASSAGES).length,
        suitProgressions: suitProgressionsCount,
        courtLineages: courtLineagesCount,
        thothSuits: Object.keys(THOTH_SUIT_PASSAGES).length,
        marseilleNumerology: Object.keys(MARSEILLE_NUMEROLOGY_PASSAGES).length,
        totalPassages
    };
}
