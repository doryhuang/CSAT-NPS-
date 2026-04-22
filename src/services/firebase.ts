import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const saveReport = async (data: any) => {
  try {
    const docRef = await addDoc(collection(db, 'reports'), {
      ...data,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving report:", error);
    throw error;
  }
};

export const getReport = async (id: string) => {
  try {
    const docRef = doc(db, 'reports', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      throw new Error("Report not found");
    }
  } catch (error) {
    console.error("Error getting report:", error);
    throw error;
  }
};
