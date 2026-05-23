// Metadata-only seed for the Hornady 6mm ARC Gas Gun data sheet.
// IMPORTANT: this file contains ONLY descriptive metadata (cartridge/rifle/
// bullet/case/primer identities, BCs, COL/case-length/MAP limits cited from
// the source). It DOES NOT include powder-charge tables. Charge/velocity
// rows are out of scope for any automated seed because they are
// safety-critical and protected by copyright; users must transcribe and
// verify those themselves on the review page.

export const HORNADY_6MM_ARC_GAS_GUN_SOURCE = {
  title: 'Hornady 6mm ARC Gas Gun data sheet',
  publisher: 'Hornady',
  edition: 'Manufacturer data sheet (Gas Gun)',
  citation:
    'Hornady 6mm ARC Gas Gun rifle data sheet, 5 pages. Max pressure 52,000 psi. Do not exceed listed max charges.',
  notes:
    'User-transcribed from manufacturer document. Verify every value against the original source before using as a citation on a Load.',
} as const;

export const HORNADY_6MM_ARC_CARTRIDGE_NAME = '6mm ARC (Gas Gun)';

export const HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE = {
  name: HORNADY_6MM_ARC_CARTRIDGE_NAME,
  bulletDiameterIn: 0.243,
  maxPressurePsi: 52000,
  notes: [
    'Source: Hornady 6mm ARC Gas Gun data sheet.',
    'Max COL 2.260". Max case length 1.490". Trim length 1.475".',
    'Intended for gas guns / AR-15. Do not exceed listed max charges.',
  ].join(' '),
} as const;

export const HORNADY_6MM_ARC_TEST_RIFLE = {
  name: 'Noveske N4 (Hornady 6mm ARC Gas Gun test rifle)',
  manufacturer: 'Noveske',
  model: 'N4',
  barrelLengthIn: 18,
  twistRate: '1:7.5',
  notes:
    'Test rifle cited in the Hornady 6mm ARC Gas Gun data sheet. Recorded for reference only.',
} as const;

export const HORNADY_6MM_ARC_CASE = {
  manufacturer: 'Hornady',
  model: '6mm ARC case',
  notes:
    'Brass case cited in the Hornady 6mm ARC Gas Gun data sheet. Max case length 1.490", trim 1.475".',
} as const;

export const HORNADY_6MM_ARC_PRIMER = {
  manufacturer: 'Federal',
  model: '205',
  notes:
    'Small rifle primer cited in the Hornady 6mm ARC Gas Gun data sheet.',
} as const;

// Bullet identities and their BCs as listed on the data sheet. These are
// reference values (not charges) and are safe to record as component metadata.
export const HORNADY_6MM_ARC_BULLETS: Array<{
  manufacturer: 'Hornady';
  model: string;
  bulletWeightGr: number;
  bulletBc: number | null;
  bcG1: number | null;
  bcG7: number | null;
  colIn: number;
  itemNumber: string;
}> = [
  {
    manufacturer: 'Hornady',
    model: '58gr V-MAX',
    bulletWeightGr: 58,
    bulletBc: 0.25,
    bcG1: 0.25,
    bcG7: null,
    colIn: 2.085,
    itemNumber: '22411',
  },
  {
    manufacturer: 'Hornady',
    model: '65gr V-MAX',
    bulletWeightGr: 65,
    bulletBc: 0.28,
    bcG1: 0.28,
    bcG7: null,
    colIn: 2.085,
    itemNumber: '22415',
  },
  {
    manufacturer: 'Hornady',
    model: '75gr V-MAX',
    bulletWeightGr: 75,
    bulletBc: 0.33,
    bcG1: 0.33,
    bcG7: null,
    colIn: 2.095,
    itemNumber: '22420',
  },
  {
    manufacturer: 'Hornady',
    model: '80gr GMX',
    bulletWeightGr: 80,
    bulletBc: 0.3,
    bcG1: 0.3,
    bcG7: null,
    colIn: 2.095,
    itemNumber: '24370',
  },
  {
    manufacturer: 'Hornady',
    model: '87gr V-MAX',
    bulletWeightGr: 87,
    bulletBc: 0.4,
    bcG1: 0.4,
    bcG7: null,
    colIn: 2.14,
    itemNumber: '22440',
  },
  {
    manufacturer: 'Hornady',
    model: '90gr GMX',
    bulletWeightGr: 90,
    bulletBc: 0.422,
    bcG1: 0.422,
    bcG7: null,
    colIn: 2.245,
    itemNumber: '2444',
  },
  {
    manufacturer: 'Hornady',
    model: '95gr SST',
    bulletWeightGr: 95,
    bulletBc: 0.355,
    bcG1: 0.355,
    bcG7: null,
    colIn: 2.18,
    itemNumber: '24532',
  },
  {
    manufacturer: 'Hornady',
    model: '100gr InterLock BTSP',
    bulletWeightGr: 100,
    bulletBc: 0.405,
    bcG1: 0.405,
    bcG7: null,
    colIn: 2.18,
    itemNumber: '2453',
  },
  {
    manufacturer: 'Hornady',
    model: '105gr BTHP Match',
    bulletWeightGr: 105,
    bulletBc: 0.53,
    bcG1: 0.53,
    bcG7: 0.253,
    colIn: 2.2,
    itemNumber: '2458',
  },
];

// Powder identities (names only). Burn-rate ordering and charge tables are
// intentionally NOT seeded — they belong on user-verified row drafts.
export const HORNADY_6MM_ARC_POWDERS: Array<{
  manufacturer: string;
  model: string;
}> = [
  { manufacturer: 'Vihtavuori', model: 'N-130' },
  { manufacturer: 'Accurate', model: 'LT-30' },
  { manufacturer: 'Accurate', model: '2200' },
  { manufacturer: 'Accurate', model: 'LT-32' },
  { manufacturer: 'Hodgdon', model: 'H322' },
  { manufacturer: 'Hodgdon', model: 'Benchmark' },
  { manufacturer: 'Accurate', model: '2230' },
  { manufacturer: 'Ramshot', model: 'X-Terminator' },
  { manufacturer: 'Alliant', model: 'Power Pro Varmint' },
  { manufacturer: 'Vihtavuori', model: 'N-133' },
  { manufacturer: 'Hodgdon', model: 'H4895' },
  { manufacturer: 'IMR', model: '8208 XBR' },
  { manufacturer: 'Hodgdon', model: 'H335' },
  { manufacturer: 'Accurate', model: '2460' },
  { manufacturer: 'Ramshot', model: 'TAC' },
  { manufacturer: 'Hodgdon', model: 'CFE 223' },
  { manufacturer: 'Hodgdon', model: 'LEVERevolution' },
  { manufacturer: 'Alliant', model: 'Power Pro 2000-MR' },
  { manufacturer: 'Norma', model: '202' },
  { manufacturer: 'Hodgdon', model: 'Varget' },
  { manufacturer: 'Alliant', model: 'Reloder 15' },
  { manufacturer: 'Accurate', model: '2520' },
];
