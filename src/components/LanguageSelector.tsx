import React from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import i18n from '../i18n/i18n.config'; // Import i18n instance

const LanguageSelector: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'ca', label: 'Català' },
    { code: 'eu', label: 'Euskara' },
    { code: 'gl', label: 'Galego' },
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{t('languageSelector.select')}:</Text>
      <View style={styles.buttonsContainer}>
        {languages.map((lang) => (
          <View key={lang.code} style={styles.buttonWrapper}>
            <Button
              title={lang.label}
              onPress={() => changeLanguage(lang.code)}
              color={i18n.language === lang.code ? theme.colors.primary : theme.colors.card}
              // Accessibility: Indicate current language
              accessibilityState={{ selected: i18n.language === lang.code }}
              accessibilityLabel={t('languageSelector.changeTo', { lang: lang.label })}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  buttonWrapper: {
    margin: 4,
  },
});

export default LanguageSelector;
