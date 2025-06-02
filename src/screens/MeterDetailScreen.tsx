import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Appbar, Card, Text, useTheme } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type MeterDetailScreenRouteProp = RouteProp<RootStackParamList, 'MeterDetail'>;
type MeterDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MeterDetail'>;

const MeterDetailScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<MeterDetailScreenNavigationProp>();
  const route = useRoute<MeterDetailScreenRouteProp>();

  const { meterId, serialNumber } = route.params;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header statusBarHeight={0}>
        {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.colors.onSurface} />}
        <Appbar.Content title={t('meterDetailScreen.title')} titleStyle={{color: theme.colors.onSurface}} />
      </Appbar.Header>
      <Card style={styles.card}>
        <Card.Title title={t('meterDetailScreen.meterInfo')} />
        <Card.Content>
          <Text variant="bodyLarge">{`${t('metersScreen.serialNumber')}: ${serialNumber}`}</Text>
          <Text variant="bodyMedium">{`${t('meterDetailScreen.meterIdLabel')}: ${meterId}`}</Text>
          {/* TODO: Fetch and display more meter details using meterId */}
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
});

export default MeterDetailScreen;
