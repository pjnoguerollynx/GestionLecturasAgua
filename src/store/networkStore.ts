import { create } from 'zustand';

interface NetworkState {
  isConnected: boolean | null; // null initially, then boolean
  isInternetReachable: boolean | null; // null initially, then boolean
  setNetworkStatus: (status: { isConnected: boolean; isInternetReachable: boolean }) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: null,
  isInternetReachable: null,
  setNetworkStatus: (status) => set({ 
    isConnected: status.isConnected, 
    isInternetReachable: status.isInternetReachable 
  }),
}));
