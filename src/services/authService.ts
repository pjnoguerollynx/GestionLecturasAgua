import * as Keychain from 'react-native-keychain';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import { User } from '../types/user'; // Import User type

// --- MOCK FLAGS ---
const MOCK_AUTH_FLOW = true; // Global switch for mocking authentication flow
// --- END MOCK FLAGS ---

// Restore LoginResponse interface
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Define your API base URL
const API_BASE_URL = 'https://gila-api.example.com/api/v1/auth'; // Updated API Base URL for auth

const KEYCHAIN_SERVICE_NAME = 'com.gestionlecturasagua.auth';

// Actual API call for login
const apiLogin = async (username: string, password: string): Promise<LoginResponse> => {
  if (MOCK_AUTH_FLOW) {
    console.log('AUTH_SERVICE: MOCK apiLogin for:', username);
    return new Promise(resolve => setTimeout(() => resolve({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: { id: 'mock-user-id', username: username, name: 'Mock User', email: `${username}@example.com` }
    }), 500));
  }
  console.log('Attempting real login for:', username);
  // Replace mock with actual API call
  const response = await axios.post<LoginResponse>(`${API_BASE_URL}/login`, {
    username,
    password,
  });
  return response.data;
};

// Actual API call to refresh token
const apiRefreshToken = async (refreshTokenValue: string): Promise<{ accessToken: string; refreshToken: string }> => {
  if (MOCK_AUTH_FLOW) {
    console.log('AUTH_SERVICE: MOCK apiRefreshToken');
    return new Promise(resolve => setTimeout(() => resolve({
      accessToken: 'mock-new-access-token',
      refreshToken: 'mock-new-refresh-token',
    }), 500));
  }
  console.log('Attempting real token refresh with token:', refreshTokenValue);
  // Replace mock with actual API call
  const response = await axios.post<{ accessToken: string; refreshToken: string }>(`${API_BASE_URL}/refresh`, {
    refreshToken: refreshTokenValue,
  });
  return response.data;
};

// Actual function to get user profile (me endpoint)
const fetchUserProfile = async (): Promise<User | null> => {
  console.log('AUTH_SERVICE: fetchUserProfile - Attempting to fetch real user profile...');
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    console.log('AUTH_SERVICE: fetchUserProfile - No access token available.');
    return null;
  }

  if (MOCK_AUTH_FLOW) {
    console.log('AUTH_SERVICE: MOCK fetchUserProfile');
    const currentUser = useAuthStore.getState().user; // Try to use existing user from store if available
    return new Promise(resolve => setTimeout(() => resolve(
      currentUser || { id: 'mock-user-id-from-profile', username: 'mockedUser', name: 'Mocked User Profile', email: 'mocked@example.com' }
    ), 500));
  }
  try {
    console.log('AUTH_SERVICE: fetchUserProfile - Calling API /me endpoint...');
    const response = await axios.get<User>(`${API_BASE_URL}/me`);
    console.log('AUTH_SERVICE: fetchUserProfile - API /me call successful. Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('AUTH_SERVICE: fetchUserProfile - Failed to fetch user profile:', error);
    return null;
  }
};

// Store interceptor IDs globally in this module to manage them
let requestInterceptorId: number | null = null;
let responseInterceptorId: number | null = null;

export const AuthService = {
  login: async (username: string, password: string): Promise<User | null> => {
    useAuthStore.getState().setIsLoading(true);
    try {
      const response = await apiLogin(username, password);
      
      await Keychain.setGenericPassword(
        response.accessToken,
        response.refreshToken,
        { service: KEYCHAIN_SERVICE_NAME }
      );
      
      useAuthStore.getState().login({ accessToken: response.accessToken, refreshToken: response.refreshToken }, response.user);
      AuthService.setupAxiosInterceptors(); 
      return response.user;
    } catch (error) {
      console.error('Login failed:', error);
      useAuthStore.getState().logout();
      if (error instanceof Error) throw error;
      throw new Error(String(error));
    } finally {
      useAuthStore.getState().setIsLoading(false);
    }
  },

  logout: async (): Promise<void> => {
    useAuthStore.getState().setIsLoading(true);
    const token = useAuthStore.getState().refreshToken; // Get refresh token for server logout
    try {
      if (token) {
        // Call the backend logout endpoint if it exists and requires a token
        await axios.post(`${API_BASE_URL}/logout`, { refreshToken: token });
        console.log('Successfully called server logout endpoint.');
      }
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE_NAME });
      useAuthStore.getState().logout();
      delete axios.defaults.headers.common['Authorization'];
      // Eject interceptors on logout
      if (requestInterceptorId !== null) {
        axios.interceptors.request.eject(requestInterceptorId);
        requestInterceptorId = null;
      }
      if (responseInterceptorId !== null) {
        axios.interceptors.response.eject(responseInterceptorId);
        responseInterceptorId = null;
      }
    } catch (error) {
      console.error('Logout failed:', error);
      useAuthStore.getState().logout(); 
    } finally {
      useAuthStore.getState().setIsLoading(false);
    }
  },

  loadSession: async (): Promise<User | null> => {
    console.log('AUTH_SERVICE: Attempting to load session...');
    useAuthStore.getState().setIsLoading(true);
    try {
      let credentials;
      if (MOCK_AUTH_FLOW) {
        console.log('AUTH_SERVICE: MOCK loadSession - Simulating Keychain credentials found.');
        credentials = { username: 'mock-access-token-from-keychain', password: 'mock-refresh-token-from-keychain' };
      } else {
        console.log('AUTH_SERVICE: loadSession - Getting credentials from Keychain...');
        credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE_NAME });
      }
      console.log('AUTH_SERVICE: loadSession - Keychain.getGenericPassword (or mock) returned:', credentials ? 'Credentials found' : 'No credentials');

      if (credentials && credentials.username && credentials.password) {
        const accessToken = credentials.username;
        const refreshToken = credentials.password;
        
        console.log('AUTH_SERVICE: loadSession - Stored tokens found. AccessToken:', accessToken ? 'Exists' : 'Missing', 'RefreshToken:', refreshToken ? 'Exists' : 'Missing');
        useAuthStore.getState().setTokens({ accessToken, refreshToken });
        AuthService.setupAxiosInterceptors(); // Setup interceptors early

        console.log('AUTH_SERVICE: loadSession - Attempting to fetch user profile...');
        const user = await fetchUserProfile(); // This will use the MOCK version if MOCK_AUTH_FLOW is true
        console.log('AUTH_SERVICE: loadSession - fetchUserProfile returned:', user);

        if (user) {
          useAuthStore.getState().login({ accessToken, refreshToken }, user);
          console.log('AUTH_SERVICE: loadSession - Session loaded, user profile fetched.');
          return user;
        } else {
          console.log('AUTH_SERVICE: loadSession - Could not fetch user profile with stored token. Attempting to refresh token...');
          const newAccessToken = await AuthService.refreshToken(); // This will use the MOCK version
          console.log('AUTH_SERVICE: loadSession - AuthService.refreshToken returned:', newAccessToken);

          if (newAccessToken) {
            console.log('AUTH_SERVICE: loadSession - Token refreshed. Attempting to fetch user profile again...');
            const refreshedUser = await fetchUserProfile(); // MOCK version
            console.log('AUTH_SERVICE: loadSession - fetchUserProfile (after refresh) returned:', refreshedUser);
            if (refreshedUser) {
              const finalTokens = useAuthStore.getState();
              useAuthStore.getState().login({ accessToken: finalTokens.accessToken!, refreshToken: finalTokens.refreshToken! }, refreshedUser);
              console.log('AUTH_SERVICE: loadSession - Session loaded after token refresh, user profile fetched.');
              return refreshedUser;
            }
          }
          console.log('AUTH_SERVICE: loadSession - Failed to refresh token or fetch user after refresh. Logging out.');
          await AuthService.logout();
          return null;
        }
      } else {
        console.log('AUTH_SERVICE: loadSession - No credentials found in keychain. Logging out.');
        useAuthStore.getState().logout(); 
        return null;
      }
    } catch (error) {
      console.error('AUTH_SERVICE: loadSession - Failed to load session:', error);
      await AuthService.logout(); 
      return null;
    } finally {
      useAuthStore.getState().setIsLoading(false);
      console.log('AUTH_SERVICE: loadSession - loadSession finished. isLoading:', useAuthStore.getState().isLoading);
    }
  },

  refreshToken: async (): Promise<string | null> => {
    const currentRefreshToken = useAuthStore.getState().refreshToken;
    if (!currentRefreshToken) {
      // No need to call logout here as it might cause a loop if logout itself fails
      // or if this is called during a logout process.
      console.warn('refreshToken called but no current refresh token available.');
      useAuthStore.getState().logout(); // Ensure local state is cleared
      return null;
    }
    try {
      console.log('Attempting to refresh token...');
      const response = await apiRefreshToken(currentRefreshToken); // Pass the token value
      await Keychain.setGenericPassword(response.accessToken, response.refreshToken, { service: KEYCHAIN_SERVICE_NAME });
      useAuthStore.getState().setTokens(response);
      AuthService.setupAxiosInterceptors();
      console.log('Token refreshed successfully.');
      return response.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await AuthService.logout(); 
      return null;
    }
  },

  setupAxiosInterceptors: () => {
    // Eject existing interceptors before setting new ones
    if (requestInterceptorId !== null) {
      axios.interceptors.request.eject(requestInterceptorId);
    }
    if (responseInterceptorId !== null) {
      axios.interceptors.response.eject(responseInterceptorId);
    }

    requestInterceptorId = axios.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error instanceof Error ? error : new Error(String(error)))
    );

    responseInterceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          console.log('Received 401, attempting token refresh...');
          try {
            const newAccessToken = await AuthService.refreshToken();
            if (newAccessToken) {
              axios.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
              originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            console.error('Failed to refresh token during 401 handling:', refreshError);
            return Promise.reject(refreshError instanceof Error ? refreshError : new Error(String(refreshError)));
          }
        }
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
    console.log('Axios interceptors set up.');
  }
};
