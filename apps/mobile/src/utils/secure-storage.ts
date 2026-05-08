import * as SecureStore from 'expo-secure-store';

const memoryFallback = new Map<string, string>();

async function canUseSecureStore() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (await canUseSecureStore()) {
    return SecureStore.getItemAsync(key);
  }

  return memoryFallback.get(key) ?? null;
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  memoryFallback.set(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  memoryFallback.delete(key);
}

