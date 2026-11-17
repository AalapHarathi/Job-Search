// Thin Node wrapper around the shared Greenhouse connector (shared/ats.ts).
import type { BoardRef } from '../../../shared/types';
import { greenhouseBoard } from '../../../shared/ats';
import { getJson } from '../http';

export const fetchGreenhouse = (b: BoardRef) => greenhouseBoard(b, getJson);
