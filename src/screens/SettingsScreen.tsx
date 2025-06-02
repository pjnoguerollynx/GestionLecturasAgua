import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Appbar,
  List,
  Switch,
  Divider,
  Text,
  useTheme as usePaperTheme,
  Button,
  Card,
  SegmentedButtons,
} from 'react-native-paper';
import { useTheme as useAppTheme } from '../theme/ThemeContext'; // Alias to avoid conflict
import { DefaultAppTheme, DarkAppTheme } from '../theme/theme';
import i18n from '../i18n/i18n.config'; // Corrected import path

const SettingsScreen = () => {
  const { t } = useTranslation();
  const paperTheme = usePaperTheme();
  const { theme: appTheme, updateTheme } = useAppTheme();
  const navigation = useNavigation();

  const [isDarkModeEnabled, setIsDarkModeEnabled] = useState(appTheme.name === 'dark');
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  useEffect(() => {
    setIsDarkModeEnabled(appTheme.name === 'dark');
  }, [appTheme.name]);

  const toggleThemeSwitch = () => {
    const newThemeName = isDarkModeEnabled ? 'default' : 'dark';
    if (newThemeName === 'dark') {
      updateTheme(DarkAppTheme);
    } else {
      updateTheme(DefaultAppTheme);
    }
    // The useEffect will update isDarkModeEnabled based on appTheme.name change
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    setCurrentLanguage(value);
  };

  const languageOptions = [
    { value: 'en', label: t('settingsScreen.english') },
    { value: 'es', label: t('settingsScreen.spanish') },
    // Add more languages here if needed
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header
        style={{ backgroundColor: paperTheme.colors.surface }} // Explicitly set Appbar background
      >
        {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.onSurface} />}
        <Appbar.Content title={t('settingsScreen.title')} titleStyle={{color: paperTheme.colors.onSurface}} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={[styles.card, { backgroundColor: paperTheme.colors.surfaceVariant }]}>
          <Card.Content>
            <List.Section title={t('settingsScreen.displaySettings')} titleStyle={{color: paperTheme.colors.onSurfaceVariant}}>
              <List.Item
                title={t('settingsScreen.darkMode')}
                titleStyle={{color: paperTheme.colors.onSurface}}
                left={() => <List.Icon icon="theme-light-dark" color={paperTheme.colors.primary} />}
                right={() => (
                  <Switch
                    value={isDarkModeEnabled}
                    onValueChange={toggleThemeSwitch}
                    color={paperTheme.colors.primary}
                    accessibilityLabel={t('settingsScreen.darkModeToggle')}
                  />
                )}
              />
            </List.Section>
            <Divider style={{backgroundColor: paperTheme.colors.outlineVariant}}/>
            <List.Section title={t('settingsScreen.languageSettings')} titleStyle={{color: paperTheme.colors.onSurfaceVariant}}>
              <View style={styles.languageSelectorContainer}>
                <SegmentedButtons
                  value={currentLanguage}
                  onValueChange={handleLanguageChange}
                  buttons={languageOptions}
                  style={styles.segmentedButtons}
                  density="medium"
                />
              </View>
            </List.Section>
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: paperTheme.colors.surfaceVariant }]}>
          <Card.Content>
            <List.Section title={t('settingsScreen.about')} titleStyle={{color: paperTheme.colors.onSurfaceVariant}}>
              <List.Item
                title={t('appName')}
                description={`${t('settingsScreen.version')} 1.0.0`}
                titleStyle={{color: paperTheme.colors.onSurface}}
                descriptionStyle={{color: paperTheme.colors.onSurfaceVariant}}
                left={() => <List.Icon icon="information-outline" color={paperTheme.colors.primary} />}
              />
            </List.Section>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 8,
    paddingBottom: 24, // Add some padding at the bottom if the button is removed
  },
  card: {
    marginHorizontal: 8,
    marginVertical: 6,
  },
  languageSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center', // Center SegmentedButtons
  },
  segmentedButtons: {
    // width: '100%', // Take full width if desired, or let it size by content
  },
  button: {
    marginHorizontal: 16,
    marginVertical: 24,
  },
});

export default SettingsScreen;
