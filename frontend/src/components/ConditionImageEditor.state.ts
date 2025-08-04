/**
 * A separate file so HMR doesn't break.
 *
 * https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#consistent-components-exports
 */

import { atom } from 'nanostores';
import { Routine_Condition_Image } from 'acine-proto-dist';
export const $condition = atom<null | Routine_Condition_Image>(null);
