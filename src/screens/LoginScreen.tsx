import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { AuthService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
  navigation: LoginScreenNavigationProp;
};

const LoginScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const LogoComponent = theme.LogoComponent;

  const [username, setUsername] = useState('testuser');
  const [password, setPassword] = useState('password123');

  console.log('LoginScreen: Component rendered. Current state:', {
    isLoading,
    isAuthenticated,
    username,
    password
  });

  // Force reset loading state on component mount if it's stuck
  React.useEffect(() => {
    console.log('LoginScreen: useEffect - Component mounted');
    if (isLoading && !isAuthenticated) {
      console.log('LoginScreen: useEffect - Detected stuck loading state, forcing reset');
      useAuthStore.getState().setIsLoading(false);
    }
  }, []); // Empty dependency array ensures this runs only on mount

  const handleLogin = async () => {
    // Add guard clause here
    if (useAuthStore.getState().isLoading) {
      console.log('LoginScreen: handleLogin - Login attempt aborted, already loading.');
      return;
    }
    console.log('LoginScreen: handleLogin called');
    
    try {
      console.log(`LoginScreen: About to call AuthService.login for user: ${username}`);
      const user = await AuthService.login(username, password);
      console.log('LoginScreen: AuthService.login completed. Returned user:', user);
      console.log('LoginScreen: Current auth state after login attempt:', {
        isAuthenticated: useAuthStore.getState().isAuthenticated,
        isLoading: useAuthStore.getState().isLoading,
        user: useAuthStore.getState().user
      });
      
      if (user) {
        console.log('LoginScreen: Login successful, user logged in:', user);
      } else {
        console.error('LoginScreen: Login failed - user is null');
        Alert.alert(t('login.errorTitle'), t('login.errorMessage'));
      }
    } catch (error: any) {
      console.error('LoginScreen: Login error caught:', error);
      Alert.alert(t('login.errorTitle'), error.message ?? t('login.errorMessage'));
    } finally {
      console.log('LoginScreen: Login finally block. Current isLoading:', useAuthStore.getState().isLoading);
      
      // Force isLoading to false as a failsafe
      if (useAuthStore.getState().isLoading) {
        console.log('LoginScreen: Forcing isLoading to false');
        useAuthStore.getState().setIsLoading(false);
      }
      
      console.log('LoginScreen: Final state after login attempt:', {
        isAuthenticated: useAuthStore.getState().isAuthenticated,
        isLoading: useAuthStore.getState().isLoading,
        user: useAuthStore.getState().user ? 'USER_EXISTS' : 'NO_USER'
      });
    }
  };

  // Add button press logging
  const onLoginButtonPress = () => {
    handleLogin();
  };

  console.log('LoginScreen: About to render. isLoading:', isLoading);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {LogoComponent && 
        <View style={styles.logoContainer}>
          <LogoComponent width={100} height={100} accessibilityRole="image" accessibilityLabel={t('login.logoAltText')} />
        </View>
      }
      <Text style={[styles.title, { color: theme.colors.text }]} accessibilityRole="header">{t('login.title')}</Text>
      
      <TextInput
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
        placeholder={t('login.usernamePlaceholder')}
        placeholderTextColor={theme.colors.text} 
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        accessibilityLabel={t('login.usernamePlaceholder')}
        accessibilityHint={t('login.usernameHint')} 
      />
      
      <TextInput
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
        placeholder={t('login.passwordPlaceholder')}
        placeholderTextColor={theme.colors.text}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        accessibilityLabel={t('login.passwordPlaceholder')}
        accessibilityHint={t('login.passwordHint')} 
      />
      
      {/* Debug info */}
      <Text style={{ color: theme.colors.text, fontSize: 12, marginBottom: 10 }}>
        Debug - Loading: {isLoading ? 'YES' : 'NO'}, Auth: {isAuthenticated ? 'YES' : 'NO'}
      </Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}> 
          <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('login.loading')} />
          <Text style={{ color: theme.colors.text, marginTop: 10 }}>{t('login.loadingText')}</Text> 
        </View>
      ) : (
        <View style={styles.buttonContainer}>
            <Button 
                title={t('login.loginButton')} 
                onPress={onLoginButtonPress}
                color={theme.colors.primary} 
            />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, // Increased padding
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  loadingContainer: { // ADDED for consistent layout during loading
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20, // Match button container or general padding
    width: '90%', // Match button container width
    marginTop: 10, // Match button container margin
  },
  title: {
    fontSize: 28, // Slightly larger title
    fontWeight: 'bold', // Bold title
    marginBottom: 28, // Increased margin
    textAlign: 'center',
  },
  label: {
    // Visually hidden label, useful for accessibilityLabelledBy if preferred
    // For this iteration, direct accessibilityLabel on TextInput is used.
    // If these were visible labels, they would need styling.
    // Example for visible labels:
    // width: '80%',
    // marginBottom: 5,
    // fontSize: 16,
    // color: theme.colors.text, // Needs theme access or pass as prop
  },
  input: {
    width: '90%', // Increased width
    height: 50, // Increased height for better touch target
    borderWidth: 1,
    paddingHorizontal: 15, // Increased padding
    marginBottom: 15, // Increased margin
    borderRadius: 8, // Softer corners
    fontSize: 16, // Larger font size
  },
  buttonContainer: {
    width: '90%', // Match input width
    marginTop: 10, // Add some space above the button
  },
});

export default LoginScreen;
