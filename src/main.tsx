import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TrayProvider } from './contexts/TrayContext';
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { invoke } from "@tauri-apps/api/core";

(async () => {
  const menu = await Menu.new({
    items: [
      {
        id: 'show',
        text: 'Show GCT',
        action: () => {
          invoke('show_window');
        },
      },
      {
        id: 'quit',
        text: 'Quit',
        action: () => {
          invoke('close_app');
        },
      },
    ],
  });

  const options = {
    id: 'main',
    title: 'GCT',
    menu,
    menuOnLeftClick: true,
  };

  const tray = await TrayIcon.new(options);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <TrayProvider tray={tray}>
        <App />
      </TrayProvider>
    </React.StrictMode>,
  );
})();