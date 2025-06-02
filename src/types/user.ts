export interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  // Add other relevant user properties here
  // For example:
  // roles?: string[];
  // permissions?: string[];
  profileImageUrl?: string;
}
