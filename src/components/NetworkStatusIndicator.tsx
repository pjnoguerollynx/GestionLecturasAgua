import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';

const LAST_CONNECTION_KEY = 'lastSuccessfulConnection';

const NetworkStatusIndicator: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastConnection, setLastConnection] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // Load last connection date from storage
    const loadLastConnection = async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_CONNECTION_KEY);
        setLastConnection(stored);
      } catch (error) {
        console.log('Error loading last connection date:', error);
      }
    };

    loadLastConnection();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable;
      setIsConnected(connected);
      
      // Save current time as last successful connection if online
      if (connected) {
        const currentTime = new Date().toISOString();
        setLastConnection(currentTime);
        AsyncStorage.setItem(LAST_CONNECTION_KEY, currentTime);
      }
    });

    return () => unsubscribe();
  }, []);

  const formatLastConnection = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Hace menos de 1 min';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours}h`;
      if (diffDays < 7) return `Hace ${diffDays} días`;
      
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Error en fecha';
    }
  };

  if (isConnected === null) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.text, { color: theme.colors.text }]}>
          Verificando conexión...
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: isConnected ? theme.colors.primary : '#DC3545' 
      }
    ]}>
      <View style={styles.content}>
        <Text style={[styles.statusText, { color: '#FFFFFF' }]}>
          {isConnected ? '🟢 ONLINE' : '🔴 OFFLINE'}
        </Text>
        {!isConnected && (
          <Text style={[styles.lastConnectionText, { color: '#FFFFFF' }]}>
            Última conexión: {formatLastConnection(lastConnection)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 50,
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  lastConnectionText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
});

export default NetworkStatusIndicator;
