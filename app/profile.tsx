import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/contexts/profile-context';

export default function ProfileScreen() {
  const { name, setName, pin, setPin, contacts, addContact, updateContact, removeContact } =
    useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isPinRevealed, setIsPinRevealed] = useState(false);

  const maskedPin = '•'.repeat(Math.max(pin.length, 4));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable onPress={() => setIsEditing((editing) => !editing)} hitSlop={8}>
          <Text style={styles.editText}>{isEditing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#666"
              autoCapitalize="words"
              autoCorrect={false}
            />
          ) : (
            <Text style={styles.rowValue}>{name || 'Not set'}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          {contacts.map((contact, index) => (
            <View key={contact.id} style={styles.contact}>
              <View style={styles.contactHeader}>
                <View style={styles.contactBadge}>
                  <Text style={styles.contactBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.contactLabel}>Contact {index + 1}</Text>
                {isEditing && contacts.length > 1 && (
                  <Pressable
                    onPress={() => removeContact(contact.id)}
                    hitSlop={8}
                    style={styles.removeButton}>
                    <Text style={styles.removeButtonText}>✕</Text>
                  </Pressable>
                )}
              </View>
              {isEditing ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={contact.name}
                    onChangeText={(value) => updateContact(contact.id, { name: value })}
                    placeholder="Contact name"
                    placeholderTextColor="#666"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.input}
                    value={contact.phone}
                    onChangeText={(value) => updateContact(contact.id, { phone: value })}
                    placeholder="Phone number"
                    placeholderTextColor="#666"
                    keyboardType="phone-pad"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.rowValue}>{contact.name || 'Not set'}</Text>
                  <Text style={styles.rowSubvalue}>{contact.phone || 'Not set'}</Text>
                </>
              )}
            </View>
          ))}

          {isEditing && (
            <Pressable style={styles.addButton} onPress={addContact}>
              <Text style={styles.addButtonText}>+ Add Contact</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.pinHeader}>
            <Text style={styles.sectionTitle}>Secret PIN</Text>
            <Pressable onPress={() => setIsPinRevealed((revealed) => !revealed)} hitSlop={8}>
              <Text style={styles.revealText}>{isPinRevealed ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {isEditing && isPinRevealed ? (
            <TextInput
              style={[styles.input, styles.rowValueMono]}
              value={pin}
              onChangeText={(value) => setPin(value.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
          ) : (
            <Text style={[styles.rowValue, styles.rowValueMono]}>
              {isPinRevealed ? pin || 'Not set' : maskedPin}
            </Text>
          )}

          <Text style={styles.hint}>Enter this on the keypad any time to start a recording.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeText: {
    color: '#a5a5a5',
    fontSize: 17,
  },
  editText: {
    color: '#ff9f0a',
    fontSize: 17,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#a5a5a5',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubvalue: {
    color: '#a5a5a5',
    fontSize: 15,
  },
  rowValueMono: {
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  input: {
    color: '#fff',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingVertical: 8,
  },
  contact: {
    gap: 8,
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff9f0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  contactLabel: {
    flex: 1,
    color: '#a5a5a5',
    fontSize: 13,
    fontWeight: '600',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#a5a5a5',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#ff9f0a',
    fontSize: 15,
    fontWeight: '600',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  revealText: {
    color: '#ff9f0a',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
});
