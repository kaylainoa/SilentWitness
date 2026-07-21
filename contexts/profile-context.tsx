import { createContext, ReactNode, useContext, useState } from 'react';

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

function createContactId() {
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [pin, setPin] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: createContactId(), name: '', phone: '' },
  ]);

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
