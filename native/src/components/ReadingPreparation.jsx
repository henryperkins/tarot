import { Switch, Text, View } from 'react-native';
import { usePreferences } from '../contexts/PreferencesContext';
import { useReading } from '../contexts/ReadingContext';
import DeckRitual from './DeckRitual';
import QuestionInput from './QuestionInput';

export default function ReadingPreparation() {
  const { voiceOn, setVoiceOn, ambienceOn, setAmbienceOn } = usePreferences();
  const { userQuestion, setUserQuestion } = useReading();

  return (
    <View className="mt-4 gap-4">
      <View className="rounded-2xl bg-surface p-4">
        <Text className="text-ink text-base">Intention</Text>
        <QuestionInput value={userQuestion} onChangeText={setUserQuestion} />
      </View>

      <View className="rounded-2xl bg-surface p-4">
        <Text className="text-ink text-base">Audio</Text>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-ink-muted text-sm">Voice narration</Text>
          <Switch
            value={voiceOn}
            onValueChange={setVoiceOn}
            trackColor={{ false: '#2b2c4a', true: '#c9a227' }}
            thumbColor={voiceOn ? '#1a1a2e' : '#e8d5b7'}
          />
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-ink-muted text-sm">Ambient soundscape</Text>
          <Switch
            value={ambienceOn}
            onValueChange={setAmbienceOn}
            trackColor={{ false: '#2b2c4a', true: '#c9a227' }}
            thumbColor={ambienceOn ? '#1a1a2e' : '#e8d5b7'}
          />
        </View>
      </View>

      <DeckRitual />
    </View>
  );
}
