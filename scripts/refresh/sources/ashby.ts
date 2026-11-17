// Thin Node wrapper around the shared Ashby connector (shared/ats.ts).
import type { BoardRef } from '../../../shared/types';
import { ashbyBoard } from '../../../shared/ats';
import { getJson } from '../http';

export const fetchAshby = (b: BoardRef) => ashbyBoard(b, getJson);
