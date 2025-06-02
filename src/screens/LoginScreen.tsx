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
  const LogoComponent = theme.LogoComponent; // Get LogoComponent from theme

  const [username, setUsername] = useState('testuser'); // Default for testing
  const [password, setPassword] = useState('password123'); // Default for testing

  const handleLogin = async () => {
    try {
      const user = await AuthService.login(username, password);
      if (user) {
        // Navigation to Home will be handled by the conditional navigator
        // based on isAuthenticated state, so no explicit navigation.navigate('Home') here.
        console.log('Login successful, user:', user);
      } else {
        Alert.alert(t('login.errorTitle'), t('login.errorMessage'));
      }
    } catch (error: any) {
      console.error('Login screen error:', error);
      Alert.alert(t('login.errorTitle'), error.message ?? t('login.errorMessage'));
    }
  };

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
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('login.loading')} />
      ) : (
        <View style={styles.buttonContainer}>
            <Button 
                title={t('login.loginButton')} 
                onPress={handleLogin} 
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
