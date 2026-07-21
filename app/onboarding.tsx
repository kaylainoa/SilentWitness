import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboarding } from '@/contexts/onboarding-context';
import { useProfile } from '@/contexts/profile-context';

const STEP_COUNT = 6;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const { completeOnboarding } = useOnboarding();
  const { name, setName, pin, setPin, contacts, updateContact } = useProfile();
  const primaryContact = contacts[0];

  const isFirstStep = step === 0;
  const isLastStep = step === STEP_COUNT - 1;

  const canContinue =
    (step !== 1 || name.trim().length > 0) &&
    (step !== 2 || pin.trim().length >= 4) &&
    (step !== 3 ||
      (primaryContact.name.trim().length > 0 && primaryContact.phone.trim().length > 0));

  const goNext = () => {
    if (isLastStep) {
      completeOnboarding();
      return;
    }
    setStep((current) => current + 1);
  };

  const goBack = () => {
    setStep((current) => Math.max(0, current - 1));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {renderStep(step, {
            name,
            setName,
            pin,
            setPin,
            contactName: primaryContact.name,
            setContactName: (value) => updateContact(primaryContact.id, { name: value }),
            contactPhone: primaryContact.phone,
            setContactPhone: (value) => updateContact(primaryContact.id, { phone: value }),
          })}
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.buttonRow}>
            {!isFirstStep && (
              <Pressable style={styles.backButton} onPress={goBack}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.button, !canContinue && styles.buttonDisabled]}
              onPress={goNext}
              disabled={!canContinue}>
              <Text style={styles.buttonText}>{isLastStep ? 'Begin' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function renderStep(
  step: number,
  props: {
    name: string;
    setName: (value: string) => void;
    pin: string;
    setPin: (value: string) => void;
    contactName: string;
    setContactName: (value: string) => void;
    contactPhone: string;
    setContactPhone: (value: string) => void;
  }
) {
  switch (step) {
    case 0:
      return (
        <View style={styles.slide}>
          <Text style={styles.icon}>🔢</Text>
          <Text style={styles.title}>This is SilentWitness</Text>
          <Text style={styles.description}>
            A calculator on the outside. A safeguard on the inside. SilentWitness stays hidden in
            plain sight, quietly listening for signs of danger, capturing audio as a record of
            what happened, and reaching out to someone you trust the moment it senses you&apos;re
            in distress.
          </Text>
        </View>
      );

    case 1:
      return (
        <View style={styles.slide}>
          <Text style={styles.icon}>👤</Text>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.description}>
            This is kept private and never appears on the calculator screen.
          </Text>
          <TextInput
            style={styles.input}
            value={props.name}
            onChangeText={props.setName}
            placeholder="Your name"
            placeholderTextColor="#666"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>
      );

    case 2:
      return (
        <View style={styles.slide}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.title}>Create your secret PIN</Text>
          <Text style={styles.description}>
            Enter this PIN on the calculator keypad any time to start a recording without anyone
            noticing.
          </Text>
          <View style={styles.pinDots}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.pinDot, i < props.pin.length && styles.pinDotFilled]} />
            ))}
          </View>
          <PinKeypad
            pin={props.pin}
            onDigit={(digit) => {
              if (props.pin.length === 0 && digit === '0') return;
              if (props.pin.length < 6) props.setPin(props.pin + digit);
            }}
            onBackspace={() => props.setPin(props.pin.slice(0, -1))}
          />
        </View>
      );

    case 3:
      return (
        <View style={styles.slide}>
          <Text style={styles.icon}>📞</Text>
          <Text style={styles.title}>Who is your emergency contact?</Text>
          <Text style={styles.description}>
            We&apos;ll alert this person if SilentWitness senses you&apos;re in distress.
          </Text>
          <TextInput
            style={styles.input}
            value={props.contactName}
            onChangeText={props.setContactName}
            placeholder="Contact name"
            placeholderTextColor="#666"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            value={props.contactPhone}
            onChangeText={props.setContactPhone}
            placeholder="Phone number"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            returnKeyType="done"
          />
        </View>
      );

    case 4:
      return (
        <View style={styles.slide}>
          <Text style={styles.icon}>📋</Text>
          <Text style={styles.title}>Good to know</Text>
          <View style={styles.rules}>
            <Text style={styles.ruleText}>
              Hold <Text style={styles.ruleHighlight}>mr</Text> to review your profile and
              settings
            </Text>
            <Text style={styles.ruleText}>
              Hold <Text style={styles.ruleHighlight}>.</Text> to review your audio logs
            </Text>
          </View>
        </View>
      );

    case 5:
      return (
        <View style={styles.slide}>
          <Text style={styles.icon}>🛡️</Text>
          <Text style={styles.title}>Stay safe. Stay aware.</Text>
          <Text style={styles.description}>
            SilentWitness works quietly in the background so you can stay present. Help is always
            just a few taps away.
          </Text>
        </View>
      );

    default:
      return null;
  }
}

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

function PinKeypad({
  pin,
  onDigit,
  onBackspace,
}: {
  pin: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
}) {
  return (
    <View style={styles.keypad}>
      {KEYPAD_ROWS.map((row) => (
        <View key={row.join('')} style={styles.keypadRow}>
          {row.map((digit) => (
            <Pressable key={digit} style={styles.keypadButton} onPress={() => onDigit(digit)}>
              <Text style={styles.keypadButtonText}>{digit}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={styles.keypadRow}>
        <View style={styles.keypadButtonSpacer} />
        <Pressable
          style={styles.keypadButton}
          onPress={() => onDigit('0')}
          disabled={pin.length === 0}>
          <Text style={[styles.keypadButtonText, pin.length === 0 && styles.keypadButtonTextDisabled]}>
            0
          </Text>
        </Pressable>
        <Pressable
          style={styles.keypadButton}
          onPress={onBackspace}
          disabled={pin.length === 0}
          hitSlop={8}>
          <Text style={[styles.keypadButtonText, pin.length === 0 && styles.keypadButtonTextDisabled]}>
            ⌫
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    color: '#a5a5a5',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    marginTop: 32,
    width: '100%',
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingVertical: 12,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    marginBottom: 40,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  pinDotFilled: {
    backgroundColor: '#ff9f0a',
    borderColor: '#ff9f0a',
  },
  keypad: {
    gap: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 20,
  },
  keypadButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadButtonSpacer: {
    width: 72,
    height: 72,
  },
  keypadButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '500',
  },
  keypadButtonTextDisabled: {
    opacity: 0.3,
  },
  rules: {
    marginTop: 8,
    gap: 20,
    width: '100%',
  },
  ruleText: {
    color: '#a5a5a5',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
  },
  ruleHighlight: {
    color: '#ff9f0a',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
  },
  dotActive: {
    backgroundColor: '#ff9f0a',
    width: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  button: {
    flex: 2,
    backgroundColor: '#ff9f0a',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
});
