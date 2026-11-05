export interface User {
  id: number;
  username: string;
  firstnames: string;
  surname: string;
  email: string;
  cellno: string;
  validfrom: string;
  validto: string;
}

export interface UserFields extends Omit<User, "id"> {}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NoteFields {
  title: string;
  content: string;
}
