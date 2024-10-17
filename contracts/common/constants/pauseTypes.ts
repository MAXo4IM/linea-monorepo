import {
  PAUSE_ALL_ROLE,
  PAUSE_COMPLETE_TOKEN_BRIDGING_ROLE,
  PAUSE_FINALIZATION_ROLE,
  PAUSE_INITIATE_TOKEN_BRIDGING_ROLE,
  PAUSE_L1_L2_ROLE,
  PAUSE_BLOB_SUBMISSION_ROLE,
  PAUSE_L2_L1_ROLE,
  UNPAUSE_ALL_ROLE,
  UNPAUSE_COMPLETE_TOKEN_BRIDGING_ROLE,
  UNPAUSE_FINALIZATION_ROLE,
  UNPAUSE_INITIATE_TOKEN_BRIDGING_ROLE,
  UNPAUSE_L1_L2_ROLE,
  UNPAUSE_BLOB_SUBMISSION_ROLE,
  UNPAUSE_L2_L1_ROLE,
} from "./roles";

export const GENERAL_PAUSE_TYPE = 1;
export const L1_L2_PAUSE_TYPE = 2;
export const L2_L1_PAUSE_TYPE = 3;
export const BLOB_SUBMISSION_PAUSE_TYPE = 4;
export const CALLDATA_SUBMISSION_PAUSE_TYPE = 5;
export const FINALIZATION_PAUSE_TYPE = 6;
export const INITIATE_TOKEN_BRIDGING_PAUSE_TYPE = 7;
export const COMPLETE_TOKEN_BRIDGING_PAUSE_TYPE = 8;

export const BASE_PAUSE_TYPES_ROLES = [{ pauseType: GENERAL_PAUSE_TYPE, role: PAUSE_ALL_ROLE }];
export const BASE_UNPAUSE_TYPES_ROLES = [{ pauseType: GENERAL_PAUSE_TYPE, role: UNPAUSE_ALL_ROLE }];

// LineaRollup
export const LINEA_ROLLUP_PAUSE_TYPES_ROLES = [
  ...BASE_PAUSE_TYPES_ROLES,
  { pauseType: L1_L2_PAUSE_TYPE, role: PAUSE_L1_L2_ROLE },
  { pauseType: L2_L1_PAUSE_TYPE, role: PAUSE_L2_L1_ROLE },
  { pauseType: BLOB_SUBMISSION_PAUSE_TYPE, role: PAUSE_BLOB_SUBMISSION_ROLE },
  { pauseType: CALLDATA_SUBMISSION_PAUSE_TYPE, role: PAUSE_BLOB_SUBMISSION_ROLE },
  { pauseType: FINALIZATION_PAUSE_TYPE, role: PAUSE_FINALIZATION_ROLE },
];

export const LINEA_ROLLUP_UNPAUSE_TYPES_ROLES = [
  ...BASE_UNPAUSE_TYPES_ROLES,
  { pauseType: L1_L2_PAUSE_TYPE, role: UNPAUSE_L1_L2_ROLE },
  { pauseType: L2_L1_PAUSE_TYPE, role: UNPAUSE_L2_L1_ROLE },
  { pauseType: BLOB_SUBMISSION_PAUSE_TYPE, role: UNPAUSE_BLOB_SUBMISSION_ROLE },
  { pauseType: CALLDATA_SUBMISSION_PAUSE_TYPE, role: UNPAUSE_BLOB_SUBMISSION_ROLE },
  { pauseType: FINALIZATION_PAUSE_TYPE, role: UNPAUSE_FINALIZATION_ROLE },
];

// L2MessageService
export const L2_MESSAGE_SERVICE_PAUSE_TYPES_ROLES = [
  ...BASE_PAUSE_TYPES_ROLES,
  { pauseType: L1_L2_PAUSE_TYPE, role: PAUSE_L1_L2_ROLE },
  { pauseType: L2_L1_PAUSE_TYPE, role: PAUSE_L2_L1_ROLE },
];

export const L2_MESSAGE_SERVICE_UNPAUSE_TYPES_ROLES = [
  ...BASE_UNPAUSE_TYPES_ROLES,
  { pauseType: L1_L2_PAUSE_TYPE, role: UNPAUSE_L1_L2_ROLE },
  { pauseType: L2_L1_PAUSE_TYPE, role: UNPAUSE_L2_L1_ROLE },
];

// TokenBridge
export const TOKEN_BRIDGE_PAUSE_TYPES_ROLES = [
  ...BASE_PAUSE_TYPES_ROLES,
  { pauseType: INITIATE_TOKEN_BRIDGING_PAUSE_TYPE, role: PAUSE_INITIATE_TOKEN_BRIDGING_ROLE },
  { pauseType: COMPLETE_TOKEN_BRIDGING_PAUSE_TYPE, role: PAUSE_COMPLETE_TOKEN_BRIDGING_ROLE },
];

export const TOKEN_BRIDGE_UNPAUSE_TYPES_ROLES = [
  ...BASE_UNPAUSE_TYPES_ROLES,
  { pauseType: INITIATE_TOKEN_BRIDGING_PAUSE_TYPE, role: UNPAUSE_INITIATE_TOKEN_BRIDGING_ROLE },
  { pauseType: COMPLETE_TOKEN_BRIDGING_PAUSE_TYPE, role: UNPAUSE_COMPLETE_TOKEN_BRIDGING_ROLE },
];