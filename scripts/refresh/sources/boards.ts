// Node dispatcher for every supported employer ATS board.
import type { BoardRef } from '../../../shared/types';
import { fetchBoard as sharedFetchBoard } from '../../../shared/ats';
import { getJson } from '../http';

export const fetchBoard = (b: BoardRef) => sharedFetchBoard(b, getJson);
