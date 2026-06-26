import { execSync } from 'node:child_process';

import { decideLayout, parseOrderEntries, planBookPages } from '../layout/engine';
import { decodeFirestoreDocument } from './firestoreRest';

const orderId = process.argv[2] ?? '1dcbacbe-7e66-4c67-bf10-012f105e1e0a';
const url =
  `https://firestore.googleapis.com/v1/projects/chapter-cc187` +
  `/databases/(default)/documents/orders/${orderId}?key=AIzaSyB7TS-Fk60oI_-HR7aYvXE0k0nNYha41ww`;

const json = JSON.parse(
  execSync(`curl.exe --ssl-no-revoke -s "${url}"`, { encoding: 'utf8' }),
);
const order = decodeFirestoreDocument(json);
const entries = parseOrderEntries(order);

console.log(`entries: ${entries.length}\n`);
for (const [i, entry] of entries.entries()) {
  const plan = decideLayout(entry);
  console.log(`--- ${i} ---`);
  console.log(`date: ${entry.date}`);
  console.log(`title: ${entry.title}`);
  console.log(`body: ${JSON.stringify(entry.body.slice(0, 100))}`);
  console.log(`bodyLen: ${entry.body.trim().length}`);
  console.log(`photos: ${entry.photoUrls.length}`);
  console.log(`type: ${plan.type}, pageMode: ${plan.pageMode}`);
}

const pages = planBookPages(entries);
console.log(`\npages: ${pages.length}`);
for (const [i, page] of pages.entries()) {
  const labels = page.items.map((item) => {
    const title = item.layout.entry.title;
    return `${item.kind}:${title}`;
  });
  console.log(`page ${i}: ${labels.join(' + ')}`);
}
