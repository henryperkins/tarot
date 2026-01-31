// Major Arcana data with 1909 Rider-Waite card images
// Images are from Wikimedia Commons (public domain)
export const MAJOR_ARCANA = [
  { name: 'The Fool', number: 0, upright: 'New beginnings, innocence, spontaneity, free spirit', reversed: 'Recklessness, taken advantage of, inconsideration', image: '/images/cards/RWS1909_-_00_Fool.jpeg' },
  { name: 'The Magician', number: 1, upright: 'Manifestation, resourcefulness, power, inspired action', reversed: 'Manipulation, poor planning, untapped talents', image: '/images/cards/RWS1909_-_01_Magician.jpeg' },
  { name: 'The High Priestess', number: 2, upright: 'Intuition, sacred knowledge, divine feminine, subconscious', reversed: 'Secrets, disconnected from intuition, withdrawal', image: '/images/cards/RWS1909_-_02_High_Priestess.jpeg' },
  { name: 'The Empress', number: 3, upright: 'Femininity, beauty, nature, nurturing, abundance', reversed: 'Creative block, dependence on others', image: '/images/cards/RWS1909_-_03_Empress.jpeg' },
  { name: 'The Emperor', number: 4, upright: 'Authority, establishment, structure, father figure', reversed: 'Domination, excessive control, lack of discipline', image: '/images/cards/RWS1909_-_04_Emperor.jpeg' },
  { name: 'The Hierophant', number: 5, upright: 'Spiritual wisdom, tradition, conformity, institutions', reversed: 'Personal beliefs, freedom, challenging the status quo', image: '/images/cards/RWS1909_-_05_Hierophant.jpeg' },
  { name: 'The Lovers', number: 6, upright: 'Love, harmony, relationships, values alignment, choices', reversed: 'Self-love, disharmony, imbalance, misalignment', image: '/images/cards/RWS1909_-_06_Lovers.jpeg' },
  { name: 'The Chariot', number: 7, upright: 'Control, willpower, success, action, determination', reversed: 'Self-discipline, opposition, lack of direction', image: '/images/cards/RWS1909_-_07_Chariot.jpeg' },
  { name: 'Strength', number: 8, upright: 'Strength, courage, persuasion, influence, compassion', reversed: 'Inner strength, self-doubt, low energy, raw emotion', image: '/images/cards/RWS1909_-_08_Strength.jpeg' },
  { name: 'The Hermit', number: 9, upright: 'Soul-searching, introspection, inner guidance, solitude', reversed: 'Isolation, loneliness, withdrawal', image: '/images/cards/RWS1909_-_09_Hermit.jpeg' },
  { name: 'Wheel of Fortune', number: 10, upright: 'Good luck, karma, life cycles, destiny, turning point', reversed: 'Bad luck, resistance to change, breaking cycles', image: '/images/cards/RWS1909_-_10_Wheel_of_Fortune.jpeg' },
  { name: 'Justice', number: 11, upright: 'Justice, fairness, truth, cause and effect, law', reversed: 'Unfairness, lack of accountability, dishonesty', image: '/images/cards/RWS1909_-_11_Justice.jpeg' },
  { name: 'The Hanged Man', number: 12, upright: 'Pause, surrender, letting go, new perspectives', reversed: 'Delays, resistance, stalling, indecision', image: '/images/cards/RWS1909_-_12_Hanged_Man.jpeg' },
  { name: 'Death', number: 13, upright: 'Endings, change, transformation, transition', reversed: 'Resistance to change, personal transformation, inner purging', image: '/images/cards/RWS1909_-_13_Death.jpeg' },
  { name: 'Temperance', number: 14, upright: 'Balance, moderation, patience, purpose', reversed: 'Imbalance, excess, self-healing, re-alignment', image: '/images/cards/RWS1909_-_14_Temperance.jpeg' },
  { name: 'The Devil', number: 15, upright: 'Shadow self, attachment, addiction, restriction, sexuality', reversed: 'Releasing limiting beliefs, exploring dark thoughts, detachment', image: '/images/cards/RWS1909_-_15_Devil.jpeg' },
  { name: 'The Tower', number: 16, upright: 'Sudden change, upheaval, chaos, revelation, awakening', reversed: 'Personal transformation, fear of change, averting disaster', image: '/images/cards/RWS1909_-_16_Tower.jpeg' },
  { name: 'The Star', number: 17, upright: 'Hope, faith, purpose, renewal, spirituality', reversed: 'Lack of faith, despair, self-trust, disconnection', image: '/images/cards/RWS1909_-_17_Star.jpeg' },
  { name: 'The Moon', number: 18, upright: 'Illusion, fear, anxiety, subconscious, intuition', reversed: 'Release of fear, repressed emotion, inner confusion', image: '/images/cards/RWS1909_-_18_Moon.jpeg' },
  { name: 'The Sun', number: 19, upright: 'Positivity, fun, warmth, success, vitality', reversed: 'Inner child, feeling down, overly optimistic', image: '/images/cards/RWS1909_-_19_Sun.jpeg' },
  { name: 'Judgement', number: 20, upright: 'Judgement, rebirth, inner calling, absolution', reversed: 'Self-doubt, inner critic, ignoring the call', image: '/images/cards/RWS1909_-_20_Judgement.jpeg' },
  { name: 'The World', number: 21, upright: 'Completion, accomplishment, travel, achievement', reversed: 'Seeking closure, shortcuts, delays', image: '/images/cards/RWS1909_-_21_World.jpeg' }
];

export const MAJOR_ARCANA_NAMES = MAJOR_ARCANA.map((card) => card.name);
