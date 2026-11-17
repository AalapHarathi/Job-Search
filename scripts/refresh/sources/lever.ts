// Thin Node wrapper around the shared Lever connector (shared/ats.ts).
import type { BoardRef } from '../../../shared/types';
import { leverBoard } from '../../../shared/ats';
import { getJson } from '../http';

export const fetchLever = (b: BoardRef) => leverBoard(b, getJson);
