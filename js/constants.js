// Słowniki pól dziennika. Zakres pól odpowiada zaleceniom NICE CG150 (częstość, czas trwania,
// natężenie, objawy towarzyszące, wszystkie przyjęte leki, możliwe czynniki wyzwalające,
// związek z miesiączką) oraz kryteriom ICHD-3 Międzynarodowego Towarzystwa Bólów Głowy.

export const LOCATIONS = [
  { key: 'left', label: 'Lewa strona' },
  { key: 'right', label: 'Prawa strona' },
  { key: 'both', label: 'Obie strony' },
  { key: 'forehead', label: 'Czoło' },
  { key: 'temples', label: 'Skronie' },
  { key: 'eye', label: 'Wokół oka' },
  { key: 'occiput', label: 'Tył głowy, kark' },
  { key: 'whole', label: 'Cała głowa' },
];

export const QUALITIES = [
  { key: 'pulsating', label: 'Pulsujący' },
  { key: 'pressing', label: 'Uciskający jak obręcz' },
  { key: 'stabbing', label: 'Kłujący' },
  { key: 'dull', label: 'Tępy' },
  { key: 'burning', label: 'Piekący' },
];

export const SYMPTOMS = [
  { key: 'nausea', label: 'Nudności' },
  { key: 'vomiting', label: 'Wymioty' },
  { key: 'photophobia', label: 'Razi światło' },
  { key: 'phonophobia', label: 'Przeszkadzają dźwięki' },
  { key: 'osmophobia', label: 'Przeszkadzają zapachy' },
  { key: 'aura', label: 'Aura (mroczki, błyski)' },
  { key: 'movement', label: 'Nasila się przy ruchu' },
  { key: 'dizziness', label: 'Zawroty głowy' },
  { key: 'tearing', label: 'Łzawienie lub katar po stronie bólu' },
  { key: 'thunderclap', label: 'Nagły, piorunujący początek', alarm: true },
  { key: 'neuro', label: 'Drętwienie, osłabienie, zaburzenia mowy', alarm: true },
  { key: 'fever_neck', label: 'Gorączka lub sztywny kark', alarm: true },
];

export const ALARM_SYMPTOMS = SYMPTOMS.filter((s) => s.alarm).map((s) => s.key);

export const DISABILITY = [
  { key: 0, label: 'Bez wpływu' },
  { key: 1, label: 'Utrudniał' },
  { key: 2, label: 'Uniemożliwiał' },
];

export const TRIGGERS = [
  { key: 'skipped_meal', label: 'Pominięty posiłek' },
  { key: 'menstruation', label: 'Miesiączka' },
  { key: 'weather', label: 'Zmiana pogody' },
  { key: 'computer', label: 'Długa praca przy komputerze' },
  { key: 'neck', label: 'Napięty kark, zła postawa' },
  { key: 'irregular_sleep', label: 'Zmiana rytmu snu' },
  { key: 'bright_light', label: 'Ostre lub migające światło' },
  { key: 'noise', label: 'Hałas' },
  { key: 'smells', label: 'Silne zapachy' },
  { key: 'travel', label: 'Podróż' },
  { key: 'exertion', label: 'Duży wysiłek' },
  { key: 'food', label: 'Ser, czekolada, wędliny' },
];

export const SLEEP_QUALITY = [
  { key: 1, label: 'Zła' },
  { key: 2, label: 'Średnia' },
  { key: 3, label: 'Dobra' },
];

export const STRESS = [
  { key: 1, label: 'Brak' },
  { key: 2, label: 'Niski' },
  { key: 3, label: 'Średni' },
  { key: 4, label: 'Wysoki' },
  { key: 5, label: 'Bardzo wysoki' },
];

export const MED_EFFECTS = [
  { key: 'yes', label: 'Pomógł' },
  { key: 'partial', label: 'Częściowo' },
  { key: 'no', label: 'Nie pomógł' },
];

// Progi z ICHD-3 (8.2, ból głowy z nadużywania leków): dni w miesiącu.
export const MED_CLASSES = {
  simple: { label: 'Przeciwbólowy', limit: 15 },
  triptan: { label: 'Tryptan', limit: 10 },
  combination: { label: 'Złożony', limit: 10 },
  opioid: { label: 'Opioid', limit: 10 },
  ergot: { label: 'Ergotamina', limit: 10 },
  other: { label: 'Inny', limit: null },
};
export const MED_CLASS_ORDER = ['simple', 'triptan', 'combination', 'opioid', 'ergot', 'other'];
export const ACUTE_CLASSES = ['simple', 'triptan', 'combination', 'opioid', 'ergot'];
export const SPECIFIC_CLASSES = ['triptan', 'combination', 'opioid', 'ergot'];

export const COMMON_MEDS = [
  'Ibuprofen', 'Paracetamol', 'Ketoprofen', 'Naproksen', 'Metamizol',
  'Kwas acetylosalicylowy', 'Sumatryptan', 'Ryzatryptan', 'Eletryptan', 'Zolmitryptan',
];

// Kolejność ma znaczenie: lek złożony z opioidem to opioid, „Apap Extra” to lek złożony.
const MED_PATTERNS = [
  ['ergot', /ergotam|cafergot/i],
  ['opioid', /tramadol|kodein|codein|morfin|oks[yi]kodon|oxycodon|tapentadol|fentanyl|tramal|poltram|zaldiar|doreta/i],
  ['triptan', /tr[yi]ptan|imigran|maxalt|zomig|relpax|rizalief|sumamigren|zolmigren|nara?mig/i],
  ['combination', /extra|saridon|excedrin|etopiryna|cofepiryna|migrenol|solpadein|kofein|caffein|\+/i],
  ['simple', /ibupro|ibum|nurofen|paracetam|apap|panadol|ketopro|ketonal|naprok|naprox|aleve|diklofen|diclofen|olfen|voltaren|aspiry|polopiry|acetylosalic|metamizol|pyralgin|deksketo|dexak|nimesul|nimesil|metafen/i],
];

export function detectMedClass(name) {
  const n = String(name || '');
  for (const [cls, re] of MED_PATTERNS) if (re.test(n)) return cls;
  return 'other';
}

export const INTENSITY_COLORS = [
  '#9EDFC5', // 0 – dzień bez bólu
  '#FFE8A3', '#FFDA84', '#FFC766',
  '#FFAE5B', '#FF9452', '#F97B4E',
  '#EE6150', '#DB4757', '#BE3160', '#961F62',
];

export function intensityLabel(v) {
  if (v == null) return '';
  if (v === 0) return 'Brak bólu';
  if (v <= 3) return 'Łagodny';
  if (v <= 6) return 'Umiarkowany';
  if (v <= 8) return 'Silny';
  return 'Bardzo silny';
}

export const labelOf = (list, key) => list.find((x) => x.key === key)?.label ?? key;
