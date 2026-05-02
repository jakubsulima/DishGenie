/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_API_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Identity Services
interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string; select_by: string }) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      logo_alignment?: string;
      width?: number;
    }
  ) => void;
  prompt: () => void;
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId;
    };
  };
  __RECIPE_AI_RUNTIME_CONFIG__?: {
    googleClientId?: string;
  };
}
