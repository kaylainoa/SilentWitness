import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/contexts/profile-context';
import { useRecording } from '@/contexts/recording-context';
import { usePushRegistration } from '@/hooks/use-push-registration';
import { useSpikeDetection } from '@/hooks/use-spike-detection';

type Operation = '+' | '-' | '×' | '÷';

const MAX_DIGITS = 9;

function formatNumber(value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Error';

  if (value.includes('.')) {
    const [whole, decimal] = value.split('.');
    return `${Number(whole).toLocaleString('en-US')}.${decimal}`;
  }

  return number.toLocaleString('en-US', { maximumFractionDigits: MAX_DIGITS });
}

function compute(left: number, right: number, operation: Operation): number {
  switch (operation) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      return right === 0 ? NaN : left / right;
  }
}

export default function CalculatorScreen() {
  // Silent background emergency monitor. Runs behind the calculator disguise;
  // has no visible effect on the UI. (Tasks 1, 2, 3, 5.)
  const { triggerManualCapture, stopCaptureEarly, pauseMonitoring, resumeMonitoring } =
    useSpikeDetection();

  // Register this device for emergency push alerts (Task 4).
  usePushRegistration();

  const { pin } = useProfile();

  // The listening/incidents screens are sibling routes, not children of this
  // one, so they reach this hook's controls through here.
  const { registerHandlers } = useRecording();
  useEffect(() => {
    registerHandlers({ triggerManualCapture, stopCaptureEarly, pauseMonitoring, resumeMonitoring });
  }, [registerHandlers, triggerManualCapture, stopCaptureEarly, pauseMonitoring, resumeMonitoring]);

  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [pendingOperation, setPendingOperation] = useState<Operation | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [memory, setMemory] = useState(0);

  const inputDigit = (digit: string) => {
    if (overwrite) {
      setDisplay(digit === '.' ? '0.' : digit);
      setOverwrite(false);
      return;
    }

    if (digit === '.' && display.includes('.')) return;
    if (display.replace(/[-.]/g, '').length >= MAX_DIGITS) return;

    setDisplay(display === '0' && digit !== '.' ? digit : display + digit);
  };

  const clearAll = () => {
    setDisplay('0');
    setStoredValue(null);
    setPendingOperation(null);
    setOverwrite(true);
  };

  const toggleSign = () => {
    if (display === '0') return;
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`);
  };

  const applyPercent = () => {
    setDisplay(String(Number(display) / 100));
  };

  const chooseOperation = (operation: Operation) => {
    const current = Number(display);

    if (pendingOperation && !overwrite && storedValue !== null) {
      const result = compute(storedValue, current, pendingOperation);
      setStoredValue(result);
      setDisplay(Number.isFinite(result) ? String(result) : 'Error');
    } else {
      setStoredValue(current);
    }

    setPendingOperation(operation);
    setOverwrite(true);
  };

  const evaluate = () => {
    if (pin.length > 0 && display === pin) {
      clearAll();
      triggerManualCapture();
      router.push('/listening');
      return;
    }

    if (pendingOperation === null || storedValue === null) return;

    const result = compute(storedValue, Number(display), pendingOperation);
    setDisplay(Number.isFinite(result) ? String(result) : 'Error');
    setStoredValue(null);
    setPendingOperation(null);
    setOverwrite(true);
  };

  const memoryClear = () => {
    setMemory(0);
  };

  const memoryRecall = () => {
    setDisplay(String(memory));
    setOverwrite(true);
  };

  const memorySubtract = () => {
    setMemory(memory - Number(display));
    setOverwrite(true);
  };

  const memoryAdd = () => {
    setMemory(memory + Number(display));
    setOverwrite(true);
  };

  const isClearAll = display === '0' && storedValue === null && pendingOperation === null;
  const hasMemory = memory !== 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.displayContainer}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {formatNumber(display)}
        </Text>
      </View>

      <View style={styles.keypad}>
        <View style={styles.memoryRow}>
          <MemoryButton label="mc" disabled={!hasMemory} onPress={memoryClear} />
          <MemoryButton
            label="mr"
            disabled={!hasMemory}
            onPress={memoryRecall}
            onLongPress={() => router.push('/profile')}
          />
          <MemoryButton label="m−" onPress={memorySubtract} />
          <MemoryButton label="m+" onPress={memoryAdd} />
        </View>

        <View style={styles.row}>
          <CalcButton
            label={isClearAll ? 'AC' : 'C'}
            variant="function"
            onPress={clearAll}
          />
          <CalcButton label="±" variant="function" onPress={toggleSign} />
          <CalcButton label="%" variant="function" onPress={applyPercent} />
          <CalcButton
            label="÷"
            variant="operator"
            active={pendingOperation === '÷'}
            onPress={() => chooseOperation('÷')}
          />
        </View>

        <View style={styles.row}>
          <CalcButton label="7" onPress={() => inputDigit('7')} />
          <CalcButton label="8" onPress={() => inputDigit('8')} />
          <CalcButton label="9" onPress={() => inputDigit('9')} />
          <CalcButton
            label="×"
            variant="operator"
            active={pendingOperation === '×'}
            onPress={() => chooseOperation('×')}
          />
        </View>

        <View style={styles.row}>
          <CalcButton label="4" onPress={() => inputDigit('4')} />
          <CalcButton label="5" onPress={() => inputDigit('5')} />
          <CalcButton label="6" onPress={() => inputDigit('6')} />
          <CalcButton
            label="-"
            variant="operator"
            active={pendingOperation === '-'}
            onPress={() => chooseOperation('-')}
          />
        </View>

        <View style={styles.row}>
          <CalcButton label="1" onPress={() => inputDigit('1')} />
          <CalcButton label="2" onPress={() => inputDigit('2')} />
          <CalcButton label="3" onPress={() => inputDigit('3')} />
          <CalcButton
            label="+"
            variant="operator"
            active={pendingOperation === '+'}
            onPress={() => chooseOperation('+')}
          />
        </View>

        <View style={styles.row}>
          <CalcButton label="0" wide onPress={() => inputDigit('0')} />
          <CalcButton
            label="."
            onPress={() => inputDigit('.')}
            onLongPress={() => router.push('/incidents')}
          />
          <CalcButton label="=" variant="operator" onPress={evaluate} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function CalcButton({
  label,
  onPress,
  onLongPress,
  variant = 'digit',
  wide = false,
  active = false,
}: {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'digit' | 'function' | 'operator';
  wide?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.button,
        wide && styles.buttonWide,
        variant === 'function' && styles.buttonFunction,
        variant === 'operator' && styles.buttonOperator,
        active && styles.buttonOperatorActive,
        pressed && styles.buttonPressed,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'function' && styles.buttonFunctionText,
          active && styles.buttonOperatorActiveText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MemoryButton({
  label,
  onPress,
  onLongPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={styles.memoryButton}
      onPress={disabled ? undefined : onPress}
      onLongPress={onLongPress}
      hitSlop={8}>
      <Text style={[styles.memoryButtonText, disabled && styles.memoryButtonTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'flex-end',
  },
  displayContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'flex-end',
  },
  displayText: {
    color: '#fff',
    fontSize: 80,
    fontWeight: '300',
  },
  keypad: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  memoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  memoryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  memoryButtonText: {
    color: '#a5a5a5',
    fontSize: 15,
    fontWeight: '500',
  },
  memoryButtonTextDisabled: {
    opacity: 0.4,
  },
  button: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWide: {
    flex: 2,
    aspectRatio: undefined,
    borderRadius: 999,
    alignItems: 'flex-start',
    paddingLeft: 32,
  },
  buttonFunction: {
    backgroundColor: '#a5a5a5',
  },
  buttonOperator: {
    backgroundColor: '#ff9f0a',
  },
  buttonOperatorActive: {
    backgroundColor: '#fff',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '500',
  },
  buttonFunctionText: {
    color: '#000',
  },
  buttonOperatorActiveText: {
    color: '#ff9f0a',
  },
});
