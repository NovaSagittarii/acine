import { atom } from 'nanostores';
import { Routine_Edge } from 'acine-proto-dist';

/** last interacted edge */
export const $currentEdge = atom<null | Routine_Edge>(null);
