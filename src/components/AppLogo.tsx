import React from 'react';
import { SvgProps } from 'react-native-svg';
// You might need to adjust the import path based on how you handle SVG files (e.g., using a transformer)
// If you have svgr or a similar tool configured, it might be:
// import LogoSvg from '../assets/logo.svg'; 
// For now, let's assume a simple component structure if direct import isn't set up for SVGs as components yet.
// This is a placeholder. Actual SVG rendering will depend on your project's SVG handling setup.

// Placeholder: If you have react-native-svg-transformer, you can do:
// import LogoSvg from '../assets/logo.svg';
// const AppLogo: React.FC<SvgProps> = (props) => <LogoSvg {...props} />;

// Fallback if direct SVG component import is not set up:
// You would typically use an Image component for raster images or a WebView for SVGs if not transformed.
// Or, more ideally, ensure your Metro bundler is configured with react-native-svg-transformer.
// For this example, we'll assume you will configure the transformer.
// If not, you'd need to load the SVG content and use SvgXml from react-native-svg.

// Assuming react-native-svg-transformer is or will be configured:
import LogoSvg from '../assets/logo.svg';

const AppLogo: React.FC<SvgProps & { color?: string }> = ({ color, ...props }) => {
    // If your SVG is designed to inherit color, you can pass it down.
    // For the provided SVG, fill is hardcoded, but this is a common pattern.
    return <LogoSvg {...props} fill={color || props.fill || '#007AFF'} />;
};

export default AppLogo;
