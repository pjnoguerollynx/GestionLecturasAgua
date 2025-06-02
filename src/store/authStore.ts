import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Or your preferred storage
import { User } from '../types/user'; // Import the User type

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  user: User | null; // Use the User type
  isLoading: boolean;
  login: (tokens: { accessToken: string; refreshToken: string }, userData: User) => void; // Use the User type
  logout: () => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      user: null,
      isLoading: true, // Start with loading true to check for persisted session

      login: (tokens, userData) => {
        // Storing tokens in Keychain should happen in the auth service
        // Here we just update the state
        set({ 
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: userData,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        // Clearing tokens from Keychain should happen in the auth service
        set({ 
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setTokens: (tokens) => {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: !!tokens.accessToken, // Consider authenticated if accessToken exists
        });
      },

      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage', // unique name
      storage: createJSONStorage(() => AsyncStorage), // (optional) by default, 'localStorage' is used
      // Only persist a subset of the state if needed, e.g., not isLoading
      // partialize: (state) => ({ accessToken: state.accessToken, refreshToken: state.refreshToken, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Call this on app startup to check persisted state
// We set isLoading to false once we've checked.
// If accessToken exists in persisted state, Zustand will rehydrate isAuthenticated to true.
// useAuthStore.getState().setIsLoading(false); // This line is now commented out or removed
