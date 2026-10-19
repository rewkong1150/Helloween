// Deletes ALL contest data: Firestore `costumes` + `votes` collections and the
// Storage `costumes/` folder of project web-pro-b6021. Irreversible.
//
// Usage (needs a service-account key with Firestore + Storage admin access):
//   npm i --no-save firebase-admin
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
//   node scripts/wipe-firebase.mjs            # dry run, only counts
//   node scripts/wipe-firebase.mjs --yes      # actually deletes
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const apply = process.argv.includes('--yes');
const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'web-pro-b6021',
  storageBucket: 'web-pro-b6021.appspot.com',
});
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

for (const name of ['costumes', 'votes']) {
  const snap = await db.collection(name).get();
  console.log(`${name}: ${snap.size} documents`);
  if (apply) {
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

const [files] = await bucket.getFiles({ prefix: 'costumes/' });
console.log(`storage costumes/: ${files.length} files`);
if (apply) {
  await Promise.all(files.map((f) => f.delete()));
}
console.log(apply ? 'Deleted.' : 'Dry run only. Re-run with --yes to delete.');
