import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { API_KEY, CONTACTS_ENDPOINT } from '@/constants/backend';

// Onboarding re-runs every app launch (see app/_layout.tsx), but the PIN
// itself is persisted here so a restart doesn't invalidate a PIN the user
// already has memorized and may still enter on the calculator.
const PIN_STORAGE_KEY = 'silentwitness-pin';

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

function createContactId() {
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// How long to wait after the last edit before syncing contacts to the
// backend, so typing a name/phone number doesn't fire a request per keystroke.
const CONTACTS_SYNC_DEBOUNCE_MS = 1000;

type ProfileContextValue = {
  name: string;
  setName: (name: string) => void;
  pin: string;
  setPin: (pin: string) => void;
  contacts: EmergencyContact[];
  addContact: () => void;
  updateContact: (id: string, updates: Partial<Omit<EmergencyContact, 'id'>>) => void;
  removeContact: (id: string) => void;
};

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [pin, setPinState] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: createContactId(), name: '', phone: '' },
  ]);

  // Load the last-persisted PIN on launch so it still matches on the
  // calculator even though onboarding (and its in-memory PIN entry) reruns.
  useEffect(() => {
    SecureStore.getItemAsync(PIN_STORAGE_KEY).then((stored) => {
      if (stored) setPinState(stored);
    });
  }, []);

  const setPin = (newPin: string) => {
    setPinState(newPin);
    SecureStore.setItemAsync(PIN_STORAGE_KEY, newPin).catch((err) =>
      console.warn('[SilentWitness] Failed to persist PIN:', err)
    );
  };

  const addContact = () => {
    setContacts((current) => [...current, { id: createContactId(), name: '', phone: '' }]);
  };

  const updateContact = (id: string, updates: Partial<Omit<EmergencyContact, 'id'>>) => {
    setContacts((current) =>
      current.map((contact) => (contact.id === id ? { ...contact, ...updates } : contact))
    );
  };

  const removeContact = (id: string) => {
    setContacts((current) => current.filter((contact) => contact.id !== id));
  };

  // Push the full contact list to the backend whenever it settles, so the
  // server has someone to alert (push/SMS) when an incident is logged.
  useEffect(() => {
    const complete = contacts.filter((c) => c.name.trim() && c.phone.trim());

    const timeout = setTimeout(() => {
      fetch(CONTACTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
        body: JSON.stringify({
          contacts: complete.map((c) => ({ name: c.name, phone_number: c.phone })),
        }),
      }).catch((err) => console.warn('[SilentWitness] Failed to sync contacts:', err));
    }, CONTACTS_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [contacts]);

  return (
    <ProfileContext.Provider
      value={{ name, setName, pin, setPin, contacts, addContact, updateContact, removeContact }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
