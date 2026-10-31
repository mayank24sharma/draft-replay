import { DocumentMeta, Snapshot } from '../types';
import { saveLocalDoc, saveLocalSnapshot } from './db';
import { computeSha256 } from './crypto';

export interface SeededDemoData {
  heroDoc: DocumentMeta;
  heroSnapshots: Snapshot[];
  historyDoc: DocumentMeta;
  historySnapshots: Snapshot[];
}

export async function generateDemoSeeds(): Promise<SeededDemoData> {
  const now = Date.now();
  // Anchor to the past: last save = now - 8 minutes, first save = last save - 52 minutes (~60 min total span)
  const lastSaveHero = now - 8 * 60 * 1000;
  const firstSaveHero = lastSaveHero - 52 * 60 * 1000;

  const heroDocId = 'demo-hero-festival-doc-v7';
  const historyDocId = 'demo-history-essay-doc-v7';

  // 12 snapshots for Hero Doc with 2 visibly longer gaps (25 min break, 10 min pre-rewrite)
  // Gaps between snapshots in milliseconds from firstSaveHero:
  const heroOffsets = [
    0, // save 1: 0m
    45 * 1000, // save 2: +45s
    110 * 1000, // save 3: +65s
    180 * 1000, // save 4: +70s (paste with attribution)
    250 * 1000, // save 5: +70s
    (250 + 25 * 60) * 1000, // save 6: 25 min break! (~29m)
    (250 + 25 * 60 + 60) * 1000, // save 7: +60s
    (250 + 25 * 60 + 130) * 1000, // save 8: +70s
    (250 + 35 * 60) * 1000, // save 9: 10 min thinking gap before rewrite! (~40m)
    (250 + 36 * 60) * 1000, // save 10: large rewrite!
    (250 + 44 * 60) * 1000, // save 11: +8m
    52 * 60 * 1000, // save 12: final polish (52m total)
  ];

  const heroTexts = [
    // 1
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations.',
    // 2
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali.',
    // 3
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.',
    // 4 - paste with attribution block
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).',
    // 5
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets.',
    // 6 - after 25 min break
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets. My mother and I spend hours cleaning every window and oiling earthen diyas.',
    // 7
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets. My mother and I spend hours cleaning every window and oiling earthen diyas. We also bought lots of noisy firecrackers from the market near the railway crossing, which caused loud smoke everywhere in the lane.',
    // 8
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets. My mother and I spend hours cleaning every window and oiling earthen diyas. We also bought lots of noisy firecrackers from the market near the railway crossing, which caused loud smoke everywhere in the lane. It was really loud and everyone covered their ears.',
    // 9 - after 10 min pre-rewrite gap (decided to remove noisy firecrackers paragraph and write about eco-friendly clay lamps & rangoli instead)
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets. My mother and I spend hours cleaning every window and oiling earthen diyas.',
    // 10 - large rewrite replaced with eco-friendly celebration
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets. My mother and I spend hours cleaning every window and oiling earthen diyas. In recent years, our neighbourhood chose green celebrations with vibrant marigold rangolis and clay lamps instead of noisy smoke.',
    // 11
    'My Favourite Festival\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets. My mother and I spend hours cleaning every window and oiling earthen diyas. In recent years, our neighbourhood chose green celebrations with vibrant marigold rangolis and clay lamps instead of noisy smoke. Looking down our street at twilight, the rows of flames look like miniature constellations.',
    // 12 - final polish
    'My Favourite Festival (Class 8 English)\n\nIndia is a land of many vibrant celebrations, but none shines as brightly for me as Diwali. Known universally as the Festival of Lights, it brings my entire family together each autumn.\n\n"Diwali symbolizes the spiritual victory of light over darkness, good over evil, and knowledge over ignorance." (Encyclopaedia of Indian Traditions).\n\nWeeks before the new moon, our house smells of freshly fried gujiyas and roasted cardamom sweets. My mother and I spend hours cleaning every window and oiling earthen diyas. In recent years, our neighbourhood chose green celebrations with vibrant marigold rangolis and clay lamps instead of noisy smoke. Looking down our street at twilight, the warm rows of golden flames look like peaceful constellations welcoming hope.',
  ];

  const heroSnapshots: Snapshot[] = heroOffsets.map((offset, i) => {
    const clientT = firstSaveHero + offset;
    let eventType: 'pause' | 'paste' | 'large_delete' | 'undo' = 'pause';
    let inserted = i === 0 ? heroTexts[0].length : Math.max(0, heroTexts[i].length - heroTexts[i - 1].length);
    let deleted = 0;
    let countSource: 'event' | 'diff-estimate' = 'diff-estimate';

    if (i === 3) {
      eventType = 'paste';
      inserted = 142; // exact pasted block length
      countSource = 'event';
    } else if (i === 8) {
      eventType = 'large_delete';
      deleted = 196;
      inserted = 0;
    } else if (i === 9) {
      eventType = 'pause';
      inserted = 145;
    }

    return {
      docId: heroDocId,
      snapshotId: `hero-snap-${i + 1}`,
      seq: i + 1,
      t: clientT,
      clientT,
      text: heroTexts[i],
      eventType,
      inserted,
      deleted,
      countSource,
    };
  });

  const heroDoc: DocumentMeta = {
    docId: heroDocId,
    title: 'My Favourite Festival (Class 8 English)',
    studentId: 'STU-2026-8814',
    studentClass: 'Class 8',
    createdAt: firstSaveHero - 2 * 60 * 1000,
    lastSeq: heroSnapshots.length,
    version: 2,
    isSubmitted: true,
    submittedAt: lastSaveHero + 120 * 1000,
    declaration: {
      level: 'ideas',
      note: 'AI for ideas only — used AI to brainstorm a list of festivals',
      declaredAt: lastSaveHero + 60 * 1000,
    },
    grade: {
      score: 94,
      letterGrade: 'A',
      rubric: {
        processIntegrity: 24,
        aiDisclosure: 25,
        writingQuality: 23,
        revisionDepth: 22,
      },
      feedback: 'Excellent writing process with organic drafting, honest AI disclosure for brainstorming, and thorough self-revision into eco-friendly traditions.',
      gradedAt: lastSaveHero + 180 * 1000,
      gradedBy: 'Mrs. Sharma (English Dept)',
      status: 'graded',
    },
    isDemo: true,
  };

  // Doc 2: History Essay (fictional) - 4 pasted blocks, ~20 min span
  const lastSaveHistory = now - 5 * 60 * 1000;
  const firstSaveHistory = lastSaveHistory - 20 * 60 * 1000;

  const historyOffsets = [
    0, // Intro typed
    3 * 60 * 1000, // Pasted Block 1
    7 * 60 * 1000, // Pasted Block 2
    12 * 60 * 1000, // Pasted Block 3
    16 * 60 * 1000, // Pasted Block 4
    20 * 60 * 1000, // Short edit
  ];

  const historyTexts = [
    'The Industrial Revolution: Origins and Consequences\n\nIntroduction:\nThe transformation began in eighteenth-century Great Britain.',
    'The Industrial Revolution: Origins and Consequences\n\nIntroduction:\nThe transformation began in eighteenth-century Great Britain.\n\nTechnological innovation in textile manufacturing, most notably Hargreaves\' spinning jenny and Arkwright\'s water frame, exponentially multiplied textile production while concentrating labour inside urban factories.',
    'The Industrial Revolution: Origins and Consequences\n\nIntroduction:\nThe transformation began in eighteenth-century Great Britain.\n\nTechnological innovation in textile manufacturing, most notably Hargreaves\' spinning jenny and Arkwright\'s water frame, exponentially multiplied textile production while concentrating labour inside urban factories.\n\nJames Watt\'s refinements to the Newcomen atmospheric steam engine liberated heavy manufacturing from fixed river banks, allowing foundries and locomotive transport networks to expand across coal-rich regions.',
    'The Industrial Revolution: Origins and Consequences\n\nIntroduction:\nThe transformation began in eighteenth-century Great Britain.\n\nTechnological innovation in textile manufacturing, most notably Hargreaves\' spinning jenny and Arkwright\'s water frame, exponentially multiplied textile production while concentrating labour inside urban factories.\n\nJames Watt\'s refinements to the Newcomen atmospheric steam engine liberated heavy manufacturing from fixed river banks, allowing foundries and locomotive transport networks to expand across coal-rich regions.\n\nSocial consequences included rapid and uncoordinated demographic shifts from agrarian hamlets into dense industrial conurbations lacking adequate municipal sanitation, potable water, or labour protections.',
    'The Industrial Revolution: Origins and Consequences\n\nIntroduction:\nThe transformation began in eighteenth-century Great Britain.\n\nTechnological innovation in textile manufacturing, most notably Hargreaves\' spinning jenny and Arkwright\'s water frame, exponentially multiplied textile production while concentrating labour inside urban factories.\n\nJames Watt\'s refinements to the Newcomen atmospheric steam engine liberated heavy manufacturing from fixed river banks, allowing foundries and locomotive transport networks to expand across coal-rich regions.\n\nSocial consequences included rapid and uncoordinated demographic shifts from agrarian hamlets into dense industrial conurbations lacking adequate municipal sanitation, potable water, or labour protections.\n\nConclusion:\nModern industrial society inherited both the immense productive efficiency and the profound environmental challenges pioneered during this epoch.',
    'The Industrial Revolution: Origins and Consequences (fictional)\n\nIntroduction:\nThe transformation began in eighteenth-century Great Britain.\n\nTechnological innovation in textile manufacturing, most notably Hargreaves\' spinning jenny and Arkwright\'s water frame, exponentially multiplied textile production while concentrating labour inside urban factories.\n\nJames Watt\'s refinements to the Newcomen atmospheric steam engine liberated heavy manufacturing from fixed river banks, allowing foundries and locomotive transport networks to expand across coal-rich regions.\n\nSocial consequences included rapid and uncoordinated demographic shifts from agrarian hamlets into dense industrial conurbations lacking adequate municipal sanitation, potable water, or labour protections.\n\nConclusion:\nModern industrial society inherited both the immense productive efficiency and the profound environmental challenges pioneered during this epoch.',
  ];

  const historySnapshots: Snapshot[] = historyOffsets.map((offset, i) => {
    const clientT = firstSaveHistory + offset;
    let eventType: 'pause' | 'paste' | 'large_delete' | 'undo' = 'pause';
    let countSource: 'event' | 'diff-estimate' = 'diff-estimate';
    let inserted = i === 0 ? historyTexts[0].length : Math.max(0, historyTexts[i].length - historyTexts[i - 1].length);

    if (i >= 1 && i <= 4) {
      eventType = 'paste';
      countSource = 'event';
      inserted = historyTexts[i].length - historyTexts[i - 1].length;
    }

    return {
      docId: historyDocId,
      snapshotId: `history-snap-${i + 1}`,
      seq: i + 1,
      t: clientT,
      clientT,
      text: historyTexts[i],
      eventType,
      inserted,
      deleted: 0,
      countSource,
    };
  });

  const historyDoc: DocumentMeta = {
    docId: historyDocId,
    title: 'History Essay (fictional)',
    studentId: 'STU-2026-3921',
    studentClass: 'Class 10',
    createdAt: firstSaveHistory - 1 * 60 * 1000,
    lastSeq: historySnapshots.length,
    version: 2,
    isSubmitted: true,
    submittedAt: lastSaveHistory + 60 * 1000,
    declaration: {
      level: 'wrote-parts',
      note: 'AI wrote parts of this — synthesized reference paragraphs for the body sections',
      declaredAt: lastSaveHistory + 30 * 1000,
    },
    grade: null,
    isDemo: true,
  };

  // Save both to local IndexedDB
  await saveLocalDoc(heroDoc);
  for (const s of heroSnapshots) {
    await saveLocalSnapshot(s);
  }
  await saveLocalDoc(historyDoc);
  for (const s of historySnapshots) {
    await saveLocalSnapshot(s);
  }

  // Also register on server if not present so share links work seamlessly
  try {
    const demoKey = 'demo-mock-write-key-777';
    const keyHash = await computeSha256(demoKey);
    await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: heroDoc.docId, title: heroDoc.title, keyHash }),
    }).catch(() => {});
  } catch (_) {}

  return { heroDoc, heroSnapshots, historyDoc, historySnapshots };
}
