import { useSetupShortcuts } from './components/useShortcut';

export default function AppSetup() {
  // I'm pretty sure you don't need export but there's the lint rule
  // react-refresh/only-export-components since fast refresh only works when
  // a file has exports (though this probably won't be edited?)

  // note above is when this used to be in main.tsx, moved out of main.tsx
  // so createRoot wouldn't be called multiple times whenever useShortcuts
  // changes
  useSetupShortcuts();
  return <></>;
}
