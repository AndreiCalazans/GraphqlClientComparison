import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDataLayer } from '../data/registry';
import { validateCredentials } from '../data/mockAuth';

export function SignInScreen({ onDone }: { onDone: () => void }) {
  const layer = useDataLayer();
  const auth = layer.useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    if (!validateCredentials(email, password)) return;
    auth.signIn(email, password);
    onDone();
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]} testID="signin-screen">
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Access your balance and watchlist.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#8a94a6"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID="input-email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#8a94a6"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        testID="input-password"
      />

      <Pressable style={styles.btn} onPress={submit} testID="btn-submit-signin">
        <Text style={styles.btnText}>Sign in</Text>
      </Pressable>

      <Pressable onPress={onDone} testID="btn-cancel-signin">
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#0b0e14', marginTop: 8 },
  subtitle: { fontSize: 15, color: '#8a94a6', marginTop: 6, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e6ee',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0b0e14',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#0052FF',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { color: '#8a94a6', textAlign: 'center', marginTop: 16, fontSize: 15 },
});
