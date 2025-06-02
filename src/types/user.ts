export interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  language?: string; // e.g., 'es', 'en'
  // Add other relevant user properties here
  // For example:
  // roles?: string[];
  // permissions?: string[];
  profileImageUrl?: string;
}
