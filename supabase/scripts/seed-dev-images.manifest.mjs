/**
 * Photo paths for supabase/seed.sql service_requests.
 * Keep in sync with the UPDATE block in seed.sql (section 11b).
 *
 * Path format matches request-quote upload: {clientId}/{timestamp}_{index}.jpg
 */

/** @type {Array<{ path: string; slot: number; seed: number }>} */
export const SEED_DEV_IMAGES = [
  // 7017e457 — pgTAP fixture + open SR
  {
    path: "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_0.jpg",
    slot: 1,
    seed: 0,
  },
  {
    path: "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_1.jpg",
    slot: 1,
    seed: 1,
  },
  // 8017e001 — proposal rejected
  {
    path: "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000101_0.jpg",
    slot: 2,
    seed: 2,
  },
  {
    path: "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000101_1.jpg",
    slot: 2,
    seed: 3,
  },
  // 8017e002 — proposal accepted
  {
    path: "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_0.jpg",
    slot: 3,
    seed: 4,
  },
  {
    path: "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_1.jpg",
    slot: 3,
    seed: 5,
  },
  {
    path: "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_2.jpg",
    slot: 3,
    seed: 6,
  },
  // 8017e003 — proposal pending
  {
    path: "48e30f1d-3c47-441f-94c6-76b6ea0db472/1719000301_0.jpg",
    slot: 8,
    seed: 7,
  },
  // 8017e004 — revision requested
  {
    path: "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000401_0.jpg",
    slot: 3,
    seed: 8,
  },
  {
    path: "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000401_1.jpg",
    slot: 3,
    seed: 9,
  },
  // 8017e005 — revised proposal
  {
    path: "68e30f1d-3c47-441f-94c6-76b6ea0db474/1719000501_0.jpg",
    slot: 1,
    seed: 10,
  },
  {
    path: "68e30f1d-3c47-441f-94c6-76b6ea0db474/1719000501_1.jpg",
    slot: 1,
    seed: 11,
  },
  // 8017e006 — discovery chat
  {
    path: "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000601_0.jpg",
    slot: 3,
    seed: 12,
  },
  // 8017e007 — discovery chat
  {
    path: "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000701_0.jpg",
    slot: 1,
    seed: 13,
  },
  {
    path: "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000701_1.jpg",
    slot: 1,
    seed: 14,
  },
  // 8017e009 — discovery chat (commercial electrical)
  {
    path: "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000901_0.jpg",
    slot: 5,
    seed: 15,
  },
  {
    path: "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000901_1.jpg",
    slot: 5,
    seed: 16,
  },
  // 8017e014 — open SR
  {
    path: "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719001401_0.jpg",
    slot: 3,
    seed: 17,
  },
  {
    path: "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719001401_1.jpg",
    slot: 3,
    seed: 18,
  },
];

/** service_request.id -> storage paths (for seed.sql section 11b) */
export const SEED_SERVICE_REQUEST_PHOTOS = {
  "7017e457-5a32-44e7-b8da-1727a14f4d33": [
    "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_0.jpg",
    "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_1.jpg",
  ],
  "8017e001-5a32-44e7-b8da-1727a14f4d01": [
    "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000101_0.jpg",
    "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000101_1.jpg",
  ],
  "8017e002-5a32-44e7-b8da-1727a14f4d02": [
    "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_0.jpg",
    "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_1.jpg",
    "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_2.jpg",
  ],
  "8017e003-5a32-44e7-b8da-1727a14f4d03": [
    "48e30f1d-3c47-441f-94c6-76b6ea0db472/1719000301_0.jpg",
  ],
  "8017e004-5a32-44e7-b8da-1727a14f4d04": [
    "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000401_0.jpg",
    "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000401_1.jpg",
  ],
  "8017e005-5a32-44e7-b8da-1727a14f4d05": [
    "68e30f1d-3c47-441f-94c6-76b6ea0db474/1719000501_0.jpg",
    "68e30f1d-3c47-441f-94c6-76b6ea0db474/1719000501_1.jpg",
  ],
  "8017e006-5a32-44e7-b8da-1727a14f4d06": [
    "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000601_0.jpg",
  ],
  "8017e007-5a32-44e7-b8da-1727a14f4d07": [
    "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000701_0.jpg",
    "38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000701_1.jpg",
  ],
  "8017e009-5a32-44e7-b8da-1727a14f4d09": [
    "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000901_0.jpg",
    "58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000901_1.jpg",
  ],
  "8017e014-5a32-44e7-b8da-1727a14f4d14": [
    "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719001401_0.jpg",
    "28e30f1d-3c47-441f-94c6-76b6ea0db470/1719001401_1.jpg",
  ],
};
