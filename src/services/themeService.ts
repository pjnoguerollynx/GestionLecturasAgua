import { AppTheme, AppThemeColors } from '../theme/theme';
import { SvgXml } from 'react-native-svg';
import React from 'react';

// Define your API base URL - this might be the same as your auth service or different
const API_BASE_URL = 'https://gila-api.example.com/api/v1'; // Using the main API base URL

export interface ApiThemeResponse {
  colors?: Partial<AppThemeColors>;
  logoUrl?: string;
  logoSvg?: string; // SVG content as a string
}

const transformApiThemeToAppTheme = (apiTheme: ApiThemeResponse): Partial<AppTheme> => {
  const appThemeUpdate: Partial<AppTheme> = {};

  if (apiTheme.colors) {
    // Temporarily using 'as any' to bypass the type error.
    // This assumes that ThemeContext correctly merges partial color objects.
    appThemeUpdate.colors = apiTheme.colors as any;
  }

  if (apiTheme.logoUrl) {
    appThemeUpdate.logoUrl = apiTheme.logoUrl;
    // If logoUrl is provided, LogoComponent might be cleared or handled differently
    // For now, we prioritize logoUrl if both are somehow provided by API (which shouldn't happen)
    appThemeUpdate.LogoComponent = undefined; 
  }

  if (apiTheme.logoSvg) {
    const svgString = apiTheme.logoSvg;
    // Use React.createElement to avoid JSX syntax in a .ts file
    // Assuming SvgProps is the correct prop type for SvgXml if more specific typing is needed.
    const DynamicLogoComponent: React.FC<any> = (props) => 
      React.createElement(SvgXml, { ...props, xml: svgString });
    
    appThemeUpdate.LogoComponent = DynamicLogoComponent;
    appThemeUpdate.logoUrl = undefined; // Prioritize SVG component if SVG content is given
  }
  
  // Note: The API could also specify if the theme is dark or light
  // if (typeof apiTheme.dark === 'boolean') {
  //   appThemeUpdate.dark = apiTheme.dark;
  // }

  return appThemeUpdate; // Ensure the function returns the updates
};

export const ThemeService = {
  fetchRemoteThemeConfig: async (): Promise<Partial<AppTheme> | null> => {
    try {
      // Temporarily disable remote theme fetching
      console.log('ThemeService: Remote theme fetching is temporarily disabled.');
      return Promise.resolve(null); 

      // console.log('Fetching remote theme configuration...');
      // Actual API call
      // Assuming the theme endpoint is GET /theme or /settings/theme
      // The axios instance should already be configured with interceptors for auth by authService
      // const response = await axios.get<ApiThemeResponse>(`${API_BASE_URL}/theme`);
      
      // if (response.data) {
      //   return transformApiThemeToAppTheme(response.data);
      // } else {
      //   console.warn('No theme data received from API.');
      //   return null;
      // }

    } catch (error) {
      console.error('Failed to fetch remote theme configuration:', error);
      // Optionally, return default theme or null to indicate failure
      // Consider if specific error handling (e.g., for 401) is needed here or if interceptors cover it
      return null;
    }
  },
};
